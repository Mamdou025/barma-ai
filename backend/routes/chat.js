const express = require('express');
const openai = require('../utils/openaiClient');
const { supabase } = require('../utils/supabaseClient');
const { getRules } = require('../utils/rulesLoader');
const { retrieveGraph } = require('../services/retriever_graph'); // ← NEW

const rules = getRules();
const router = express.Router();
const USE_GRAPH = String(process.env.USE_GRAPH_RETRIEVAL || '').toLowerCase() === 'true';


function hasBracketCitations(s) {
  return /【\d+】/.test(s || '');
}
function extractContextMarkers(s) {
  const set = new Set();
  const re = /【(\d+)】/g;
  let m;
  while ((m = re.exec(s || ''))) set.add(Number(m[1]));
  return Array.from(set).sort((a, b) => a - b);
}
function appendSourcesIfMissing(reply, contextText) {
  if (hasBracketCitations(reply)) return reply;
  const nums = extractContextMarkers(contextText);
  if (!nums.length) return reply;
  return reply + `\n\nSources : ` + nums.map(n => `【${n}】`).join(', ');
}

function buildNumberedContextAndSources({ chunks, docsById }) {
  const blocks = [];
  const sourcesUsed = [];

  chunks.forEach((chunk, i) => {
    const marker = i + 1;
    const doc = docsById[chunk.document_id] || {};
    const docTitle = doc.title || `Document ${chunk.document_id}`;
    const header = `:codex-terminal-citation[codex-terminal-citation]{line_range_start=64 line_range_end=70 terminal_chunk_id=${marker}} ${docTitle} — chunk ${chunk.chunk_index}`;

    blocks.push(`${header}\n${chunk.content}`);
    sourcesUsed.push({
      marker,
      doc_id: chunk.document_id,
      doc_title: docTitle,
      ref: String(chunk.chunk_index),
      text_preview: chunk.content.slice(0, 100)
    });
  });

  return { contextText: blocks.join('\n\n'), sourcesUsed };
}





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
    let sourcesUsed = [];

if (USE_GRAPH) {
  const { contextText: ctx } = await retrieveGraph({
    message,
    document_ids,
    maxSegments: 8,
    expandHops: 1,
    maxCharsPerSegment: 1200
  });
  contextText = ctx || '';
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

      const docIds = topChunks.map(c => c.document_id);
      const { data: docs, error: docsErr } = await supabase
        .from('documents')
        .select('id, title')
        .in('id', docIds);
      if (docsErr) {
        console.error('❌ Error fetching document titles:', docsErr.message);
        return res.status(500).json({ error: 'Error fetching document titles' });
      }
      const docsById = {};
      (docs || []).forEach(d => {
        docsById[d.id] = d;
      });

      ({ contextText, sourcesUsed } = buildNumberedContextAndSources({
        chunks: topChunks,
        docsById
      }));
    }

    // 5. Chargement des règles PAN
    const rulesText = rules?.PAN_rules?.instruction_summary || '';

const systemPrompt = `
${rulesText}

Vous êtes un assistant juridique. Toutes vos affirmations **doivent** être strictement fondées sur le contexte fourni.

RÈGLES OBLIGATOIRES
1) N'utilisez **aucune** connaissance externe au contexte.
2) Si un point n'est **pas** dans le contexte, écrivez : "Les documents fournis ne traitent pas de ce point."
3) À chaque règle ou conclusion, citez vos sources avec le format 【n】 (n = le numéro du bloc du contexte) et, si possible, l'article (ex. art. 20).
4) Pas de digressions doctrinales/générales non présentes dans le contexte.
`.trim();



    const fullMessage = vulgarisation
      ? "Mode vulgarisation activé. Réponds de manière simple.\n\n" + message
      : message;

const completion = await openai.chat.completions.create({
  model: 'gpt-3.5-turbo',
  temperature: 0.2,            // ← tighter, follows format better
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content:
`CONTEXTE (numéroté) :
${contextText}

TÂCHE :
${fullMessage}

FORMAT DE SORTIE (exemple) :
- Préavis : 2 semaines (cadres : 3 semaines) — art. 10 【1】
- Notification écrite, effet le lendemain — art. 20 【2】
- Majoration : +1 semaine/an après 2 ans, max 6 — art. 11 【3】
- Exceptions : faute grave (aucun préavis) — art. 12 【4】 ; période d’essai 3 mois — art. 12.1 【5】
- Indemnité si non-respect du préavis — art. 30 【6】

RÈGLES :
- Chaque ligne DOIT contenir au moins un marqueur de source 【n】 correspondant au CONTEXTE.
- Si le point n'est pas couvert par le contexte, écrivez : "Les documents fournis ne traitent pas de ce point." et n'ajoutez rien d'externe.
- Mettez en évidence les règles/conclusions clés avec <mark> … </mark>.`
    }
  ]
});



    const aiResponse = completion.choices[0].message.content;
const finalReply = appendSourcesIfMissing(aiResponse, contextText);

    const responseTime = Date.now() - startTime;

    // 6. Sauvegarde du log
    try {
      const { error: logError } = await supabase
  .from('chat_logs')
  .insert([{
    session_id: session_id || null,
    document_id: document_ids[0],
    user_message: message,
    ai_response: finalReply,
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
    res.json({ reply: finalReply, response_time_ms: responseTime, retrieval_mode, sources_used: sourcesUsed });


  } catch (err) {
    console.error('❌ /api/chat error:', err);
    res.status(500).json({ error: 'Failed to generate chat response' });
  }
});

module.exports = router;
