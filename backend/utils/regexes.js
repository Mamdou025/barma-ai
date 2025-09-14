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
  amount: /\b\d{1,3}(?:[ .,\u00A0]\d{3})*(?:[.,]\d{2})?\s*(?:€|EUR|euro[s]?|USD|\$)\b/gi,
  procurement: /\b(?:marché[s]? public[s]?|procurement|tender|contrat[s]?)\b/i
};

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

module.exports = {
  statutes,
  regulations,
  judgments,
  doctrine,
  publicReports,
  normalizeNumber,
  normalizeCurrencyAmount
};
