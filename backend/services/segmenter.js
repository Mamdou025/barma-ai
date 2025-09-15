const {
  cutStatute,
  cutJudgment
} = require('./chunkings');
const graphBuilder = require('../utils/graphBuilder');

/**
 * Split doctrinal texts into hierarchical segments based on common
 * French headings.
 *
 * Headings handled:
 *   Résumé, I., A., 1.1, Conclusion, Bibliographie
 *
 * @param {string} text
 * @returns {Array<{id:string,label:string,text:string,meta:{heading:string,level:number,role:string}}>} 
 */
function segmentDoctrine(text = '') {
  const headingRegex =
    /^\s*(Résumé|Conclusion|Bibliographie|[IVXLCDM]+\.|[A-Z]\.|\d+(?:\.\d+)+)\s.*$/gim;
  const matches = [...text.matchAll(headingRegex)];
  const segments = [];

  const levelAndRole = (h) => {
    if (/^résumé/i.test(h)) return { level: 0, role: 'abstract' };
    if (/^conclusion/i.test(h)) return { level: 0, role: 'conclusion' };
    if (/^bibliographie/i.test(h)) return { level: 0, role: 'bibliography' };
    if (/^[IVXLCDM]+\.$/i.test(h)) return { level: 1, role: 'section' };
    if (/^[A-Z]\.$/.test(h)) return { level: 2, role: 'subsection' };
    return { level: 3, role: 'clause' };
  };

  for (let i = 0; i < matches.length && segments.length < 60; i++) {
    const m = matches[i];
    const fullHeading = m[0].trim();
    const heading = m[1].trim();
    const start = m.index + m[0].length;
    const end = matches[i + 1] ? matches[i + 1].index : text.length;
    const body = text.slice(start, end).trim();
    const { level, role } = levelAndRole(heading);

    segments.push({
      id: `seg:doc:${segments.length + 1}`,
      label: fullHeading,
      text: body,
      meta: { heading, level, role }
    });
  }

  return segments;
}

/**
 * Extract edges from doctrinal segments.
 * Captures neutral case citations, statute references and cross‑references
 * such as “voir section II”.
 *
 * @param {Array} segments
 * @returns {{edges:Array, unresolved:Array}}
 */
function extractDoctrineEdges(segments = []) {
  const edges = [];
  const unresolved = [];
  let edgeCount = 1;

  const headingMap = Object.fromEntries(
    segments.map((s) => [s.meta.heading.replace(/\.$/, '').toLowerCase(), s.id])
  );

  const caseRegex = /\b\d{4}\s+[A-Z]{2,}\s+\d+\b/g; // neutral citations
  const statuteRegex = /\b(?:art\.?|article)\s+\d+[A-Za-z0-9\-]*\b/gi;
  const xrefRegex = /voir\s+section\s+([IVXLCDM]+|[A-Z]|\d+(?:\.\d+)+)/gi;

  const pushEdge = (src, type, surface, target = surface) => {
    edges.push({
      id: `edge:doc:${edgeCount++}`,
      source: src,
      target,
      type,
      surface: surface.replace(/\s+/g, ' ')
    });
  };

  segments.forEach((seg) => {
    const { id, text } = seg;

    let m;
    while ((m = caseRegex.exec(text))) {
      pushEdge(id, 'case', m[0]);
    }

    while ((m = statuteRegex.exec(text))) {
      pushEdge(id, 'statute', m[0]);
    }

    while ((m = xrefRegex.exec(text))) {
      const ref = m[1].replace(/\.$/, '').toLowerCase();
      const target = headingMap[ref] || null;
      pushEdge(id, 'xref', m[0], target);
      if (!target) {
        unresolved.push({ src: id, ref: m[1] });
      }
    }
  });

  return { edges, unresolved };
}

/**
 * Detect the document type based on French cues.
 * @param {string} text
 * @returns {string} one of lois_reglements, jurisprudence, doctrine, rapports_publics, unknown
 */
function detectDocumentType(text = '') {
  const lower = text.toLowerCase();
  const cues = {
    lois_reglements: [
      'article',
      'vu la loi',
      'vu le décret',
      'chapitre',
      'section'
    ],
    jurisprudence: [
      'considérant',
      'attendu',
      'dispositif',
      'jugement',
      'arrêt',
      'tribunal',
      'cour'
    ],
    doctrine: [
      'résumé',
      'bibliographie',
      'mots clés',
      'introduction',
      'conclusion'
    ],
    rapports_publics: [
      'résumé exécutif',
      'recommandation',
      'observation',
      'annexe',
      'rapport'
    ]
  };

  const scores = Object.fromEntries(
    Object.entries(cues).map(([type, phrases]) => [
      type,
      phrases.reduce((acc, p) => acc + (lower.includes(p) ? 1 : 0), 0)
    ])
  );

  let best = 'unknown';
  let bestScore = 0;
  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) {
      best = type;
      bestScore = score;
    }
  }

  return best;
}

/**
 * Segment public reports into labelled sections.
 * Detects common French headings and numeric fallback headings.
 *
 * @param {string} text
 * @returns {Array<{id:string,label:string,text:string,meta:{heading:string,level:number,role:string}}>}
 */
