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
  let s = 0;

  const patterns = [
    // Headings and document types
    /\b(d[ée]cision|arr[êe]t|jugement)\s+n[°o]\s*[\w\-\/]+/i,
    // Institutions (civil-law / francophone)
    /\bconseil constitutionnel\b/i,
    /\bcour de cassation\b/i,
    /\bcour d[’']appel\b/i,
    /\btribunal (administratif|de grande instance|correctionnel|judiciaire)\b/i,
    // Formulaic phrases in FR judgments
    /\bconsid[ée]rant\b/i,
    /\bpar ces motifs\b/i,
    /\bd[ée]cide\b/i,
    /(^|\n)\s*vu\s+(la|le|les)\b/i,
    /(^|\n)\s*attendu que\b/i,
    // Paragraph numbering styles
    /^\[\d+\]/m,        // [1], [2]…
    /^\d+\.\s/m         // 1. 2. …
  ];

  patterns.forEach(re => { if (re.test(t)) s += 1; });

  // Extra weight for strong judicial combos
  if (/\bconsid[ée]rant\b/i.test(t) && /\bd[ée]cide\b/i.test(t)) s += 1;
  if (/\bconseil constitutionnel\b/i.test(t)) s += 2;

  return s;
}


function scoreDoctrine(t) {
  let score = 0;

  const academicCues = [
    /\brésumé\b/i,
    /\babstract\b/i,
    /\bintroduction\b/i,
    /\bconclusion\b/i,
    /\b(bibliographie|références)\b/i,
    /^[IVXLC]+\.\s+/m,  // roman numeral headings
    /^[A-Z]\.\s+/m      // A. B. subheadings
  ];

  let hits = 0;
  academicCues.forEach(re => { if (re.test(t)) hits += 1; });
  if (hits >= 2) score += hits;          // require at least 2 real academic signals

  // If strong judicial cues exist, downweight doctrine to avoid false positives
  if (/\b(consid[ée]rant|par ces motifs|d[ée]cide)\b/i.test(t)) score = Math.max(0, score - 2);

  return score;
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

// --- DETECTION (FR) — drop-in replacement for detectDocumentTypeFR ---
function detectDocumentTypeFR({ title = '', text = '' }) {
  // Normalize / cap for perf
  const raw = (title + '\n' + text).slice(0, 200000);
  const t = raw.replace(/\r/g, '');
  const lower = t.toLowerCase();

  // Keep your existing scorers
  const scores = {
    lois_reglements:  scoreLoisReglements(t),
    jurisprudence:    scoreJurisprudence(t),
    doctrine:         scoreDoctrine(t),
    rapports_publics: scoreRapportsPublics(t)
  };

  // Cues for tie-breakers (don’t change your scorers; these are just hints)
  const hasRoman          = /^[IVXLC]+\.\s+/m.test(t);
  const hasBibliographie  = /\b(bibliographie|références)\b/i.test(t);
  const hasResume         = /\brésumé\b/i.test(t);
  const hasIntro          = /\bintroduction\b/i.test(t);

  const hasExecSummary    = /\b(résumé exécutif|sommaire exécutif|synthèse)\b/i.test(lower);
  const hasMethod         = /\b(méthodologie|méthode)\b/i.test(lower);
  const hasFindings       = /\b(constats|résultats|analyse|diagnostic)\b/i.test(lower);
  const hasRecom          = /\b(recommandations|préconisations|mesures correctives)\b/i.test(lower);
  const hasAnnex          = /\bannexes?\b/i.test(lower);

  const neutralCitation   = /\b20\d{2}\s+(scc|csc|fca|fc|qcca|qccs|qccq|onca|onsc|abca|bcca|bcsc|nbca|nsca|skca|mbca|peica|nlca|ca|cs)\s+\d+\b/i;
  const judgeCueFR        = /\b(version française du jugement|le juge|la juge|les juges)\b/i;
  const styleOfCause      = /\b(R\.?\s*c\.?|v\.)\b/;
  const paraNums          = /^\[\d+\]/m;

  // Softened thresholds so Doctrine/Rapports win when their anatomy is present
  const minThreshold = {
    lois_reglements:  3,
    jurisprudence:    2,
    doctrine:         3, 
    rapports_publics: 2  // was 3
  };

  // Argmax
  let bestType = 'unknown';
  let bestScore = 0;
  for (const [k, v] of Object.entries(scores)) {
    if (v > bestScore) { bestScore = v; bestType = k; }
  }

  // Tie-breakers when scores tie or are close
  const maxScore = Math.max(...Object.values(scores));
  const tied = Object.entries(scores).filter(([_, v]) => v === maxScore).map(([k]) => k);

  if (tied.length > 1) {
    // Prefer Rapports publics when the classic report anatomy is present
    if (tied.includes('rapports_publics') &&
        (hasExecSummary && hasMethod && (hasFindings || hasRecom || hasAnnex))) {
      bestType = 'rapports_publics';
    }
    // Prefer Doctrine when academic structure exists (roman numerals + intro/bibliography/resumé)
    else if (tied.includes('doctrine') &&
             ((hasRoman && (hasBibliographie || hasIntro || hasResume)) || (hasResume && hasIntro))) {
      bestType = 'doctrine';
    }
    // Prefer Jurisprudence only with strong judicial cues
    else if (tied.includes('jurisprudence') &&
             (neutralCitation.test(t) || judgeCueFR.test(t) || (paraNums.test(t) && styleOfCause.test(t)))) {
      bestType = 'jurisprudence';
    }
    // Prefer Lois & règlements when article/code structure is strong
    else if (tied.includes('lois_reglements') && scores.lois_reglements >= 3) {
      bestType = 'lois_reglements';
    }
    // else keep argmax default
  }

  // Enforce thresholds (but slightly relaxed for doctrine/rapports)
  if (bestScore < (minThreshold[bestType] ?? 99)) {
    bestType = 'unknown';
  }

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
      let surface = m[0];
      surface = surface.replace(/\s+/g, ' ').trim();  // <<< NORMALISATION

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
      let surface = m[0];
      surface = surface.replace(/\s+/g, ' ').trim();  // <<< NORMALISATION

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
