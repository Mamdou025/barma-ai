const express = require('express');
const openai = require('../utils/openaiClient');
const { supabase } = require('../utils/supabaseClient');
const { getRules } = require('../utils/rulesLoader');
const { retrieveByQuery } = require('../services/retrieval');

const rules = getRules(); // Charge le fichier rules.yml une seule fois
const router = express.Router();

// Utilitaire de similarité
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (normA * normB);
}

router.post('/chat', async (req, res) => {
  const { message, session_id, vulgarisation = false } = req.body;
  let document_ids = req.body.document_ids || req.body.documentIds || [];
  const startTime = Date.now();

  try {
    if (!Array.isArray(document_ids) || document_ids.length === 0) {
      const { data: docs, error: docsError } = await supabase
        .from('documents')
        .select('id');

      if (docsError) {
        console.error('❌ Error fetching document IDs:', docsError.message);
        return res.status(500).json({ error: 'Error fetching document IDs' });
      }

      document_ids = docs.map(d => d.id);
      res.locals.usedAllDocs = true;
    }

    // 1. Chargement des règles PAN
    const rulesText = rules?.PAN_rules?.instruction_summary || '';

    const baseSystemPrompt = `
${rulesText}

Vous êtes un assistant juridique formé pour répondre aux questions de manière claire et précise.

Vous pouvez utiliser un raisonnement général, mais toutes les conclusions juridiques doivent être fondées sur les documents juridiques fournis.

Répondez uniquement aux questions en utilisant le contexte extrait des documents sources vérifiés.

Si aucune source n'est fournie, indiquez-le clairement. Ne devinez jamais et n'inventez jamais d'informations juridiques.
    `.trim();

    const fullMessage = vulgarisation
      ? "Mode vulgarisation activé. Réponds de manière simple.\n\n" + message
      : message;

    let messages = [];

    // Par défaut, on interroge les "document_segments". 
    // Définir RAG_V2=0 pour utiliser l'ancien mode basé sur "chunks".
    if (process.env.RAG_V2 !== '0') {
      const { segments } = await retrieveByQuery({
        query: message,
        filters: req.body?.filters || {}
      });
      const contextText = segments
        .map(seg => `[${seg.type}:${seg.role}] ${seg.text}`)
        .join('\n\n');
      const citationIds = segments.map(seg => seg.id).join(', ');

      messages = [
        { role: 'system', content: `Context retrieved (citations: ${citationIds}):\n${contextText}` },
        { role: 'system', content: baseSystemPrompt },
        { role: 'user', content: fullMessage }
      ];
    } else {
      // 2. Embedding de la question
      const embedQ = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: message,
        encoding_format: 'float'
      });

      const questionEmbedding = embedQ.data[0].embedding;

      // 3. Récupération des chunks pertinents
      const { data: allChunks, error: fetchErr } = await supabase
        .from('chunks')
        .select('content, embedding, chunk_index, document_id')
        .in('document_id', document_ids);

      if (fetchErr) {
        console.error('❌ Error fetching chunks:', fetchErr.message);
        return res.status(500).json({ error: 'Error fetching chunks' });
      }

      // 4. Similarité cosinus
      const scoredChunks = allChunks.map(chunk => {
        const embedding = Array.isArray(chunk.embedding)
          ? chunk.embedding
          : JSON.parse(chunk.embedding);
        const similarity = cosineSimilarity(questionEmbedding, embedding);
        return { ...chunk, similarity };
      });

      // 5. Top 5
      const topChunks = scoredChunks
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);

      const contextText = topChunks
        .map(c => `Chunk ${c.chunk_index}:\n${c.content}`)
        .join('\n\n');

      messages = [
        { role: 'system', content: baseSystemPrompt },
        {
          role: 'user',
          content: `Here is some context:\n\n${contextText}\n\nNow answer this question:\n${fullMessage}`
        }
      ];
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages
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
          user_ip: req.ip || req.connection.remoteAddress,
          user_agent: req.get('User-Agent')
        }]);

      if (logError) {
        console.error('⚠️ Failed to save chat log:', logError.message);
      } else {
        console.log('✅ Chat log saved');
      }
    } catch (logErr) {
      console.error('⚠️ Chat logging error:', logErr);
    }

    // 7. Réponse API
    res.json({
      reply: aiResponse,
      response_time_ms: responseTime,
      used_all_documents: !!res.locals.usedAllDocs
    });

  } catch (err) {
    console.error('❌ OpenAI error:', err);
    res.status(500).json({ error: 'Failed to generate chat response' });
  }
});

module.exports = router;
