// backend/routes/chat.js
const express = require('express');
const openai = require('../utils/openaiClient');
const { supabase } = require('../utils/supabaseClient');
const { getRules } = require('../utils/rulesLoader');
const { retrieveGraph } = require('../services/retriever_graph'); // graph mode

const rules = getRules();
const router = express.Router();
const USE_GRAPH = String(process.env.USE_GRAPH_RETRIEVAL || '').toLowerCase() === 'true';

/* --------------------------------- Highlight helpers --------------------------------- */

function ensureHighlights(reply) {
  if (/<mark>/.test(reply || '')) return reply; // already highlighted
  let r = reply || '';

  // Mark key legal tokens (cap at ~6 inserts to avoid over-highlighting).
  const patterns = [
    /\b(art\.?\s*\d+(?:\.\d+)?(?:\s*[,–-]\s*\d+(?:\.\d+)?)?)\b/gi, // art. 10 / art. 12.1 / art. 12–12.3
    /\bArticle\s+\d+(?:\.\d+)?\b/gi,
    /\b(préavis|notification|indemnité|faute grave|période d[’']essai)\b/gi,
    /\b(\+?\d+\s*semaines?)\b/gi,
    /\b(entre en vigueur|entrée en vigueur)\b/gi
  ];

  let replacements = 0;
  for (const re of patterns) {
    r = r.replace(re, (m) => {
      if (replacements >= 6) return m;
      replacements++;
      return `<mark>${m}</mark>`;
    });
    if (replacements >= 6) break;
  }
  return r;
}

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

// Fallback for graph contexts that don’t include sourcesUsed
function extractMarkersFromGraphContext(ctx = '') {
  const markers = new Set();
  // Accept either “terminal_chunk_id=#” (if present) or plain 【#】
  const re1 = /terminal_chunk_id=(\d+)/g;
  let m;
  while ((m = re1.exec(ctx))) markers.add(Number(m[1]));
  const re2 = /【(\d+)】/g;
  while ((m = re2.exec(ctx))) markers.add(Number(m[1]));
  return Array.from(markers).sort((a, b) => a - b);
}

/* --------------------------------- Context builders --------------------------------- */

function buildNumberedContextAndSources({ chunks, docsById }) {
  const blocks = [];
  const sourcesUsed = [];

  chunks.forEach((chunk, i) => {
    const marker = i + 1;
    const doc = docsById[chunk.document_id] || {};
    const docTitle = doc.title || `Document ${chunk.document_id}`;
    const header = `【${marker}】 ${docTitle} — chunk ${i}`;
    blocks.push(`${header}\n${chunk.content}`);

    sourcesUsed.push({
      marker,
      doc_id: chunk.document_id,
      doc_title: docTitle,
      ref: String(i),
      text_preview: chunk.content.slice(0, 100)
    });
  });

  return { contextText: blocks.join('\n\n'), sourcesUsed };
}

function buildSourceMap({ sourcesUsed, docsById }) {
  const map = {};
  for (const s of (sourcesUsed || [])) {
    const d = (docsById && s.doc_id) ? (docsById[s.doc_id] || {}) : {};
    map[String(s.marker)] = {
      doc_id: s.doc_id || null,
      doc_title: d.title || s.doc_title || (s.doc_id ? `Document ${s.doc_id}` : 'Document'),
      storage_url: d.storage_url || null,
      ref: s.ref || s.seg_id || null,
      section_path: s.section_path || null,
      text_preview: s.text_preview || null
    };
  }
  return map;
}

/* ------------------------------- Legacy util (chunks) ------------------------------- */

function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (normA * normB || 1e-8);
}

/* ----------------------------------------- Route ----------------------------------------- */

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
    let source_map = {};

    if (USE_GRAPH) {
      // GRAPH MODE
      const {
        contextText: ctx,
        sourcesUsed: graphSources = [],
        docIds: graphDocIds = []
      } = await retrieveGraph({
        message,
        document_ids,
        maxSegments: 8,
        expandHops: 1,
        maxCharsPerSegment: 1200
      });

      contextText = ctx || '';
      sourcesUsed = Array.isArray(graphSources) ? graphSources : [];

      // Determine which doc ids to fetch
      const ids = (graphDocIds && graphDocIds.length)
        ? Array.from(new Set(graphDocIds))
        : Array.from(new Set(sourcesUsed.map(s => s.doc_id))).filter(Boolean);

      // If nothing came back, try to parse markers and fallback to first selected doc
      const markers = sourcesUsed.length ? sourcesUsed.map(s => s.marker).filter(Boolean)
                                         : extractMarkersFromGraphContext(contextText);

      const fallbackDocId = document_ids[0] || null;
      if (!sourcesUsed.length && markers.length) {
        sourcesUsed = markers.map(n => ({ marker: n, doc_id: fallbackDocId, ref: null, text_preview: null }));
      }

      let docsById = {};
      if (ids.length) {
        const { data: docs, error: docsErr } = await supabase
          .from('documents')
          .select('id, title:name, storage_url')
          .in('id', ids);
        if (docsErr) {
          console.error('❌ Error fetching document titles:', docsErr.message);
          return res.status(500).json({ error: 'Error fetching document titles' });
        }
        (docs || []).forEach(d => { docsById[d.id] = d; });
      } else if (fallbackDocId) {
        // Single-doc fallback fetch
        const { data: oneDoc } = await supabase
          .from('documents')
          .select('id, title:name, storage_url')
          .eq('id', fallbackDocId)
          .maybeSingle();
        if (oneDoc) docsById[oneDoc.id] = oneDoc;
      }

      source_map = buildSourceMap({ sourcesUsed, docsById });

    } else {
      // ------------------------- LEGACY CHUNK MODE -------------------------
      // 1) Embed question
      const embedQ = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: message,
        encoding_format: 'float'
      });
      const questionEmbedding = embedQ.data[0].embedding;

      // 2) Fetch chunks for selected docs
      const { data: allChunks, error: fetchErr } = await supabase
        .from('document_chunks')
        .select('content, embedding, document_id')
        .in('document_id', document_ids);

      if (fetchErr) {
        console.error('❌ Error fetching chunks:', fetchErr.message);
        return res.status(500).json({ error: 'Error fetching chunks' });
      }

      const chunksArr = Array.isArray(allChunks) ? allChunks : [];
      if (!chunksArr.length) {
        return res.status(200).json({
          reply: "Aucun ‘chunk’ n’a été trouvé pour ces documents. Veuillez (ré)indexer le document.",
          response_time_ms: Date.now() - startTime,
          retrieval_mode,
          sources_used: [],
          source_map: {}
        });
      }

      // 3) Similarity
      const scoredChunks = chunksArr.map(chunk => {
        const embedding = Array.isArray(chunk.embedding)
          ? chunk.embedding
          : (typeof chunk.embedding === 'string' ? JSON.parse(chunk.embedding) : []);
        const similarity = cosineSimilarity(questionEmbedding, embedding);
        return { ...chunk, similarity };
      });

      // 4) Top 5
      const topChunks = scoredChunks
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);

      // 5) Fetch doc metadata (title + storage_url)
      const docIds = Array.from(new Set(topChunks.map(c => c.document_id)));
      const { data: docs, error: docsErr } = await supabase
        .from('documents')
        .select('id, title:name, storage_url')
        .in('id', docIds);

      if (docsErr) {
        console.error('❌ Error fetching document titles:', docsErr.message);
        return res.status(500).json({ error: 'Error fetching document titles' });
      }
      const docsById = {};
      (docs || []).forEach(d => { docsById[d.id] = d; });

      // 6) Numbered context + sources
      ({ contextText, sourcesUsed } = buildNumberedContextAndSources({
        chunks: topChunks,
        docsById
      }));

      // 7) Build source_map for UI chips
      source_map = buildSourceMap({ sourcesUsed, docsById });
    }

    // 8) Rules
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

    // 9) Completion
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content:
`CONTEXTE (numéroté) :
${contextText}

TÂCHE :
${fullMessage}

FORMAT DE SORTIE (exemple) :
- <mark>Préavis</mark> : 2 semaines (cadres : 3 semaines) — art. 10 【1】
- <mark>Notification écrite</mark>, effet le lendemain — art. 20 【2】
- <mark>Majoration</mark> : +1 semaine/an après 2 ans, max 6 — art. 11 【3】
- Exceptions : <mark>faute grave</mark> (aucun préavis) — art. 12 【4】 ; période d’essai 3 mois — art. 12.1 【5】
- Indemnité si non-respect du préavis — art. 30 【6】

RÈGLES :
- Entourez les points clés (termes, chiffres, articles) avec la balise <mark>…</mark> (max 6).
- Chaque ligne DOIT contenir au moins un marqueur de source 【n】 correspondant au CONTEXTE.
- Si le point n'est pas couvert par le contexte, écrivez : "Les documents fournis ne traitent pas de ce point."`
        }
      ]
    });

    const aiResponse = completion.choices[0].message.content;
    let finalReply = appendSourcesIfMissing(aiResponse, contextText);
    finalReply = ensureHighlights(finalReply);

    const responseTime = Date.now() - startTime;

    // 10) Save log (best-effort)
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

    // 11) API response (includes source_map for clickable chips)
    res.json({
      reply: finalReply,
      response_time_ms: responseTime,
      retrieval_mode,
      sources_used: sourcesUsed,
      source_map
    });

  } catch (err) {
    console.error('❌ /api/chat error:', err);
    res.status(500).json({ error: 'Failed to generate chat response' });
  }
});

module.exports = router;
