// backend/services/retriever_graph.js
const { supabase } = require('../utils/supabaseClient');
const openai = require('../utils/openaiClient');
const { segmentWholeDocument } = require('./segmenter');

function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((s, ai) => s + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((s, bi) => s + bi * bi, 0));
  return dot / (normA * normB || 1e-8);
}

function normalizeWhitespace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function compareArtNums(a, b) {
  // Compare "12.3" vs "12.10" numerically per component
  const pa = String(a).split('.').map(x => parseInt(x, 10));
  const pb = String(b).split('.').map(x => parseInt(x, 10));
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const ai = pa[i] ?? 0, bi = pb[i] ?? 0;
    if (ai !== bi) return ai - bi;
  }
  return 0;
}

function parseArtFromToRef(toRef) {
  // ex: "art.12.3", "art.12–art.12.3", "art.20.al.3", "art.1457 — Code civil du Québec"
  const simple = /art\.(\d+(?:\.\d+)*)(?:\.al\.\d+)?/i.exec(toRef);
  return simple ? simple[1] : null;
}

function parseRangeFromToRef(toRef) {
  // ex: "art.12–art.12.3"
  const m = /art\.(\d+(?:\.\d+)*)\s*[–-]\s*art\.(\d+(?:\.\d+)*)/i.exec(toRef);
  return m ? { from: m[1], to: m[2] } : null;
}

function resolveRange(range, segmentsByNum) {
  const keys = Object.keys(segmentsByNum).sort((a, b) => compareArtNums(a, b));
  const out = [];
  for (const k of keys) {
    if (compareArtNums(k, range.from) >= 0 && compareArtNums(k, range.to) <= 0) {
      out.push(segmentsByNum[k]);
    }
  }
  return out;
}

