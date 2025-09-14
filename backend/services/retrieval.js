const openai = require('../utils/openaiClient');
const { supabase } = require('../utils/supabaseClient');

function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (normA * normB);
}

async function retrieveByQuery({ query, filters = {} }) {
  const embed = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
    encoding_format: 'float'
  });

  const questionEmbedding = embed.data[0].embedding;

  let builder = supabase
    .from('document_segments')
    .select('id, text, embedding, metadata, type, role');

  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      builder = builder.in(key, value);
    } else {
      builder = builder.eq(key, value);
    }
  }

  const { data: segments, error } = await builder;
  if (error) {
    throw new Error('Error fetching segments: ' + error.message);
  }

  const scored = segments.map((seg) => {
    let embedding = seg.embedding;
    if (!embedding && seg.metadata && seg.metadata.emb) {
      embedding = seg.metadata.emb;
    }
    if (typeof embedding === 'string') {
      try {
        embedding = JSON.parse(embedding);
      } catch (e) {
        embedding = [];
      }
    }
    const similarity = cosineSimilarity(questionEmbedding, embedding);
    return {
      id: seg.id,
      text: seg.text,
      metadata: { type: seg.type, role: seg.role },
      similarity
    };
  });

  return scored.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
}

module.exports = { retrieveByQuery };
