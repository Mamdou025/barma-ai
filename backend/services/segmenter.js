// backend/services/segmenter.js
/**
 * Step 3 (FR, preview-only): segmentation for "Lois & règlements".
 * - Keeps Step 2 detection for 4 FR families.
 * - If detected_type === 'lois_reglements', returns segments per Article (incl. 12.1, 12.3, etc.).
 * - Adds section_path from headings (Livre/Titre/Chapitre/Section/Sous-section) above each Article.
 * - SAFE: read-only, no DB writes. Other types still return the single whole-document segment for now.
 *
 * Next step (Step 4): add citations/cross-refs/edges, still preview-only.
 */

/* ---------------------------
   Type Detection (unchanged)
---------------------------- */

function scoreLoisReglements(t) {
  const tests = [
    /(^|\n)\s*(LIVRE|TITRE|CHAPITRE|SECTION|SOUS-SECTION)\s+[IVXLC\d]+(\.|—|-)?\s/i,
    /\bDISPOSITIONS\s+(GÉNÉRALES|FINALES|TRANSITOIRES)\b/i,
    /(^|\n)\s*(Article|art\.?)\s+\d+(\.\d+)?([\-–]\d+)?\b/i,
    /(^|\n)\s*(Section|Sec\.|s\.)\s+\d+(\.\d+)?(\([a-z0-9]+\))*\b/i,
    /\b(Définitions|Interprétation|Interpretation|Definitions)\b/i,
    /\b(voir|voir aussi)\s+(l'?art\.?|article|s\.)\s+\d+(\.\d+)?/i,
    /\b(Code du|Code de la|Loi sur|Règlement|Décret|Arrêté)\b/i,
    /\b(CQLR|L\.R\.Q\.|L\.R\.C\.)\b/
  ];
  let s = 0;
  for (const re of tests) if (re.test(t)) s++;
  const articleCount = (t.match(/(^|\n)\s*(Article|art\.?)\s+\d+/gi) || []).length;
  if (articleCount >= 5) s += 2;
  else if (articleCount >= 2) s += 1;
  return s;
}

function scoreJurisprudence(t) {
  const neutralCitation = new RegExp(
    String.raw`\b20\d{2}\s+(CSC|SCC|QCCA|QCCS|QCCQ|ONCA|ONSC|FCA|CF|CA|CS|BCCA|BCSC|ABCA|NBCA|NSCA|SKCA|MBCA|PEICA|NLCA)\s+\d+\b`
  );
  const tests = [
    neutralCitation,
    /\b(R\.?\s*c\.?| c\. | v\.)\b/,
    /\b(Le juge|La juge|Les juges)\b/i,
    /\b(Motifs|Analyse|Dispositif|Arrêt|Jugement)\b/i,
    /(^|\n)\s*\[\d+\]\s+/
  ];
  let s = 0;
  for (const re of tests) if (re.test(t)) s++;
  if (/\b(Le juge|La juge|Les juges)\b/i.test(t) && /\b(jugement|arrêt)\b/i.test(t)) s++;
  return s;
}

function scoreDoctrine(t) {
  const tests = [
    /\b(Résumé|Abstract|Mots[-\s]?clés|Mots clés)\b/i,
    /\b(Introduction|Conclusion|Bibliographie|Notes|Remerciements)\b/i,
    /\b(Revue|Dalloz|LexisNexis|Lextenso|CanLII\s*\(commentaire\)|Cahiers|Presses)\b/i,
    /\b(doi:|ISSN|Vol\.|No\.|pp\.)\b/i,
    /\b(par\s+[A-ZÉÈÀÂÎÔÛ][\wÉÈÀÂÎÔÛ\-']+(?:\s+[A-ZÉÈÀÂÎÔÛ][\wÉÈÀÂÎÔÛ\-']+)*)\b/,
    /\b(Professeur|Maître|Avocat|LL\.M\.|Ph\.D\.|Université)\b/i
  ];
  let s = 0;
  for (const re of tests) if (re.test(t)) s++;
  const biblioRefs = (t.match(/\b(ibid\.|op\. cit\.|id\.)\b/gi) || []).length;
  if (biblioRefs >= 2) s++;
  return s;
}

