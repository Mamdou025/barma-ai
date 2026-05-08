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
const upload = multer({ dest: 'uploads/' });

function splitTextIntoChunks(text, maxWords = 500) {
  const sentences = text.split(/(?<=[.?!])\s+/);
  const chunks = [];
  let chunk = [];

  for (const sentence of sentences) {
    const words = sentence.split(/\s+/);
    const chunkWords = chunk.join(' ').split(/\s+/).length;

    if ((chunkWords + words.length) > maxWords) {
      chunks.push(chunk.join(' '));
      chunk = [];
    }
    chunk.push(sentence);
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

  try {
    // Step 1: PDF parse
    console.log('📖 PDF parse: start');
    const t0 = Date.now();
    const dataBuffer = fs.readFileSync(file.path);
    const parsedData = await pdfParse(dataBuffer);
    console.log(`📖 PDF parse: done (${Date.now() - t0}ms)`);

    const chunks = splitTextIntoChunks(parsedData.text, 500);
    console.log(`🔪 Chunks: ${chunks.length}`);

    // Step 2: Storage upload
    const fileExt = path.extname(file.originalname);
    const uniqueFilename = `${crypto.randomUUID()}${fileExt}`;
    console.log(`📤 Storage upload: start → bucket="${SUPABASE_BUCKET}"`);
    const t1 = Date.now();
    const { error: uploadErr } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(uniqueFilename, dataBuffer, {
        contentType: file.mimetype,
      });
    console.log(`📤 Storage upload: done (${Date.now() - t1}ms)`);

    if (uploadErr) {
      console.error('❌ Storage upload error:', uploadErr.message);
      return res.status(500).json({ error: 'Failed to upload file to storage' });
    }

    // Step 3: Public URL
    const { data: publicURLData } = supabase
      .storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(uniqueFilename);
    const publicURL = publicURLData.publicUrl;
    console.log('🌐 Public URL generated');

    // Step 4: Document DB insert
    console.log('💾 Document insert: start');
    const t2 = Date.now();
    const { data: docInsert, error: insertErr } = await supabase
      .from('documents')
      .insert([
        {
          name: file.originalname,
          storage_path: uniqueFilename,
          storage_url: publicURL,
          full_text: parsedData.text
        }
      ])
      .select()
      .single();
    console.log(`💾 Document insert: done (${Date.now() - t2}ms)`);

    if (insertErr) {
      console.error('❌ Document insert error:', insertErr.message);
      return res.status(500).json({ error: 'Failed to store document' });
    }

    // Step 5: Embeddings loop
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
        console.error(`  ❌ Chunk ${i + 1} insert error:`, chunkErr.message);
      }
    }
    console.log(`🧠 Embedding loop: done (${Date.now() - t3}ms total)`);

    fs.unlinkSync(file.path);
    console.log('✅ Upload complete, sending response');
    res.json({
      message: 'PDF parsed, embedded, and uploaded successfully',
      public_url: publicURL,
      chunks: chunks.length,
      document: { id: docInsert.id }
    });

  } catch (err) {
    console.error('❌ Upload handler error:', err.message);
    res.status(500).json({ error: 'Failed to parse and embed PDF' });
  }
});

module.exports =  router;
