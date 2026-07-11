// Built-in sample documents used as a fallback when the backend/database is
// unavailable (or returns an empty list). This lets the UI be demoed without a
// live Supabase connection. Each object matches the shape returned by
// GET /api/documents: { id, title, uploaded_at, storage_url, text_content }.
//
// Notes:
// - `id` MUST be a valid UUID (see UUID_RE in api.js) or DocumentList rejects it.
// - `type: 'pdf'` short-circuits the per-document /api/segment-preview fetch,
//   which would otherwise error against a missing backend.
// - `storage_url` points at real PDF files bundled in /public/samples so the
//   preview iframe renders actual content (no network/CORS dependency).

export const SAMPLE_DOCUMENTS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Contrat de bail commercial.pdf',
    uploaded_at: '2026-06-28T09:15:00.000Z',
    storage_url: '/samples/contrat-bail-commercial.pdf',
    type: 'pdf',
    text_content:
      "Contrat de bail commercial conclu entre le bailleur et le preneur pour " +
      "un local à usage commercial. Durée : 9 ans. Loyer annuel révisable selon " +
      "l'indice des loyers commerciaux. Dépôt de garantie équivalent à trois mois " +
      "de loyer. Charges, entretien et conditions de résiliation détaillés aux " +
      "articles 4 à 11.",
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'Conditions générales de vente.pdf',
    uploaded_at: '2026-06-30T14:42:00.000Z',
    storage_url: '/samples/conditions-generales-vente.pdf',
    type: 'pdf',
    text_content:
      "Conditions générales de vente applicables à toute commande passée auprès " +
      "du vendeur. Objet, prix, modalités de paiement, délais de livraison, " +
      "réserve de propriété, garanties légales et clause attributive de " +
      "juridiction. Le client déclare avoir pris connaissance des présentes CGV " +
      "avant la validation de sa commande.",
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    title: 'Statuts SARL.pdf',
    uploaded_at: '2026-07-02T11:05:00.000Z',
    storage_url: '/samples/statuts-sarl.pdf',
    type: 'pdf',
    text_content:
      "Statuts constitutifs d'une société à responsabilité limitée (SARL). " +
      "Dénomination sociale, siège social, objet, capital social divisé en parts " +
      "sociales, apports des associés, gérance, décisions collectives et " +
      "répartition des bénéfices. Exercice social du 1er janvier au 31 décembre.",
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    title: 'Contrat de travail CDI.pdf',
    uploaded_at: '2026-07-05T08:30:00.000Z',
    storage_url: '/samples/contrat-travail-cdi.pdf',
    type: 'pdf',
    text_content:
      "Contrat de travail à durée indéterminée conclu entre l'employeur et le " +
      "salarié. Fonction, classification, rémunération brute mensuelle, durée du " +
      "travail, période d'essai, congés payés et clause de confidentialité. " +
      "Convention collective applicable mentionnée à l'article 2.",
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    title: 'Politique de confidentialité RGPD.pdf',
    uploaded_at: '2026-07-08T16:20:00.000Z',
    storage_url: '/samples/politique-confidentialite-rgpd.pdf',
    type: 'pdf',
    text_content:
      "Politique de confidentialité conforme au Règlement Général sur la " +
      "Protection des Données (RGPD). Finalités du traitement, base légale, " +
      "catégories de données collectées, durée de conservation, sous-traitants " +
      "et droits des personnes concernées (accès, rectification, effacement, " +
      "opposition et portabilité).",
  },
];

// Runtime registry of documents handled locally (no backend): the built-in
// samples plus any PDF the user uploads while offline. Keyed by id so chat and
// mind-map can look up a document's extracted text.
const localDocs = new Map(SAMPLE_DOCUMENTS.map((d) => [d.id, d]));

// Register a locally-processed (client-side) document so later offline
// features (chat, mind map) can find its text by id.
export const registerLocalDoc = (doc) => {
  if (doc && doc.id) localDocs.set(doc.id, doc);
  return doc;
};

export const getLocalDoc = (id) => localDocs.get(id) || null;

// True when every id refers to a locally-handled document (built-in sample or
// offline upload), so we should answer offline instead of calling a backend
// that doesn't know these documents.
export const areSampleDocIds = (ids = []) =>
  ids.length > 0 && ids.every((id) => localDocs.has(id));

// Build a canned demo answer grounded in the document's own text.
export const buildSampleReply = (question, ids = []) => {
  const doc = ids.map((id) => localDocs.get(id)).find(Boolean);
  if (!doc) {
    return "Sélectionnez un document pour commencer.";
  }
  const summary = (doc.text_content || '').trim().slice(0, 600);
  return (
    `Voici une réponse de démonstration concernant « ${doc.title} ».\n\n` +
    `Question : ${question}\n\n` +
    `D'après le contenu du document : ${summary}\n\n` +
    `_(Ceci est une réponse de démonstration hors ligne. Connectez la base de ` +
    `données et le backend pour obtenir des réponses générées par l'IA à partir ` +
    `du contenu réel de vos documents.)_`
  );
};