function segmentRapportsPublics(text = '') {
  const headingRegex =
    /^\s*(Résumé exécutif|Méthodologie|Constats|Recommandations|Annexes|Annexe\s+\d+|\d+(?:\.\d+)*)(?:[\.\-\)]?[ \t][^\n]*)?$/gim;
  const matches = [...text.matchAll(headingRegex)];
  const rawSegments = [];

  const levelAndRole = (h) => {
    if (/^résumé exécutif/i.test(h)) return { level: 0, role: 'executive_summary' };
    if (/^méthodologie/i.test(h)) return { level: 0, role: 'methodology' };
    if (/^constats/i.test(h)) return { level: 0, role: 'findings' };
    if (/^recommandations/i.test(h)) return { level: 0, role: 'recommendations' };
    if (/^annexe/i.test(h)) return { level: 0, role: 'annex' };
    if (/^\d+(?:\.\d+)*$/.test(h)) {
      const depth = h.split('.').length;
      if (depth === 1) return { level: 1, role: 'section' };
      if (depth === 2) return { level: 2, role: 'subsection' };
      return { level: 3, role: 'clause' };
    }
    return { level: 0, role: 'section' };
  };

  for (let i = 0; i < matches.length && rawSegments.length < 80; i++) {
    const m = matches[i];
    const fullHeading = m[0].trim();
    const heading = m[1].trim().replace(/[\.\)-]$/, '');
    const start = m.index + m[0].length;
    const end = matches[i + 1] ? matches[i + 1].index : text.length;
    const body = text.slice(start, end).trim();
    const { level, role } = levelAndRole(heading);
    rawSegments.push({ label: fullHeading, text: body, meta: { heading, level, role } });
  }

  const merged = [];
  rawSegments.forEach((seg) => {
    if (
      merged.length &&
      (merged[merged.length - 1].text.length < 300 || seg.text.length < 300)
    ) {
      const prev = merged[merged.length - 1];
      prev.text = [prev.text, seg.label, seg.text].filter(Boolean).join('\n\n');
    } else {
      merged.push({ ...seg });
    }
  });

  return merged.slice(0, 60).map((s, idx) => ({
    id: `seg:rap:${idx + 1}`,
    label: s.label,
    text: s.text,
    meta: s.meta
  }));
}

/**
 * Extract edges from public report segments.
 * Captures neutral case citations, statute references and cross‑references
 * such as “voir annexe 2”.
 *
 * @param {Array} segments
 * @returns {{edges:Array, unresolved:Array}}
 */
function extractRapportEdges(segments = []) {
  const edges = [];
  const unresolved = [];
  let edgeCount = 1;

  const headingMap = Object.fromEntries(
    segments.map((s) => [s.meta.heading.toLowerCase(), s.id])
  );

  const caseRegex = /\b\d{4}\s+[A-Z]{2,}\s+\d+\b/g;
  const statuteRegex = /\b(?:art\.?|article)\s+\d+[A-Za-z0-9\-]*\b/gi;
  const xrefRegex = /voir\s+(?:section\s+([\d\.]+)|annexe\s+(\d+))/gi;

  const pushEdge = (src, type, surface, target = surface) => {
    edges.push({
      id: `edge:rap:${edgeCount++}`,
      source: src,
      target,
      type,
      surface: surface.replace(/\s+/g, ' ')
    });
  };

  segments.forEach((seg) => {
    const { id, text } = seg;
    let m;

    while ((m = caseRegex.exec(text))) {
      pushEdge(id, 'case', m[0]);
    }

    while ((m = statuteRegex.exec(text))) {
      pushEdge(id, 'statute', m[0]);
    }

    while ((m = xrefRegex.exec(text))) {
      const ref = m[1] ? m[1] : m[2] ? `annexe ${m[2]}` : null;
      const target = ref ? headingMap[ref.toLowerCase()] : null;
      pushEdge(id, 'xref', m[0], target);
      if (!target && ref) {
        unresolved.push({ src: id, ref });
      }
    }
  });

  return { edges, unresolved };
}

/**
 * Segment a whole document and extract edges.
 * @param {{document_id:string,title?:string,text:string}} params
 * @returns {{type:string,segments:Array,edges:Array,unresolved:Array}}
 */
function segmentWholeDocument({ document_id, title = '', text }) {
  const type = detectDocumentType(text);
  const metaTypeMap = {
    lois_reglements: 'statute',
    jurisprudence: 'judgment',
    doctrine: 'doctrine',
    rapports_publics: 'public_report',
    unknown: 'unknown'
  };
  const meta = { document_id, type: metaTypeMap[type] };

  let segments = [];
  let edges = [];
  let unresolved = [];

  switch (type) {
    case 'lois_reglements': {
      segments = cutStatute(text, meta);
      ({ edges, unresolved } = graphBuilder.extractAndBuildEdges(segments));
      break;
    }
    case 'jurisprudence': {
      segments = cutJudgment(text, meta);
      ({ edges, unresolved } = graphBuilder.extractAndBuildEdges(segments));
      break;
    }
    case 'doctrine': {
      segments = segmentDoctrine(text);
      ({ edges, unresolved } = extractDoctrineEdges(segments));
      break;
    }
    case 'rapports_publics': {
      segments = segmentRapportsPublics(text);
      ({ edges, unresolved } = extractRapportEdges(segments));
      break;
    }
    default:
      break;
  }

  if (!segments.length) {
    segments = [{ document_id, type: meta.type, role: 'whole_document', text: text.trim(), metadata: {} }];
    edges = [];
    unresolved = [];
  }

  return { type, segments, edges, unresolved };
}

module.exports = {
  detectDocumentType,
  segmentWholeDocument,
  segmentDoctrine,
  extractDoctrineEdges,
  segmentRapportsPublics,
  extractRapportEdges
};
