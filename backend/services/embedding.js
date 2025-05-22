// services/embedding.js

import { OpenAI } from 'openai';
import { supabase } from '../utils/supabaseClient.js';
import { chunkText } from './chunking.js';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function embedAndStoreChunks(documentId, text) {
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
