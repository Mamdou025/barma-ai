const {
  cutStatute,
  cutJudgment,
  cutDoctrine,
  cutPublicReport
} = require('./chunkings');
const graphBuilder = require('../utils/graphBuilder');

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

const segmentDoctrine = (text, meta) => cutDoctrine(text, meta);
const extractDoctrineEdges = (segments) => graphBuilder.extractAndBuildEdges(segments);
const segmentRapportsPublics = (text, meta) => cutPublicReport(text, meta);
const extractRapportEdges = (segments) => graphBuilder.extractAndBuildEdges(segments);

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
      segments = segmentDoctrine(text, meta);
      ({ edges, unresolved } = extractDoctrineEdges(segments));
      break;
    }
    case 'rapports_publics': {
      segments = segmentRapportsPublics(text, meta);
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
