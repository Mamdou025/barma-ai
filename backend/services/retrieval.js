const { openai } = require('../utils/openaiClient.js');
const { supabase } = require('../utils/supabaseClient.js');

/**
 * Classify query intent to narrow candidate document types and roles.
 * @param {string} query
 * @returns {{types: string[], roles: string[]}}
 */
function classifyIntent(query = '') {
  const q = query.toLowerCase();
  const types = new Set();
  const roles = new Set();

  if (/article|statute|law|section|loi/.test(q)) {
    types.add('statute');
    roles.add('article');
  }
  if (/regulation|decree|règlement/.test(q)) {
    types.add('regulation');
    roles.add('article');
  }
  if (/judgment|decision|case|arrêt|jugement/.test(q)) {
    types.add('judgment');
    roles.add('reasons');
    roles.add('disposition');
    roles.add('facts');
  }
  if (/doctrine|commentary|scholar/.test(q)) {
    types.add('doctrine');
    roles.add('body');
    roles.add('conclusion');
  }
  if (/report|recommendation|audit|irregularit/.test(q)) {
    types.add('public_report');
    roles.add('recommendation');
    roles.add('observation');
  }

  if (!types.size) {
    ['statute', 'regulation', 'judgment', 'doctrine', 'public_report'].forEach(t =>
      types.add(t)
    );
  }
  return { types: Array.from(types), roles: Array.from(roles) };
}

/**
 * Hybrid lexical + embedding retrieval on document_segments.
 */
async function hybridRetrieve(query, intent, filters, limit = 20) {
  const baseFilters = { ...filters };
  let lexQb = supabase.from('document_segments').select('*');

  if (intent.types.length) lexQb = lexQb.in('type', intent.types);
  if (intent.roles.length) lexQb = lexQb.in('role', intent.roles);
  Object.entries(baseFilters).forEach(([k, v]) => {
    lexQb = Array.isArray(v) ? lexQb.in(k, v) : lexQb.eq(k, v);
  });

  const lexicalPromise = lexQb.textSearch('text', query, { type: 'websearch' }).limit(limit);

  const embeddingPromise = openai.embeddings
    .create({ model: 'text-embedding-3-small', input: query })
    .then(async ({ data }) => {
      const embedding = data[0].embedding;
      const { data: rows } = await supabase.rpc('match_document_segments', {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: limit,
        filter: { ...baseFilters, type: intent.types, role: intent.roles }
      });
      return rows || [];
    });

  const [{ data: lexicalData }, embData] = await Promise.all([
    lexicalPromise,
    embeddingPromise
  ]);

  const combined = [...(lexicalData || []), ...(embData || [])];
  const dedup = new Map();
  combined.forEach(seg => {
    if (!dedup.has(seg.id)) dedup.set(seg.id, seg);
  });
  return Array.from(dedup.values());
}

/**
 * Expand results via one-hop traversal of kg_edges.
 */
async function expandWithKG(segments, intent) {
  if (!segments.length) return segments;
  const segIds = segments.map(s => s.id).filter(Boolean);
  const { data: edges } = await supabase
    .from('kg_edges')
    .select('*')
    .in('src_segment_id', segIds);

  const dstSegIds = edges.map(e => e.dst_segment_key).filter(Boolean);
  const dstDocIds = edges.map(e => e.dst_doc_key).filter(Boolean);

  let extra = [];
  if (dstSegIds.length) {
    const { data } = await supabase
      .from('document_segments')
      .select('*')
      .in('id', dstSegIds);
    extra = extra.concat(data || []);
  }
  if (dstDocIds.length) {
    let qb = supabase.from('document_segments').select('*').in('doc_id', dstDocIds);
    if (intent.roles.length) qb = qb.in('role', intent.roles);
    const { data } = await qb;
    extra = extra.concat(data || []);
  }

  const edgeMap = {};
  edges.forEach(e => {
    const key = e.dst_segment_key || e.dst_doc_key;
    if (!edgeMap[key]) edgeMap[key] = [];
    edgeMap[key].push(e);
  });

  const merged = [...segments, ...extra];
  return merged.map(seg => ({ ...seg, _edges: edgeMap[seg.id] || [] }));
}

/**
 * Simple re-ranking with custom scoring rules.
 */
function rerank(segments, intent) {
  return segments
    .map(seg => {
      let score = seg.similarity || 0;

      if (intent.roles.includes(seg.role)) score += 5;
      if (seg._edges && seg._edges.length) score += 2;
      if (seg.metadata?.in_force) score += 1;
      if (seg.metadata?.amounts?.length) score += 0.5;
      if (seg.metadata?.date) {
        const ageYears =
          (Date.now() - new Date(seg.metadata.date)) / (365 * 24 * 3600 * 1000);
        score += Math.max(0, 2 - ageYears);
      }

      return { ...seg, score };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Build a minimal citations map for returned segments.
 */
function buildCitationsMap(segments) {
  const map = {};
  segments.forEach(seg => {
    map[seg.id] = {
      cases_cited: seg.metadata?.cases_cited || [],
      statutes_cited: seg.metadata?.statutes_cited || [],
      cross_refs: seg.metadata?.cross_refs || []
    };
  });
  return map;
}

/**
 * Retrieve top-N segments for a query with optional filters.
 * @param {{query: string, filters?: object, topN?: number}} param0
 * @returns {Promise<{segments: object[], citations: object}>}
 */
async function retrieveByQuery({ query, filters = {}, topN = 10 }) {
  const intent = classifyIntent(query);
  let segments = await hybridRetrieve(query, intent, filters);
  segments = await expandWithKG(segments, intent);
  const ranked = rerank(segments, intent);
  const topSegments = ranked.slice(0, topN);
  return {
    segments: topSegments,
    citations: buildCitationsMap(topSegments)
  };
}

module.exports = { retrieveByQuery };
