const express = require('express');
const openai = require('../utils/openaiClient');
const { supabase } = require('../utils/supabaseClient');

const router = express.Router();

// Utility for similarity
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (normA * normB);
}

router.post('/chat', async (req, res) => {
  const { message, document_ids } = req.body;
console.log('📦 Received document_ids:', document_ids);
if (!Array.isArray(document_ids) || document_ids.length === 0) {
  return res.status(400).json({ error: 'No document_ids provided' });
}

  try {
    // 1. Embed the user's question
    const embedQ = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: message,
      encoding_format: 'float'
    });

    const questionEmbedding = embedQ.data[0].embedding;

    // 2. Fetch matching chunks from Supabase
    const { data: allChunks, error: fetchErr } = await supabase
      .from('chunks')
      .select('content, embedding, chunk_index, document_id')
      .in('document_id', document_ids);


    if (fetchErr) {
      console.error('❌ Failed to fetch chunks:', fetchErr.message);
      return res.status(500).json({ error: 'Error fetching chunks' });
    }

    // 3. Score all chunks using cosine similarity
    const scoredChunks = allChunks.map(chunk => {
      const embedding = Array.isArray(chunk.embedding)
        ? chunk.embedding
        : JSON.parse(chunk.embedding); // Ensure it's an array

      const similarity = cosineSimilarity(questionEmbedding, embedding);
      return { ...chunk, similarity };
    });

    // 4. Pick top 5 most similar chunks
    const topChunks = scoredChunks
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    const contextText = topChunks.map(c => `Chunk ${c.chunk_index}:\n${c.content}`).join('\n\n');

    // 5. Send to OpenAI with selected context
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `Vous êtes un assistant juridique formé pour répondre aux questions de manière claire et précise.

Vous pouvez utiliser un raisonnement général, mais toutes les conclusions juridiques doivent être fondées sur les documents juridiques fournis.

Répondez uniquement aux questions en utilisant le contexte extrait des documents sources vérifiés.

Si aucune source n'est fournie, indiquez-le clairement. Ne devinez jamais et n'inventez jamais d'informations juridiques.`
        },
        {
          role: 'user',
          content: `Here is some context:\n\n${contextText}\n\nNow answer this question:\n${message}`
        }
      ]
    });

    res.json({ reply: completion.choices[0].message.content });

  } catch (err) {
    console.error('OpenAI API error:', err);
    res.status(500).json({ error: 'Failed to get chat response' });
  }
});

module.exports = router;
