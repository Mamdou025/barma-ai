// services/embedding.js

const { OpenAI } = require('openai');
const { supabase } = require('../utils/supabaseClient.js');
const { chunkText } = require('./chunkings.js');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function embedAndStoreChunks(documentId, text) {
  const chunks = chunkText(text);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunk,
    });

    const embedding = embeddingResponse.data[0].embedding;

    const { error } = await supabase.from('chunks').insert([
      {
        document_id: documentId,
        chunk_index: i,
        content: chunk,
        embedding,
      },
    ]);

    if (error) {
      console.error(`❌ Error inserting chunk ${i}:`, error);
    }
  }

  console.log(`✅ Stored ${chunks.length} chunks for document ${documentId}`);
}

async function embedAndStoreSegments(segments, { supabase }) {
  let hasVector = false;
  try {
    const { data, error } = await supabase
      .from('pg_extension')
      .select('extname')
      .eq('extname', 'vector');

    if (!error && data && data.length > 0) {
      hasVector = true;
    }
  } catch (err) {
    console.error('❌ Error checking vector extension:', err);
  }

  let storedSegments = 0;

  for (const segment of segments) {
    try {
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: segment.text,
      });

      const embedding = embeddingResponse.data[0].embedding;

      const payload = {
        document_id: segment.document_id,
        type: segment.type,
        role: segment.role,
        text: segment.text,
        metadata: segment.metadata || {},
      };

      if (hasVector) {
        payload.embedding = embedding;
      } else {
        payload.metadata = { ...payload.metadata, emb: embedding };
      }

      const { error } = await supabase
        .from('document_segments')
        .insert([payload]);

      if (error) {
        console.error('❌ Error inserting segment:', error);
      } else {
        storedSegments++;
      }
    } catch (err) {
      console.error('❌ Error processing segment:', err);
    }
  }

  console.log(`✅ Stored ${storedSegments} segments`);
}

module.exports = {
  embedAndStoreChunks,
  embedAndStoreSegments
};
