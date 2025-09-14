const { randomUUID } = require('crypto');

/**
 * Build knowledge‑graph edges out of segment metadata.
 *
 * @param {Array<Object>} segments
 * @returns {{edges: Array<Object>, unresolved: Array<Object>}}
 */
function extractAndBuildEdges(segments = []) {
  const edges = [];
  const unresolved = [];

  const pushEdge = ({ src, rel, dstKey, dstType, dstSegmentKey, payload }) => {
    if (!dstKey) {
      unresolved.push({
        src_doc_id: src.doc_id,
        src_segment_id: src.segment_id,
        rel,
        target: dstKey
      });
      return;
    }
    edges.push({
      id: randomUUID(),
      src_doc_id: src.doc_id,
      src_segment_id: src.segment_id,
      src_type: src.type,
      rel,
      dst_doc_key: dstKey,
      dst_segment_key: dstSegmentKey || null,
      dst_type: dstType || null,
      payload_json: payload ? JSON.stringify(payload) : null
    });
  };

  segments.forEach((seg) => {
    const { doc_id, type, role, metadata = {} } = seg;
    const src = {
      doc_id,
      segment_id: metadata.segment_id || metadata.id || null,
      type
    };

    // --- Case / Judgment ↔ other cases & statutes ---
    if (['case', 'judgment'].includes(type)) {
      (metadata.cases_cited || []).forEach((ref) =>
        pushEdge({ src, rel: 'cites', dstKey: ref, dstType: 'CASE' })
      );
      (metadata.cases_distinguished || []).forEach((ref) =>
        pushEdge({ src, rel: 'distinguishes', dstKey: ref, dstType: 'CASE' })
      );
      (metadata.cases_followed || []).forEach((ref) =>
        pushEdge({ src, rel: 'follows', dstKey: ref, dstType: 'CASE' })
      );
      (metadata.cases_overruled || []).forEach((ref) =>
        pushEdge({ src, rel: 'overrules', dstKey: ref, dstType: 'CASE' })
      );
      (metadata.statutes_interpreted || []).forEach((ref) =>
        pushEdge({ src, rel: 'interprets', dstKey: ref, dstType: 'STATUTE:Article' })
      );
      (metadata.statutes_applied || []).forEach((ref) =>
        pushEdge({ src, rel: 'applies', dstKey: ref, dstType: 'STATUTE:Article' })
      );
    }

    // --- Regulations implementing statutes ---
    if (['regulation', 'reg'].includes(type)) {
      (metadata.statutes_implemented || []).forEach((ref) =>
        pushEdge({ src, rel: 'implements', dstKey: ref, dstType: 'STATUTE:Article' })
      );
    }

    // --- Statute cross‑references ---
    if (['statute', 'loi'].includes(type)) {
      (metadata.cross_refs || []).forEach((ref) =>
        pushEdge({ src, rel: 'refersTo', dstKey: ref, dstType: 'STATUTE:Article' })
      );
    }

    // --- Doctrinal commentary ---
    if (['commentary', 'doctrine'].includes(type)) {
      (metadata.cases_cited || []).forEach((ref) =>
        pushEdge({ src, rel: 'discusses', dstKey: ref, dstType: 'CASE' })
      );
      (metadata.statutes_cited || []).forEach((ref) =>
        pushEdge({ src, rel: 'interprets', dstKey: ref, dstType: 'STATUTE:Article' })
      );
      (metadata.commentaries_cited || []).forEach((ref) =>
        pushEdge({ src, rel: 'cites', dstKey: ref, dstType: 'COMMENTARY' })
      );
    }

    // --- Public audit reports ---
    if (['public_report', 'report'].includes(type)) {
      const entities = metadata.entities_mentioned || [];
      const irregularities = metadata.irregularities || [];

      entities.forEach((ent) =>
        pushEdge({
          src,
          rel: role === 'recommendation' ? 'targets' : 'covers',
          dstKey: ent,
          dstType: 'ENTITY'
        })
      );

      irregularities.forEach((irr) =>
        pushEdge({
          src,
          rel: 'addressesIrregularity',
          dstKey: irr,
          dstType: 'IRREGULARITY'
        })
      );

      (metadata.cases_followed || []).forEach((ref) =>
        pushEdge({
          src,
          rel: 'leadsTo',
          dstKey: ref || null,
          dstType: 'CASE'
        })
      );
    }
  });

  return { edges, unresolved };
}

/**
 * Persist edges into Supabase.
 *
 * @param {Array<Object>} edges
 * @param {{supabase: object}} ctx
 * @returns {Promise<{error: any, count: number}>}
 */
async function persistEdges(edges, { supabase }) {
  if (!edges.length) return { error: null, count: 0 };
  const { data, error } = await supabase.from('kg_edges').insert(edges);
  return { error, count: data ? data.length : 0 };
}

module.exports = {
  extractAndBuildEdges,
  persistEdges
};