function scoreRapportsPublics(t) {
  const tests = [
    /\b(Cour des comptes|Inspection générale|IGF|Vérificateur|Commissaire|Office|Autorité|Ministère)\b/i,
    /\b(Rapport public|Rapport d'audit|Rapport d’évaluation|Note de synthèse|Mission)\b/i,
    /\b(Synthèse|Constats|Recommandations|Méthodologie|Annexes|Observations)\b/i,
    /\b(Recommandation\s*n[°o]\s*\d+)\b/i,
    /(^|\n)\s*Chapitre\s+\d+\s*[\u2014\u2013-]\s+/i  // fixed char class for dashes
  ];
  let s = 0;
  for (const re of tests) if (re.test(t)) s++;
  const recs = (t.match(/Recommandation\s*n[°o]\s*\d+/gi) || []).length;
  if (recs >= 3) s += 2;
  else if (recs >= 1) s += 1;
  return s;
}

function detectDocumentTypeFR({ title = '', text = '' }) {
  const t = (title + '\n' + text).slice(0, 200000);

  const scores = {
    lois_reglements:  scoreLoisReglements(t),
    jurisprudence:    scoreJurisprudence(t),
    doctrine:         scoreDoctrine(t),
    rapports_publics: scoreRapportsPublics(t)
  };

  let bestType = 'unknown';
  let bestScore = 0;
  for (const [k, v] of Object.entries(scores)) {
    if (v > bestScore) { bestScore = v; bestType = k; }
  }

  const minThreshold = {
    lois_reglements:  3,
    jurisprudence:    2,
    doctrine:         3,
    rapports_publics: 3
  };

  if (bestScore < (minThreshold[bestType] || 99)) bestType = 'unknown';

  const human = {
    lois_reglements:  'Lois & règlements',
    jurisprudence:    'Jurisprudence (décision de justice)',
    doctrine:         'Doctrine (articles, commentaires)',
    rapports_publics: 'Rapports publics (Cour des comptes, inspections)',
    unknown:          'Inconnu'
  };

  return { detected_type: bestType, detected_type_human: human[bestType], scores };
}

/* ---------------------------
   Segmentation (Lois & règlements)
---------------------------- */

// Normalize dashes/linebreaks for robust matching
function normalizeText(s) {
  return (s || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')       // nbsp
    .replace(/\u2011/g, '-')       // non-breaking hyphen
    .replace(/\t/g, ' ')
    .trim();
}

// Headings (capture numeral + optional title after dash)
const reLivre       = /^\s*LIVRE\s+([IVXLC\d]+)\s*(?:[\u2014\u2013-]\s*(.+))?$/i;
const reTitre       = /^\s*TITRE\s+([IVXLC\d]+)\s*(?:[\u2014\u2013-]\s*(.+))?$/i;
const reChapitre    = /^\s*CHAPITRE\s+([IVXLC\d]+)\s*(?:[\u2014\u2013-]\s*(.+))?$/i;
const reSection     = /^\s*SECTION\s+([IVXLC\d]+)\s*(?:[\u2014\u2013-]\s*(.+))?$/i;
const reSousSection = /^\s*SOUS[-\u2011]SECTION\s+([IVXLC\d]+)\s*(?:[\u2014\u2013-]\s*(.+))?$/i;

// Article header: "Article 12" or "Art. 12.3 — Title"
const reArticleHdr  = /^\s*(?:Article|Art\.?|art\.?)\s+(\d+(?:\.\d+)*)(?:\s*[\u2014\u2013-]\s*(.+))?$/;

// Very light "role" guess from the article header or first line
function guessArticleRole({ number, title, bodyFirstLine }) {
  const line = ((title || '') + ' ' + (bodyFirstLine || '')).toLowerCase();
  if (/définition/.test(line)) return 'definitions';
  if (/exception/.test(line)) return 'exception';
  if (/modalit|procédure/.test(line)) return 'procedure';
  if (/champ d.?application/.test(line)) return 'scope';
  return 'rule';
}

function buildPath(current, articleNumber) {
  const parts = [];
  if (current.livre)       parts.push(`Livre ${current.livre}${current.livreTitle ? ` — ${current.livreTitle}` : ''}`);
  if (current.titre)       parts.push(`Titre ${current.titre}${current.titreTitle ? ` — ${current.titreTitle}` : ''}`);
  if (current.chapitre)    parts.push(`Chapitre ${current.chapitre}${current.chapitreTitle ? ` — ${current.chapitreTitle}` : ''}`);
  if (current.section)     parts.push(`Section ${current.section}${current.sectionTitle ? ` — ${current.sectionTitle}` : ''}`);
  if (current.sousSection) parts.push(`Sous-section ${current.sousSection}${current.sousSectionTitle ? ` — ${current.sousSectionTitle}` : ''}`);
  parts.push(`Article ${articleNumber}`);
  return parts.join(' > ');
}

function segmentLoisReglements(text) {
  const norm = normalizeText(text);
  const lines = norm.split('\n');

  const current = { livre:null, titre:null, chapitre:null, section:null, sousSection:null,
                    livreTitle:null, titreTitle:null, chapitreTitle:null, sectionTitle:null, sousSectionTitle:null };

  const segments = [];
  let pending = null; // { number, headerTitle, startIdx, bodyLines[] }

  const flushPending = (endIdxExclusive) => {
    if (!pending) return;
    // Body text is lines from pending.startIdx (header line) up to endIdxExclusive
    const bodyLines = lines.slice(pending.startIdx + 1, endIdxExclusive);
    const bodyText = bodyLines.join('\n').trim();
    const firstLine = bodyLines.find(l => l.trim().length > 0) || '';
    const role = guessArticleRole({ number: pending.number, title: pending.headerTitle, bodyFirstLine: firstLine });
    const section_path = buildPath(current, pending.number);

    segments.push({
      id: `seg:art.${pending.number}`,
      label: 'article',
      section_path,
      text: `Article ${pending.number}${pending.headerTitle ? ' — ' + pending.headerTitle : ''}\n` + bodyText,
      meta: {
        number: pending.number,
        rubric: pending.headerTitle || null,
        role,
      }
    });
    pending = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Update hierarchy when we encounter headings
    let m;
    if ((m = reLivre.exec(line)))       { current.livre = m[1]; current.livreTitle = m[2] || null; continue; }
    if ((m = reTitre.exec(line)))       { current.titre = m[1]; current.titreTitle = m[2] || null; continue; }
    if ((m = reChapitre.exec(line)))    { current.chapitre = m[1]; current.chapitreTitle = m[2] || null; continue; }
    if ((m = reSection.exec(line)))     { current.section = m[1]; current.sectionTitle = m[2] || null; continue; }
    if ((m = reSousSection.exec(line))) { current.sousSection = m[1]; current.sousSectionTitle = m[2] || null; continue; }

    // Article header?
    const a = reArticleHdr.exec(line);
    if (a) {
      // Finish previous article
      flushPending(i);
      // Start a new one
      pending = {
        number: a[1],
        headerTitle: a[2] || null,
        startIdx: i
      };
      continue;
    }
  }

  // Flush last article if any
  flushPending(lines.length);

  // Fallback: if no articles found, return empty to let caller fall back to whole document
  return segments;
}

/* ---------------------------
   Public preview function
---------------------------- */

function segmentWholeDocument({ documentId, title, text, maxPreviewChars = 50000 }) {
  const safeText = typeof text === 'string' ? text : '';
  const truncated = safeText.length > maxPreviewChars;
  const previewText = truncated ? safeText.slice(0, maxPreviewChars) : safeText;

  const { detected_type, detected_type_human, scores } = detectDocumentTypeFR({ title, text: safeText });

  // For Step 3: only Lois & règlements get segmented; others remain no-op for now
  if (detected_type === 'lois_reglements') {
    const segs = segmentLoisReglements(safeText);
    if (segs.length > 0) {
      return {
        document_id: documentId,
        title: title || null,
        detected_type,
        detected_type_human,
        detection_scores: scores,
        segments: segs
      };
    }
    // else fall through to no-op if we couldn't detect articles
  }

  // no-op default
  return {
    document_id: documentId,
    title: title || null,
    detected_type,
    detected_type_human,
    detection_scores: scores,
    segments: [
      {
        id: 'seg_0001',
        label: 'whole_document',
        text: previewText,
        meta: {
          strategy: 'no-op',
          length_chars: safeText.length,
          truncated,
          max_preview_chars: maxPreviewChars
        }
      }
    ]
  };
}

module.exports = { segmentWholeDocument };
