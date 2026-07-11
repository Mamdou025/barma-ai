// backend/routes/chat.js
const express = require('express');
const openai = require('../utils/openaiClient');
const { supabase } = require('../utils/supabaseClient');
const { retrieveGraph } = require('../services/retriever_graph'); // graph mode

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

function appendSourcesIfMissing(reply /*, contextText */) {
  // The model cites sources inline with 【n】 when answering from the document, and
  // the UI renders source chips from source_map regardless. We no longer staple a
  // "Sources :" list onto replies that lack citations, since that polluted
  // conversational answers (greetings, clarifying questions) with bogus markers.
  return reply;
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

/* ------------------------------------- Shared pipeline ------------------------------------- */

/**
 * Runs retrieval for the selected documents and builds the numbered context
 * plus the source_map used by the UI. Shared by both the buffered (/chat) and
 * streaming (/chat/stream) endpoints.
 *
 * Returns one of:
 *   { kind: 'context', contextText, retrieval_mode, sourcesUsed, source_map }
 *   { kind: 'empty', reply, retrieval_mode }            // nothing to answer from
 *   { kind: 'error', status, body }                     // upstream failure
 */
async function buildChatContext({ message, document_ids }) {
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
        // How many passages to feed the model. Higher = better recall on large
        // documents (e.g. the 70-article labour code) at the cost of more tokens.
        // Tune via MAX_SEGMENTS in .env without touching code.
        maxSegments: Number(process.env.MAX_SEGMENTS) || 16,
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
          return { kind: 'error', status: 500, body: { error: 'Error fetching document titles' } };
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
        return { kind: 'error', status: 500, body: { error: 'Error fetching chunks' } };
      }

      const chunksArr = Array.isArray(allChunks) ? allChunks : [];
      if (!chunksArr.length) {
        return {
          kind: 'empty',
          retrieval_mode,
          reply: "Aucun ‘chunk’ n’a été trouvé pour ces documents. Veuillez (ré)indexer le document."
        };
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
        return { kind: 'error', status: 500, body: { error: 'Error fetching document titles' } };
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

  return { kind: 'context', contextText, retrieval_mode, sourcesUsed, source_map };
}

/**
 * Builds the OpenAI chat-completion parameters (system + user prompt) shared
 * by the buffered and streaming endpoints. `stream` toggles token streaming.
 */
function buildCompletionParams({ contextText, message, vulgarisation, stream = false }) {
    const systemPrompt = `Vous êtes un assistant juridique conversationnel qui aide l'utilisateur à comprendre ses documents. Écrivez en français, de façon naturelle et directe, comme dans une vraie conversation — sans formules toutes faites répétitives.

- Si l'utilisateur pose une véritable question juridique, répondez de manière complète et précise en vous appuyant sur le CONTEXTE fourni : expliquez la règle, citez les articles pertinents et indiquez la source de chaque affirmation importante avec le format 【n】 (n = numéro du bloc du contexte).
- Fondez vos affirmations juridiques sur le contexte ; n'inventez pas de dispositions qui n'y figurent pas. Si le contexte ne permet pas de répondre, dites-le simplement.
- Si le message est une salutation, une remarque vague ou hors sujet (ex. « allo », « dis-moi quelque chose »), répondez brièvement et naturellement, puis invitez l'utilisateur à préciser ce qu'il souhaite savoir sur le document. Dans ce cas, ne résumez pas des articles au hasard et n'inventez pas de question.`;

    const fullMessage = vulgarisation
      ? "Réponds de manière simple, comme à une personne non-juriste.\n\n" + message
      : message;

  return {
    // gpt-4o-mini: 128k context window, cheaper than gpt-3.5-turbo, better quality.
    // Override with OPENAI_CHAT_MODEL if needed.
    model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
    temperature: 0.5,
    stream,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content:
`CONTEXTE (numéroté, extrait du document) :
${contextText}

MESSAGE DE L'UTILISATEUR :
${fullMessage}

Répondez au message ci-dessus. S'il s'agit d'une question sur le document, appuyez-vous sur le contexte et citez les blocs pertinents avec 【n】 (vous pouvez surligner les termes clés avec <mark>…</mark>). Sinon, répondez simplement et naturellement.`
      }
    ]
  };
}

// Persist a finished exchange to chat_logs (best-effort, never throws).
async function logChat({ req, session_id, document_ids, message, finalReply, responseTime }) {
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
}

// Keep only the sources the model actually cited with 【n】, so the UI shows the
// specific relevant sections instead of every retrieved block. Returns empty when
// the reply cites nothing (e.g. a conversational answer).
function keepCitedSources(reply, sourcesUsed, source_map) {
  const cited = new Set();
  const re = /【(\d+)】/g;
  let m;
  while ((m = re.exec(reply || ''))) cited.add(String(m[1]));

  const sources_used = (sourcesUsed || []).filter(s => cited.has(String(s.marker)));
  const filteredMap = {};
  for (const k of Object.keys(source_map || {})) {
    if (cited.has(k)) filteredMap[k] = source_map[k];
  }
  return { sources_used, source_map: filteredMap };
}

