const express = require('express');
const openai = require('../utils/openaiClient');
const { supabase } = require('../utils/supabaseClient');
const { getRules } = require('../utils/rulesLoader');
const { retrieveGraph } = require('../services/retriever_graph'); // ← NEW

const rules = getRules();
const router = express.Router();
const USE_GRAPH = String(process.env.USE_GRAPH_RETRIEVAL || '').toLowerCase() === 'true';

// Legacy util (used only in non-graph mode)
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (normA * normB || 1e-8);
}

router.post('/chat', async (req, res) => {
  const { message, document_ids, session_id, vulgarisation = false } = req.body;
  const startTime = Date.now();

  if (!Array.isArray(document_ids) || document_ids.length === 0) {
    return res.status(400).json({ error: 'No document_ids provided' });
  }

  try {
    let contextText = '';
    let retrieval_mode = USE_GRAPH ? 'graph' : 'chunks';

    let selectedMeta = [];
if (USE_GRAPH) {
  const { contextText: ctx, selected } = await retrieveGraph({
    message,
    document_ids,
    maxSegments: 8,
    expandHops: 1,
    maxCharsPerSegment: 1200
  });
  contextText = ctx || '';
  selectedMeta = selected; // ← add this
}
 else {
      // -------------------------
      // LEGACY CHUNK MODE
      // -------------------------
      // 1. Embedding de la question
      const embedQ = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: message,
        encoding_format: 'float'
      });
      const questionEmbedding = embedQ.data[0].embedding;

      // 2. Récupération des chunks pertinents
      const { data: allChunks, error: fetchErr } = await supabase
        .from('chunks')
        .select('content, embedding, chunk_index, document_id')
        .in('document_id', document_ids);

      if (fetchErr) {
        console.error('❌ Error fetching chunks:', fetchErr.message);
        return res.status(500).json({ error: 'Error fetching chunks' });
      }

      // 3. Similarité cosinus
      const scoredChunks = allChunks.map(chunk => {
        const embedding = Array.isArray(chunk.embedding)
          ? chunk.embedding
          : JSON.parse(chunk.embedding);
        const similarity = cosineSimilarity(questionEmbedding, embedding);
        return { ...chunk, similarity };
      });

      // 4. Top 5
      const topChunks = scoredChunks
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);

      contextText = topChunks.map(c => `Chunk ${c.chunk_index} (doc ${c.document_id}):\n${c.content}`).join('\n\n');
    }

    // 5. Chargement des règles PAN
    const rulesText = rules?.PAN_rules?.instruction_summary || '';

const systemPrompt = `
${rulesText}

Vous êtes un assistant juridique. Toutes vos affirmations **doivent** être strictement fondées sur le contexte fourni ci-dessous.

Règles de fondation (OBLIGATOIRES) :
1) N'utilisez **aucune** connaissance externe au contexte.
2) Si une information demandée **n'apparaît pas** dans le contexte, écrivez clairement : "Les documents fournis ne traitent pas de ce point."
3) Lorsque vous énoncez une règle, citez l'article/source avec les crochets du contexte (ex. 【1】) et le numéro de l'article (ex. art. 20).
4) Évitez toute digression doctrinale/générale qui n'est pas dans le contexte.
`.trim();


    const fullMessage = vulgarisation
      ? "Mode vulgarisation activé. Réponds de manière simple.\n\n" + message
      : message;

    const completion = await openai.chat.completions.create({
  model: 'gpt-3.5-turbo',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content:
`CONTEXTE (numéroté) :
${contextText}

TÂCHE :
${fullMessage}

EXIGENCES DE SORTIE :
- Appuyez chaque règle ou conclusion par une ou plusieurs références aux sources numérotées du contexte (ex. Sources : 【1】, 【3】).
- Si le point n'est pas couvert par le contexte, écrivez : "Les documents fournis ne traitent pas de ce point." et n'ajoutez rien d'externe.
` }
  ]
});

    const aiResponse = completion.choices[0].message.content;
    const responseTime = Date.now() - startTime;

    // 6. Sauvegarde du log
    try {
      const { error: logError } = await supabase
  .from('chat_logs')
  .insert([{
    session_id: session_id || null,
    document_id: document_ids[0],
    user_message: message,
    ai_response: aiResponse,
    response_time_ms: responseTime,
    user_ip: req.ip || req.connection?.remoteAddress,
    user_agent: req.get('User-Agent')
  }]);

      if (logError) console.error('⚠️ Failed to save chat log:', logError.message);
      else console.log('✅ Chat log saved');
    } catch (logErr) {
      console.error('⚠️ Chat logging error:', logErr);
    }

    // 7. Réponse API
    res.json({ reply: aiResponse, response_time_ms: responseTime, retrieval_mode, sources: selectedMeta });


  } catch (err) {
    console.error('❌ /api/chat error:', err);
    res.status(500).json({ error: 'Failed to generate chat response' });
  }
});

module.exports = router;