// ---------------------------------------------------------------------------
// Client-side structure extraction → mind map
// ---------------------------------------------------------------------------
// Produces a NESTED { title, children } tree following the French legal
// hierarchy: Livre → Titre → Chapitre → Section → Article → content.
// Same shape the backend/GPT route returns, so it renders unchanged. Heuristic,
// not AI: it keys off the structural keywords and nests by their rank.

// Structural levels, from outermost (1) to innermost. Article/paragraph markers
// sit below the four requested levels so their text groups tidily.
const LEVELS = [
  { level: 1, re: /^livres?\b/i, kind: 'livre' },
  { level: 2, re: /^titres?\b/i, kind: 'titre' },
  { level: 3, re: /^chap(itre|\.)?\b/i, kind: 'chapitre' },
  { level: 4, re: /^sections?\b/i, kind: 'section' },
  { level: 5, re: /^(articles?|art\.)\b/i, kind: 'article' },
  { level: 5, re: /^§\s*\d/i, kind: 'article' },
  { level: 5, re: /^\d{1,2}\s*[-.)]\s+/, kind: 'article' },
];

const clean = (s) => s.replace(/\s+/g, ' ').trim();

// Split a block of text into sentence-like segments.
const toSentences = (text) =>
  clean(text)
    .split(/(?<=[.!?;:])\s+(?=[A-ZÀ-ÖÉÈÊ0-9§])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);

// If a line begins with a structural keyword, return its level; else null.
const headingLevelOf = (line) => {
  const l = line.trim();
  for (const spec of LEVELS) {
    if (spec.re.test(l)) return spec.level;
  }
  // Short, all-uppercase standalone line → treat as a chapter-ish heading.
  if (l.length <= 60 && /[A-ZÀ-Ö]/.test(l) && l === l.toUpperCase()) return 3;
  return null;
};

// Split a heading line into its label (node title) and any inline body text.
// "Article 1 - Objet. Le present bail..." → { label, body }
const splitHeading = (line) => {
  const m = line.match(/^(.{0,80}?[.:])\s+(\S.*)$/);
  const label = clean((m ? m[1] : line)).replace(/[.:;]+$/, '');
  const body = m ? m[2] : '';
  return {
    label: label.length > 90 ? label.slice(0, 87).trimEnd() + '…' : label,
    body,
  };
};

// Break a body of text into child bullet strings (trimmed for readability).
const bodyToChildren = (text, max = 8) =>
  toSentences(text)
    .slice(0, max)
    .map((s) => (s.length > 180 ? s.slice(0, 177).trimEnd() + '…' : s));

export const buildMindMap = (title, text) => {
  const rootTitle = clean((title || 'Document').replace(/\.pdf$/i, '')) || 'Document';
  const root = { title: rootTitle, level: 0, children: [] };

  const raw = (text || '').replace(/\r/g, '').trim();
  if (!raw) {
    root.children.push('Aucun texte n’a pu être extrait de ce document.');
    return root;
  }

  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);

  // Drop a leading line that merely repeats the document title.
  if (lines.length && clean(lines[0]).toLowerCase() === rootTitle.toLowerCase()) {
    lines.shift();
  }

  // Stack of currently-open nodes, deepest last. Each carries its level so a new
  // heading can pop back to its correct parent (a Titre closes prior Chapitres,
  // a Chapitre closes prior Sections, etc.).
  const stack = [root];
  const bodyBuffer = []; // free text accruing under the current deepest node

  const flushBody = () => {
    if (!bodyBuffer.length) return;
    const owner = stack[stack.length - 1];
    for (const child of bodyToChildren(bodyBuffer.join(' '))) {
      owner.children.push(child);
    }
    bodyBuffer.length = 0;
  };

  for (const line of lines) {
    const level = headingLevelOf(line);
    if (level === null) {
      bodyBuffer.push(line);
      continue;
    }
    flushBody();
    // Pop until the top of the stack is a strictly-shallower node.
    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    const { label, body } = splitHeading(line);
    const node = { title: label, level, children: [] };
    stack[stack.length - 1].children.push(node);
    stack.push(node);
    if (body) bodyBuffer.push(body);
  }
  flushBody();

  // Fallback: no structure detected → list the key sentences directly.
  if (root.children.length === 0) {
    root.children.push({ title: 'Points clés', level: 1, children: bodyToChildren(raw, 10) });
  }

  return root;
};
