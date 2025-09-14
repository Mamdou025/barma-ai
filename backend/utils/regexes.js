// Regex maps for FR/EN headings and citations across document families

// (A) Statutes / lois
const statutes = {
  articleMarker: /\b(?:article|art\.?|section|sec\.?)\s*\d+[A-Za-z0-9\-]*\b/gi,
  crossReference: /\b(?:alinéa|al\.?|para\.?|§|s\.|art\.?|article|section)\s*\d+[A-Za-z0-9\-]*\b/gi
};

// (B) Regulations / décrets
const regulations = {
  visa: /\b(?:Vu|Visa)\b/i,
  considerants: /\b(?:Considérant|Considering)\b/gi,
  article: /\b(?:Article|Art\.?)\s*\d+[A-Za-z0-9\-]*\b/gi
};

// (C) Judgments / decisions
const judgments = {
  headings: {
    facts: /\b(?:Faits|Exposé des faits|Facts)\b/i,
    moyens: /\b(?:Moyens|Grounds|Issues)\b/i,
    motifs: /\b(?:Motifs|Reasons|Analysis)\b/i,
    dispositif: /\b(?:Dispositif|Order|Decision)\b/i
  },
  neutralCitation: /\b\d{4}\s+[A-Z]{2,}\s+\d+\b/,
  reporter: /\b(?:Cass\.|CE|CJUE|Civ\.|Crim\.|Ch\.)\b/
};

// (D) Doctrinal texts
const doctrine = {
  resume: /\b(?:Résumé|Abstract|Summary)\b/i,
  headings: /\b(?:[IVX]{1,4}|[A-Z]|[0-9]+)(?:[.)])?\b/g,
  footnote: /\[(?:\d+)\]|\(\d+\)/g,
  bibliography: /\b(?:Bibliographie|Bibliography|References)\b/i
};

// (E) Public audit reports
const publicReports = {
  executiveSummary: /\b(?:Résumé exécutif|Executive Summary)\b/i,
  observations: /\b(?:Observations|Constats|Findings)\b/i,
  responses: /\b(?:Réponses|Responses)\b/i,
  recommendations: /\b(?:Recommandations|Recommendations)\b/i,
  observationCue: /\b(?:observation(?:s)?|constat(?:s)?|finding(?:s)?|nous avons observé)\b/i,
  recommendationCue: /\b(?:recommandation(?:s)?|recommendation(?:s)?|nous recommandons|il est recommandé)\b/i,
  responseCue: /\b(?:réponse(?:s)?|responses?|management response|commentaire[s]? du minist(?:è|e)re)\b/i,
  amount: /\b\d{1,3}(?:[ .,\u00A0]\d{3})*(?:[.,]\d+)?\s*(?:k|m|million(?:s)?|thousand(?:s)?|€|eur|euro[s]?|usd|\$)\b/gi,
  procurement: /\b(?:march[ée]s? public[s]?|appel d'offres|procurement|tender|contrat[s]?|acquisition[s]?|purchase[s]?|bid[s]?)\b/i,
  periodRange: /\b(?:jan(?:vier)?|f[eé]v(?:rier)?|mar(?:s|ch)|avr(?:il)?|mai|jun(?:e)?|jul(?:y|let)|ao[uû]t|aug(?:ust)?|sep(?:t\.?|tember)?|oct(?:obre)?|nov(?:embre)?|d[ée]c(?:embre)?|\d{1,2})?\s*\d{4}\s*(?:-|–|to|au)\s*(?:jan(?:vier)?|f[eé]v(?:rier)?|mar(?:s|ch)|avr(?:il)?|mai|jun(?:e)?|jul(?:y|let)|ao[uû]t|aug(?:ust)?|sep(?:t\.?|tember)?|oct(?:obre)?|nov(?:embre)?|d[ée]c(?:embre)?|\d{1,2})?\s*\d{4}\b/gi
};

// Generic regex helpers
const articleMarkerRegex = /\b((?:article|art\.?|section|sec\.?)\s*)(\d+[A-Za-z0-9\-]*)/gi;

// Splits an article into subsections when a new paragraph/alinéa marker appears
// Matches newlines that are immediately followed by an enumeration marker
const alineaMarkerRegex = /\n(?=\s*(?:\d+|[IVX]+|[A-Z])(?:[.)°-]))/g;

function findHeadings(text) {
  if (!text) return [];
  const regex = /^(?:[IVX]+|[A-Z]|\d+)(?:[.)])?\s+[^\n]+/gm;
  return [...text.match(regex) || []].map(h => h.trim());
}

function findCitations(text) {
  if (!text) return [];
  const citationRegexes = [
    /\b(?:article|art\.?|section|sec\.?|alinéa|al\.?|para\.?|§|s\.)\s*\d+[A-Za-z0-9\-]*\b/gi,
    /\b\d{4}\s+[A-Z]{2,}\s+\d+\b/g, // neutral citations
    /\b[A-Z][A-Za-z0-9]+\s+v(?:s\.?|\.)\s+[A-Z][A-Za-z0-9]+/g
  ];
  return citationRegexes.flatMap(r => text.match(r) || []);
}

// Helpers
function normalizeNumber(input) {
  if (typeof input === 'number') return input;
  if (typeof input !== 'string') return NaN;
  return Number(input.replace(/\s+/g, '').replace(',', '.'));
}

function normalizeCurrencyAmount(input) {
  if (typeof input === 'number') return input;
  const numeric = input
    .replace(/[^\d,.\-]/g, '')
    .replace(/\s+/g, '')
    .replace(',', '.');
  return Number(numeric);
}

function normalizeEntityName(input) {
  if (!input) return '';
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const headingRoleRegexes = {
  observation: /\b(?:observation(?:s)?|constat(?:s)?|finding(?:s)?|observations?)\b/i,
  recommendation: /\b(?:recommandation(?:s)?|recommendation(?:s)?|nous recommandons|il est recommandé)\b/i,
  response: /\b(?:réponse(?:s)?|responses?|management response|commentaire[s]? du minist(?:è|e)re)\b/i
};

function detectHeadingRole(heading) {
  if (!heading) return null;
  const text = heading.toLowerCase();
  if (headingRoleRegexes.observation.test(text)) return 'observation';
  if (headingRoleRegexes.recommendation.test(text)) return 'recommendation';
  if (headingRoleRegexes.response.test(text)) return 'response';
  return null;
}

module.exports = {
  statutes,
  regulations,
  judgments,
  doctrine,
  publicReports,
  articleMarkerRegex,
  alineaMarkerRegex,
  findHeadings,
  findCitations,
  normalizeNumber,
  normalizeCurrencyAmount,
  normalizeEntityName,
  detectHeadingRole
};

if (require.main === module) {
  console.log('Available exports:', Object.keys(module.exports));
}
