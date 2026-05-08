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
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const dataBuffer = fs.readFileSync(file.path);
    const parsedData = await pdfParse(dataBuffer);
    const chunks = splitTextIntoChunks(parsedData.text, 500);

    console.log(`✅ Extracted text from ${file.originalname}:\n`);
    console.log(parsedData.text.slice(0, 500));

    // 🔐 Generate a unique filename for storage
    const fileExt = path.extname(file.originalname);
    const uniqueFilename = `${crypto.randomUUID()}${fileExt}`;

    // 🔼 Upload file to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(uniqueFilename, dataBuffer, {
        contentType: file.mimetype,
      });

    if (uploadErr) {
      console.error('❌ Failed to upload to Supabase Storage:', uploadErr.message);
      return res.status(500).json({ error: 'Failed to upload file to storage' });
    }

    // 🌐 Get the public URL
    const { data: publicURLData } = supabase
      .storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(uniqueFilename);

    const publicURL = publicURLData.publicUrl;

    // 📝 Insert document metadata into the database
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

    if (insertErr) {
      console.error('❌ Failed to save document:', insertErr.message);
      return res.status(500).json({ error: 'Failed to store document' });
    }

    // 🧠 Store chunks + embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: chunk,
        encoding_format: 'float'
      });

      const embedding = embeddingResponse.data[0].embedding;

      const { error: chunkErr } = await supabase
        .from('document_chunks')
        .insert([
          {
            document_id: docInsert.id,
            content: chunk,
            embedding: embedding
          }
        ]);

      if (chunkErr) {
        console.error(`❌ Failed to insert chunk ${i}:`, chunkErr.message);
      }
    }

    fs.unlinkSync(file.path);
    res.json({
      message: 'PDF parsed, embedded, and uploaded successfully',
      public_url: publicURL,
      chunks: chunks.length,
      document: { id: docInsert.id }
    });

  } catch (err) {
    console.error('❌ PDF parse error:', err);
    res.status(500).json({ error: 'Failed to parse and embed PDF' });
  }
});

module.exports =  router;
