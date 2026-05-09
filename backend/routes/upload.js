// routes/upload.js

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pdfParse = require('pdf-parse');
const openai = require('../utils/openaiClient');
const { supabase } = require('../utils/supabaseClient');

const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'documents';

const router = express.Router();
const uploadDir = path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

function splitTextIntoChunks(text, maxWords = 500) {
  const sentences = text.split(/(?<=[.?!])\s+/);
  const chunks = [];
  let chunk = [];

  for (const sentence of sentences) {
    const words = sentence.split(/\s+/);
    const chunkWords = chunk.length > 0 ? chunk.join(' ').split(/\s+/).length : 0;

    if ((chunkWords + words.length) > maxWords && chunk.length > 0) {
      chunks.push(chunk.join(' '));
      chunk = [];
    }
    if (sentence.trim()) {
      chunk.push(sentence);
    }
  }

  if (chunk.length > 0) {
    chunks.push(chunk.join(' '));
  }

  return chunks;
}

router.post('/upload', upload.single('file'), async (req, res) => {
  console.log('📥 /api/upload request received');
  const file = req.file;
  if (!file) {
    console.log('❌ No file in request (multer found nothing under field "file")');
    return res.status(400).json({ error: 'No file uploaded' });
  }
  console.log(`📄 File: "${file.originalname}" | ${file.size} bytes | ${file.mimetype}`);

  let dataBuffer;
  let uniqueFilename;
  let publicURL;
  let docInsert;
  let parsedText = '';
  let chunks = [];
  const warnings = [];

  try {
    dataBuffer = fs.readFileSync(file.path);

    // Step 1: Storage upload first so the PDF remains visible even if text
    // extraction or embedding fails for scanned/encrypted/malformed files.
    const fileExt = path.extname(file.originalname) || '.pdf';
    uniqueFilename = `${crypto.randomUUID()}${fileExt}`;
    console.log(`📤 Storage upload: start → bucket="${SUPABASE_BUCKET}"`);
    const t1 = Date.now();
    const { error: uploadErr } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(uniqueFilename, dataBuffer, {
        contentType: file.mimetype || 'application/pdf',
      });
    console.log(`📤 Storage upload: done (${Date.now() - t1}ms)`);

    if (uploadErr) {
      console.error('❌ Storage upload error:', uploadErr.message);
      return res.status(500).json({ error: 'Failed to upload file to storage' });
    }

    // Step 2: Public URL
    const { data: publicURLData } = supabase
      .storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(uniqueFilename);
    publicURL = publicURLData.publicUrl;
    console.log('🌐 Public URL generated');

    // Step 3: Best-effort PDF parse. Uploads should not disappear simply
    // because a PDF has no extractable text or pdf-parse cannot read it.
    try {
      console.log('📖 PDF parse: start');
      const t0 = Date.now();
      const parsedData = await pdfParse(dataBuffer);
      parsedText = (parsedData.text || '').trim();
      chunks = parsedText ? splitTextIntoChunks(parsedText, 500).filter(Boolean) : [];
      console.log(`📖 PDF parse: done (${Date.now() - t0}ms)`);
      console.log(`🔪 Chunks: ${chunks.length}`);

      if (!parsedText) {
        warnings.push('The PDF was uploaded, but no extractable text was found. If this is a scanned PDF, OCR is required before it can be searched or used in chat.');
      }
    } catch (parseErr) {
      console.error('❌ PDF parse error:', parseErr.message);
      warnings.push('The PDF was uploaded, but its text could not be extracted. It will appear in the document list, but search/chat context may be unavailable until the PDF is fixed or OCR is added.');
    }

    // Step 4: Document DB insert
    console.log('💾 Document insert: start');
    const t2 = Date.now();
    const { data: insertedDoc, error: insertErr } = await supabase
      .from('documents')
      .insert([
        {
          name: file.originalname,
          storage_path: uniqueFilename,
          storage_url: publicURL,
          full_text: parsedText
        }
      ])
      .select()
      .single();
    console.log(`💾 Document insert: done (${Date.now() - t2}ms)`);

    if (insertErr) {
      console.error('❌ Document insert error:', insertErr.message);
      return res.status(500).json({ error: 'Failed to store document' });
    }
    docInsert = insertedDoc;

    // Step 5: Best-effort embeddings loop. A file that was stored and indexed in
    // documents should still be returned to the UI if OpenAI or chunk insertion fails.
    if (chunks.length > 0) {
      try {
        console.log(`🧠 Embedding loop: start (${chunks.length} chunks)`);
        const t3 = Date.now();
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const te = Date.now();
          console.log(`  🔄 Chunk ${i + 1}/${chunks.length}: embedding...`);

          const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: chunk,
            encoding_format: 'float'
          });
          const embedding = embeddingResponse.data[0].embedding;
          console.log(`  ✅ Chunk ${i + 1} embedded (${Date.now() - te}ms)`);

          const { error: chunkErr } = await supabase
            .from('document_chunks')
            .insert([{ document_id: docInsert.id, content: chunk, embedding }]);

          if (chunkErr) {
            throw new Error(`Chunk ${i + 1} insert error: ${chunkErr.message}`);
          }
        }
        console.log(`🧠 Embedding loop: done (${Date.now() - t3}ms total)`);
      } catch (embedErr) {
        console.error('❌ Embedding error:', embedErr.message);
        warnings.push('The PDF was uploaded and text was extracted, but embeddings could not be created. It may appear in the list but not work in semantic chat/search yet.');
      }
    } else {
      console.log('🧠 Embedding loop skipped: no text chunks available');
    }

    console.log('✅ Upload complete, sending response');
    return res.json({
      message: warnings.length
        ? 'PDF uploaded with warnings'
        : 'PDF parsed, embedded, and uploaded successfully',
      warnings,
      public_url: publicURL,
      chunks: chunks.length,
      text_content: parsedText,
      document: {
        id: docInsert.id,
        title: docInsert.name,
        uploaded_at: docInsert.created_at,
        storage_url: docInsert.storage_url,
        text_content: docInsert.full_text || parsedText
      }
    });

  } catch (err) {
    console.error('❌ Upload handler error:', err.message);
    return res.status(500).json({ error: 'Failed to upload PDF' });
  } finally {
    if (file?.path) {
      fs.unlink(file.path, (unlinkErr) => {
        if (unlinkErr) {
          console.error('⚠️ Failed to clean up temp upload:', unlinkErr.message);
        }
      });
    }
  }
});

module.exports =  router;