// Canonical form of an article number for matching: uppercase, strip everything
// but letters/digits. "L.29" -> "L29", "L. 29" -> "L29", "105" -> "105".
function canonArticle(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Build a lookup: canonical article number -> segment id. Also indexes the
// bare-digit form (e.g. "L.20" -> both "L20" and "20") so "art. 20" can resolve
// to "L.20" in codes that prefix their articles.
function buildCanonArticleIndex(segmentsByNumByDoc) {
  const index = {};
  for (const byNum of Object.values(segmentsByNumByDoc || {})) {
    for (const [num, segId] of Object.entries(byNum)) {
      const canon = canonArticle(num);
      if (canon && !(canon in index)) index[canon] = segId;
      const bare = canon.replace(/^[A-Z]+/, '');
      if (bare && bare !== canon && !(bare in index)) index[bare] = segId;
    }
  }
  return index;
}

// Extract article references the user names in a query, as canonical numbers.
// Accepts "article L.29", "art. L 29", "L.29", "L29", "art 20", "article 105".
// A bare number is only treated as a reference when preceded by art/article or a
// letter prefix, so "délai de 15 jours" does not match article 15.
function parseArticleRefs(query) {
  const refs = new Set();
  const re = /(art(?:icle)?s?\.?\s*)?\b(LO|LP|LR|L|R|D|A)?\.?\s?(\d+(?:\.\d+)*)\b/gi;
  let m;
  while ((m = re.exec(query || '')) !== null) {
    const hasKeyword = !!m[1];
    const prefix = (m[2] || '').toUpperCase();
    if (!hasKeyword && !prefix) continue; // bare number without context: skip
    refs.add(canonArticle(prefix + m[3]));
  }
  return refs;
}

async function embedBatch(texts, model = 'text-embedding-3-small') {
  // Batch embed up to a few hundred short segments
  const resp = await openai.embeddings.create({
    model,
    input: texts,
    encoding_format: 'float'
  });
  return resp.data.map(d => d.embedding);
}

function buildContextBlock(seg, idx, docTitle, maxBodyChars = 8000) {
  const headerLeft = seg.section_path
    ? seg.section_path
    : seg.label ? seg.label.toUpperCase() : 'SEGMENT';
  const header = `【${idx}】${docTitle ? docTitle + ' — ' : ''}${headerLeft} (${seg.id})`;
  let body = (seg.text || '').trim();
  // Bound each segment so a few large legal sections can't overflow the model's
  // context window (gpt-3.5-turbo = 16k tokens). The full text still lives in the
  // source document; this only limits what is inlined into the prompt.
  if (body.length > maxBodyChars) body = body.slice(0, maxBodyChars).trimEnd() + ' […]';
  return `${header}\n${body}`;
}

function collectCitationsFor(seg, allEdges) {
  const cites = allEdges.filter(e => e.from === seg.id && (e.type === 'citesCase' || e.type === 'citesStatute'));
  if (!cites.length) return '';
  const lines = cites.map(e => {
    let surface = normalizeWhitespace(e.surface);
    return `- ${e.type === 'citesCase' ? 'Cause' : 'Disposition'}: ${surface} (${e.to_ref})`;
  }).join('\n');
  return `\n\nCitations détectées:\n${lines}`;
}

async function retrieveGraph({ message, document_ids, maxSegments = 8, expandHops = 1, maxCharsPerSegment = 1200 }) {
  // 1) Load docs
  const { data: docs, error } = await supabase
    .from('documents')
    .select('id, name, full_text')
    .in('id', document_ids);

  if (error) {
    throw new Error(`Supabase fetch documents failed: ${error.message}`);
  }

  // 2) Segment each doc (preview-only) and prepare candidates
  const allCandidates = [];  // { seg, docId, docTitle, edges, num }
  const edgesByDoc = {};
  const segmentsByNumByDoc = {};

  for (const d of docs) {
    const payload = segmentWholeDocument({
      documentId: d.id,
      title: d.name,
      text: d.full_text || '',
      maxPreviewChars: 200000
    });

    const segs = payload.segments || [];
    const edges = payload.edges || [];
    edgesByDoc[d.id] = edges;

    // Index by article number when available (Lois & règlements)
    const byNum = {};
    for (const s of segs) {
      const num = s?.meta?.number || null;
      if (num) byNum[num] = s.id;
      allCandidates.push({
        seg: s,
        num,
        docId: d.id,
        docTitle: d.name || ''
      });
    }
    segmentsByNumByDoc[d.id] = byNum;
  }

  if (!allCandidates.length) {
    return { contextText: '', selected: [], debug: { reason: 'no_segments' } };
  }

  // 3) Embed query and segments
  const qResp = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: message,
    encoding_format: 'float'
  });
  const qVec = qResp.data[0].embedding;

  // To keep costs bounded, embed only the first N chars per segment
  const texts = allCandidates.map(c => (c.seg.text || '').slice(0, maxCharsPerSegment));
  const segVecs = await embedBatch(texts);

  // 4) Score and pick seeds
  const scored = allCandidates.map((c, i) => ({
    ...c,
    sim: cosineSimilarity(qVec, segVecs[i])
  })).sort((a, b) => b.sim - a.sim);

  // Seed with most of the top similarity matches (not just 3–5) so recall scales
  // with maxSegments; edge expansion then adds cross-referenced neighbours, and
  // the final list is capped at maxSegments in step 6.
  const seedCount = Math.max(5, Math.ceil(maxSegments * 0.75));
  const simSeeds = scored.slice(0, Math.min(seedCount, scored.length));

  // Direct article-number lookup. Embeddings match on topic, not on article
  // number, so a query like "parle-moi de l'article L.29" rarely surfaces L.29 by
  // similarity. If the question names specific articles, force-include the exact
  // matching segments as seeds.
  const scoredById = new Map(scored.map(c => [c.seg.id, c]));
  const canonIndex = buildCanonArticleIndex(segmentsByNumByDoc);
  const forced = [];
  for (const canon of parseArticleRefs(message)) {
    const segId = canonIndex[canon];
    const c = segId && scoredById.get(segId);
    if (c) forced.push(c);
  }

  // Forced article matches first, then similarity seeds (deduped by segment id).
  const seeds = [];
  const seedIds = new Set();
  for (const c of [...forced, ...simSeeds]) {
    if (!seedIds.has(c.seg.id)) { seedIds.add(c.seg.id); seeds.push(c); }
  }

  // 5) Expand via edges (1 hop by default)
  const selectedMap = new Map();
  function select(c, why) {
    if (!selectedMap.has(c.seg.id)) selectedMap.set(c.seg.id, { ...c, why });
  }

  seeds.forEach(s => select(s, 'seed'));

  for (const seed of seeds) {
    const docEdges = edgesByDoc[seed.docId] || [];
    const byNum = segmentsByNumByDoc[seed.docId] || {};
    const seedId = seed.seg.id;

    // Outgoing
    for (const e of docEdges.filter(e => e.from === seedId)) {
      if (e.type === 'refersTo') {
        if (e.to) {
          const c = allCandidates.find(x => x.seg.id === e.to);
          if (c) select(c, 'edge:refersTo');
        } else {
          const art = parseArtFromToRef(e.to_ref || '');
          if (art && byNum[art]) {
            const cid = byNum[art];
            const c = allCandidates.find(x => x.seg.id === cid);
            if (c) select(c, 'edge:refersTo(to_ref)');
          }
        }
      } else if (e.type === 'refersToRange') {
        const r = parseRangeFromToRef(e.to_ref || '');
        if (r) {
          const ids = resolveRange(r, byNum);
          ids.forEach(id => {
            const c = allCandidates.find(x => x.seg.id === id);
            if (c) select(c, 'edge:refersToRange');
          });
        }
      }
      // citations in jurisprudence do not add segments; they are included as metadata
    }

    // Incoming (who points to me)
    for (const e of docEdges.filter(e => e.to === seedId)) {
      const c = allCandidates.find(x => x.seg.id === e.from);
      if (c) select(c, 'edge:incoming');
    }
  }

  // 6) Rank selected: seeds first by sim, then neighbors by sim
  const selected = Array.from(selectedMap.values())
    .sort((a, b) => {
      const aw = a.why === 'seed' ? 1 : 0;
      const bw = b.why === 'seed' ? 1 : 0;
      if (aw !== bw) return bw - aw; // seeds first
      return b.sim - a.sim;
    })
    .slice(0, maxSegments);

  // 7) Build context text with small headers + citations
  const blocks = [];
  selected.forEach((c, i) => {
    let block = buildContextBlock(c.seg, i + 1, c.docTitle);
    const cites = collectCitationsFor(c.seg, edgesByDoc[c.docId] || []);
    if (cites) block += cites;
    blocks.push(block);
  });

  const contextText = blocks.join('\n\n' + '-'.repeat(60) + '\n\n');

  // Per-section sources, one per numbered context block (marker = block number).
  // Carries the real per-segment docId + article/section label so the UI can show
  // "【2】 Article L.29" instead of just the file name, and so the caller can keep
  // only the sections the model actually cites.
  const sourcesUsed = selected.map((c, i) => ({
    marker: i + 1,
    doc_id: c.docId,
    seg_id: c.seg.id,
    ref: c.seg?.meta?.number || null,
    section_path: c.seg.section_path || null,
    text_preview: (c.seg.text || '').slice(0, 120),
  }));
  const docIds = Array.from(new Set(selected.map(c => c.docId)));

  return {
    contextText,
    sourcesUsed,
    docIds,
    selected: selected.map(s => ({ id: s.seg.id, docId: s.docId, sim: s.sim, why: s.why })),
    debug: { seeds: seeds.map(s => ({ id: s.seg.id, sim: s.sim })) }
  };
}

module.exports = { retrieveGraph };