/* ----------------------------------------- Routes ----------------------------------------- */

// Buffered endpoint — returns the full answer in one JSON payload (unchanged behavior).
router.post('/chat', async (req, res) => {
  const { message, document_ids, session_id, vulgarisation = false } = req.body;
  const startTime = Date.now();

  if (!Array.isArray(document_ids) || document_ids.length === 0) {
    return res.status(400).json({ error: 'No document_ids provided' });
  }

  try {
    const ctx = await buildChatContext({ message, document_ids });

    if (ctx.kind === 'error') return res.status(ctx.status).json(ctx.body);
    if (ctx.kind === 'empty') {
      return res.status(200).json({
        reply: ctx.reply,
        response_time_ms: Date.now() - startTime,
        retrieval_mode: ctx.retrieval_mode,
        sources_used: [],
        source_map: {}
      });
    }

    const { contextText, retrieval_mode, sourcesUsed, source_map } = ctx;

    const completion = await openai.chat.completions.create(
      buildCompletionParams({ contextText, message, vulgarisation, stream: false })
    );

    const aiResponse = completion.choices[0].message.content;
    let finalReply = appendSourcesIfMissing(aiResponse, contextText);
    finalReply = ensureHighlights(finalReply);

    // Show only the sections the answer cited.
    const cited = keepCitedSources(finalReply, sourcesUsed, source_map);

    const responseTime = Date.now() - startTime;
    await logChat({ req, session_id, document_ids, message, finalReply, responseTime });

    res.json({
      reply: finalReply,
      response_time_ms: responseTime,
      retrieval_mode,
      sources_used: cited.sources_used,
      source_map: cited.source_map
    });

  } catch (err) {
    console.error('❌ /api/chat error:', err);
    res.status(500).json({ error: 'Failed to generate chat response' });
  }
});

/* ----------------------------------- Streaming endpoint ----------------------------------- */

// Server-Sent Events stream. Emits, in order:
//   event: meta   { retrieval_mode, source_map }   — sent before any token
//   event: delta  { text }                          — one per token chunk
//   event: done   { reply, response_time_ms, sources_used }  — post-processed answer
//   event: error  { error }                         — on failure
router.post('/chat/stream', async (req, res) => {
  const { message, document_ids, session_id, sessionid, vulgarisation = false } = req.body;
  const sid = session_id || sessionid || null;
  const startTime = Date.now();

  if (!Array.isArray(document_ids) || document_ids.length === 0) {
    return res.status(400).json({ error: 'No document_ids provided' });
  }

  // Open the SSE channel.
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable proxy buffering (nginx)
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const ctx = await buildChatContext({ message, document_ids });

    if (ctx.kind === 'error') {
      send('error', ctx.body);
      return res.end();
    }
    if (ctx.kind === 'empty') {
      send('meta', { retrieval_mode: ctx.retrieval_mode, source_map: {} });
      send('delta', { text: ctx.reply });
      send('done', {
        reply: ctx.reply,
        response_time_ms: Date.now() - startTime,
        sources_used: []
      });
      return res.end();
    }

    const { contextText, retrieval_mode, sourcesUsed, source_map } = ctx;

    // Send retrieval metadata up front so the UI can render source chips immediately.
    send('meta', { retrieval_mode, source_map });

    const stream = await openai.chat.completions.create(
      buildCompletionParams({ contextText, message, vulgarisation, stream: true })
    );

    let aiResponse = '';
    for await (const part of stream) {
      const delta = part?.choices?.[0]?.delta?.content || '';
      if (delta) {
        aiResponse += delta;
        send('delta', { text: delta });
      }
    }

    // Post-process the complete answer the same way the buffered route does.
    let finalReply = appendSourcesIfMissing(aiResponse, contextText);
    finalReply = ensureHighlights(finalReply);

    // Now that the answer is known, keep only the sections it actually cited and
    // send the trimmed map in `done` (the UI renders chips from this, not `meta`).
    const cited = keepCitedSources(finalReply, sourcesUsed, source_map);

    const responseTime = Date.now() - startTime;
    await logChat({ req, session_id: sid, document_ids, message, finalReply, responseTime });

    send('done', {
      reply: finalReply,
      response_time_ms: responseTime,
      sources_used: cited.sources_used,
      source_map: cited.source_map
    });
    res.end();

  } catch (err) {
    console.error('❌ /api/chat/stream error:', err);
    // Headers are already sent, so surface the failure over the open SSE channel.
    send('error', { error: 'Failed to generate chat response' });
    res.end();
  }
});

module.exports = router;
