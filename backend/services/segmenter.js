// backend/services/segmenter.js
/**
 * Step 3b (FR, preview-only)
 * - Détection FR (lois_reglements | jurisprudence | doctrine | rapports_publics | unknown)
 * - Segmentation "Lois & règlements" (Articles) avec chemins hiérarchiques
 * - Segmentation "Jurisprudence" (Faits | Questions | Motifs/Analyse | Dispositif)
 * SAFE: lecture seule, aucun write ; aucune autre modification ailleurs.
 */

/* ---------------------------
   Détection de type (FR)
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
    neutralCitation,                         // ex: 2017 CSC 45
    /\b(R\.?\s*c\.?| c\. | v\.)\b/,          // "R. c." / "c." / "v."
    /\b(Le juge|La juge|Les juges)\b/i,
    /\b(Motifs|Analyse|Dispositif|Arrêt|Jugement|Conclusion)\b/i,
    /(^|\n)\s*\[\d+\]\s+/                    // ¶ [1], [2], ...
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
    /(^|\n)\s*Chapitre\s+\d+\s*[\u2014\u2013-]\s+/i
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
   Utilitaires communs
---------------------------- */

function normalizeText(s) {
  return (s || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')   // nbsp
    .replace(/\u2011/g, '-')   // non-breaking hyphen
    .replace(/\t/g, ' ')
    .trim();
}

/* ---------------------------
   Segmentation (Lois & règlements)
---------------------------- */

const reLivre       = /^\s*LIVRE\s+([IVXLC\d]+)\s*(?:[\u2014\u2013-]\s*(.+))?$/i;
const reTitre       = /^\s*TITRE\s+([IVXLC\d]+)\s*(?:[\u2014\u2013-]\s*(.+))?$/i;
const reChapitre    = /^\s*CHAPITRE\s+([IVXLC\d]+)\s*(?:[\u2014\u2013-]\s*(.+))?$/i;
const reSection     = /^\s*SECTION\s+([IVXLC\d]+)\s*(?:[\u2014\u2013-]\s*(.+))?$/i;
const reSousSection = /^\s*SOUS[-\u2011]SECTION\s+([IVXLC\d]+)\s*(?:[\u2014\u2013-]\s*(.+))?$/i;
// ajout : grands intertitres génériques (ex. DISPOSITIONS FINALES…)
const reDispositionsHdr = /^\s*DISPOSITIONS\s+(GÉNÉRALES|FINALES|TRANSITOIRES)\b.*$/i;

// "Article 12" ou "Art. 12.3 — ..."
const reArticleHdr  = /^\s*(?:Article|Art\.?|art\.?)\s+(\d+(?:\.\d+)*)(?:\s*[\u2014\u2013-]\s*(.+))?$/;

function guessArticleRole({ number, title, bodyFirstLine }) {
  const raw = ((title || '') + ' ' + (bodyFirstLine || ''));
  const line = raw.replace(/[’]/g, "'").toLowerCase();

  if (/champ\s+d'?application/.test(line)) return 'scope';
  if (/définition/.test(line) || /definitions/.test(line)) return 'definitions';
  if (/exception/.test(line)) return 'exception';
  if (/modalit|procédure|procedure/.test(line)) return 'procedure';
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
  let pending = null; // { number, headerTitle, startIdx }

  const flushPending = (endIdxExclusive) => {
    if (!pending) return;
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
      meta: { number: pending.number, rubric: pending.headerTitle || null, role }
    });
    pending = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Flush avant d'avaler un nouvel en-tête hiérarchique
    let m;
    if ((m = reLivre.exec(line)))       { flushPending(i); current.livre = m[1]; current.livreTitle = m[2] || null; continue; }
    if ((m = reTitre.exec(line)))       { flushPending(i); current.titre = m[1]; current.titreTitle = m[2] || null; continue; }
    if ((m = reChapitre.exec(line)))    { flushPending(i); current.chapitre = m[1]; current.chapitreTitle = m[2] || null; continue; }
    if ((m = reSection.exec(line)))     { flushPending(i); current.section = m[1]; current.sectionTitle = m[2] || null; continue; }
    if ((m = reSousSection.exec(line))) { flushPending(i); current.sousSection = m[1]; current.sousSectionTitle = m[2] || null; continue; }
    if (reDispositionsHdr.test(line))   { flushPending(i); /* on ne stocke pas dans le path */ continue; }

    // Début d'article ?
    const a = reArticleHdr.exec(line);
    if (a) { flushPending(i); pending = { number: a[1], headerTitle: a[2] || null, startIdx: i }; continue; }
  }

  flushPending(lines.length);
  return segments;
}
// --- Edges: renvois internes "voir article X", "articles A à B" (Lois & règlements) ---
function extractLoisEdges(segments) {
  // index rapide: numéro d'article -> id de segment
  const idByNumber = {};
  for (const seg of segments) {
    const num = seg?.meta?.number;
    if (num) idByNumber[num] = seg.id;
  }

  const edges = [];

  // regex robustes (FR) pour les renvois dans le CORPS (on exclut la 1re ligne "Article X — ...")
  const reSingle = /\b(?:voir(?:\s+aussi)?\s+)?(?:l'?art\.?|article)\s+(\d+(?:\.\d+)*)\b(?:[^.\n\r]*?(?:alinéa|al\.)\s*(\d+))?/gi;
  const reRange  = /\barticles?\s+(\d+(?:\.\d+)*)\s*(?:à|[\u2013\u2014-])\s*(\d+(?:\.\d+)*)\b/gi;

  for (const fromSeg of segments) {
    // ignorer l’en-tête de l’article : ne garder que le corps
    const body = (fromSeg.text || '').split('\n').slice(1).join('\n');

    // Renvoi simple: "voir l’art. 20", "voir article 11"
    let m;
    while ((m = reSingle.exec(body)) !== null) {
      const toNum = m[1];                 // ex. "20" ou "12.3"
      const alinea = m[2] || null;        // ex. "3" si "alinéa 3" trouvé
      const surface = m[0];
      const toId = idByNumber[toNum] || null;

      edges.push({
        from: fromSeg.id,
        to: toId,                         // null si l’article cible n’existe pas dans les segments
        to_ref: `art.${toNum}${alinea ? `.al.${alinea}` : ''}`,
        type: 'refersTo',
        surface
      });
    }

    // Plages: "articles 12 à 12.3", "articles 5–7"
    while ((m = reRange.exec(body)) !== null) {
      const a = m[1];     // début
      const b = m[2];     // fin (peut contenir .3)
      const surface = m[0];
      edges.push({
        from: fromSeg.id,
        to: null,         // plage -> pas un seul segment cible
        to_ref: `art.${a}–art.${b}`,
        type: 'refersToRange',
        surface
      });
    }
  }

  return edges;
}

/* ---------------------------
   Segmentation (Jurisprudence)
---------------------------- */

// Titres FR usuels (avec ou sans numéros romains "I. ", "II. ", etc.)
const HEADINGS_JURIS_MAP = [
  { re: /^\s*(?:[IVXLC]+\.?\s+)?(Aperçu|Résumé)\b.*$/i,             role: 'facts'    },
  { re: /^\s*(?:[IVXLC]+\.?\s+)?(Contexte(?:\s+factuel)?|Faits|Contexte factuel et procédural|Historique procédural)\b.*$/i, role: 'facts' },
  { re: /^\s*(?:[IVXLC]+\.?\s+)?(Questions(?:\s+en\s+litige)?|Questions en appel)\b.*$/i, role: 'issues'   },
  { re: /^\s*(?:[IVXLC]+\.?\s+)?(Analyse|Motifs|Discussion|Application du droit|Appréciation)\b.*$/i,        role: 'reasons'  },
  { re: /^\s*(?:[IVXLC]+\.?\s+)?(Conclusion|Dispositif|Décision|Ordonnance)\b.*$/i,                          role: 'disposition' }
];

// paragraphe numéroté [1], [2], ...
const RE_PARA = /^\s*\[(\d+)\]\s+/;

function segmentJurisprudence(text) {
  const norm = normalizeText(text);
  const lines = norm.split('\n');

  // parcourir, détecter les blocs par rôle
  const blocks = []; // { role, startIdx, endIdx }
  let currentRole = null;
  let startIdx = 0;

  const flushBlock = (endIdx) => {
    if (currentRole === null) return;
    blocks.push({ role: currentRole, startIdx, endIdx });
    currentRole = null;
  };

  const headingToRole = (line) => {
    for (const { re, role } of HEADINGS_JURIS_MAP) {
      if (re.test(line)) return role;
    }
    return null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const role = headingToRole(line);
    if (role) {
      // nouveau bloc : flush l'actuel
      flushBlock(i);
      currentRole = role;
      startIdx = i + 1; // texte commence après le titre
      continue;
    }
    // sinon, rien : on continue
  }
  // flush final (jusqu'à la fin)
  flushBlock(lines.length);

  // si aucun bloc détecté -> fallback : tout en 'reasons'
  if (blocks.length === 0) {
    return [{
      id: 'seg:reasons:001',
      label: 'reasons',
      text: norm,
      meta: { para_range: null }
    }];
  }

  // fusionner blocs consécutifs de même rôle (au cas où)
  const merged = [];
  for (const b of blocks) {
    const last = merged[merged.length - 1];
    if (last && last.role === b.role && last.endIdx === b.startIdx) {
      last.endIdx = b.endIdx;
    } else {
      merged.push({ ...b });
    }
  }

  // construire les segments finaux
  const segments = [];
  const pad3 = (n) => String(n).padStart(3, '0');

  let counters = { facts: 0, issues: 0, reasons: 0, disposition: 0 };

  for (const b of merged) {
    const body = lines.slice(b.startIdx, b.endIdx).join('\n').trim();
    if (!body) continue;

    counters[b.role] += 1;
    const id = `seg:${b.role}:${pad3(counters[b.role])}`;

    // détecter la plage de paragraphes [x]..[y] si présent
    const nums = [];
    body.split('\n').forEach(l => {
      const m = RE_PARA.exec(l);
      if (m) nums.push(parseInt(m[1], 10));
    });
    let para_range = null;
    if (nums.length) {
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      para_range = `¶${min}–¶${max}`;
    }

    segments.push({
      id,
      label: b.role,    // 'facts' | 'issues' | 'reasons' | 'disposition'
      text: body,
      meta: { para_range }
    });
  }

  return segments.length ? segments : [{
    id: 'seg:reasons:001',
    label: 'reasons',
    text: norm,
    meta: { para_range: null }
  }];
}
// --- Edges for Jurisprudence: case & statute citations ---
// --- Edges for Jurisprudence: case & statute citations (refined) ---
function extractJurisEdges(segments) {
  const edges = [];
  const dedupe = new Set();
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  // Neutral case citations: 2017 CSC 45, 2020 QCCA 1234, etc.
  const reCase = /\b20\d{2}\s+(?:CSC|SCC|FCA|CF|QCCA|QCCS|QCCQ|ONCA|ONSC|BCCA|BCSC|ABCA|NBCA|NSCA|SKCA|MBCA|PEICA|NLCA|TCC)\s+\d+\b/g;

  // Statute article citations (case-sensitive on purpose)
  //   - Accept: "art. 1457", "Article 20", "art. 487.3 du Code criminel", "s. 10(1)(a)"
  //   - Reject reporter page cites: "R.C.S. 389", "R.J.Q. 895", "D.L.R. 153", "CanLII 26"
  //   - Accept abbreviations: "C.cr.", "C.c.Q.", "C.p.c."
  const reStat = /(?:\b(?:[Aa]rt\.?|[Aa]rticle)|\bs\.)\s+(\d+(?:\.\d+)*(?:\([a-z0-9]+\))*)(?:\s*(?:alinéa|al\.)\s*(\d+))?(?:\s*(?:de|du|de la|de l’|de l')\s+((?:Code|Loi|Règlement|Décret|C\.cr\.|C\.c\.Q\.|C\.p\.c\.)[^.,;\n\)]{0,80}))?/g;

  // Reporter acronyms to ignore near a potential "s. 123" match
  const REPORTER_NEARBY = /(R\.C\.S\.|R\.J\.Q\.|D\.L\.R\.|CanLII|S\.C\.R\.|Q\.A\.|C\.A\.)/;

  for (const seg of segments) {
    const body = String(seg.text || '');

    // CASES
    for (const m of body.matchAll(reCase)) {
      const cite = norm(m[0]);
      const key = `${seg.id}|citesCase|${cite}`;
      if (dedupe.has(key)) continue;
      dedupe.add(key);
      edges.push({
        from: seg.id,
        to: null,
        to_ref: cite,     // e.g., "2017 CSC 45"
        type: 'citesCase',
        surface: cite
      });
    }

    // STATUTES
    let ms;
    while ((ms = reStat.exec(body)) !== null) {
      const surfaceRaw = ms[0];
      const artNum = ms[1];                     // "487.3" | "10(1)(a)"
      const alinea = ms[2] ? `.al.${ms[2]}` : '';
      const actRaw = ms[3] ? norm(ms[3]) : null; // "Code criminel" | "C.c.Q." | etc.

      // Context guard: skip if within ~10 chars before match we see a reporter acronym
      const start = Math.max(0, ms.index - 12);
      const ctx = body.slice(start, ms.index + surfaceRaw.length + 12);
      if (REPORTER_NEARBY.test(ctx)) continue;

      // Another guard: skip if immediately preceded by an uppercase letter + dot (e.g., "R.C.S. 389")
      const prev2 = body.slice(Math.max(0, ms.index - 3), ms.index);
      if (/[A-Z]\.\s?$/.test(prev2)) continue;

      const surface = norm(surfaceRaw);
      const toRef = `art.${artNum}${alinea}${actRaw ? ' — ' + actRaw : ''}`;

      const key = `${seg.id}|citesStatute|${toRef}|${surface}`;
      if (dedupe.has(key)) continue;
      dedupe.add(key);

      edges.push({
        from: seg.id,
        to: null,              // cross-doc resolution comes later
        to_ref: toRef,
        type: 'citesStatute',
        surface
      });
    }
  }

  return edges.filter(e => !(e.type === 'citesStatute' && /^S\.\s*\d+$/.test(e.surface)));
}


/* ---------------------------
   Fonction publique (preview)
---------------------------- */

function segmentWholeDocument({ documentId, title, text, maxPreviewChars = 50000 }) {
  const safeText = typeof text === 'string' ? text : '';
  const truncated = safeText.length > maxPreviewChars;
  const previewText = truncated ? safeText.slice(0, maxPreviewChars) : safeText;

  const { detected_type, detected_type_human, scores } = detectDocumentTypeFR({ title, text: safeText });

if (detected_type === 'lois_reglements') {
  const segs = segmentLoisReglements(safeText);
  if (segs.length > 0) {
    const edges = extractLoisEdges(segs); // ← NEW
    return {
      document_id: documentId,
      title: title || null,
      detected_type,
      detected_type_human,
      detection_scores: scores,
      segments: segs,
      edges                            // ← NEW: renvois détectés
    };
  }
}


if (detected_type === 'jurisprudence') {
  const segs = segmentJurisprudence(safeText);
  if (segs.length > 0) {
    const edges = extractJurisEdges(segs);  // NEW
    return {
      document_id: documentId,
      title: title || null,
      detected_type,
      detected_type_human,
      detection_scores: scores,
      segments: segs,
      edges                                     // NEW
    };
  }
}


  // fallback no-op
  return {
    document_id: documentId,
    title: title || null,
    detected_type,
    detected_type_human,
    detection_scores: scores,
    segments: [{
      id: 'seg_0001',
      label: 'whole_document',
      text: previewText,
      meta: {
        strategy: 'no-op',
        length_chars: safeText.length,
        truncated,
        max_preview_chars: maxPreviewChars
      }
    }]
  };
}

module.exports = { segmentWholeDocument };
