// backend/scripts/exportFixture.js
// Export a document from Supabase into test-fixtures/ for offline testing.
//
// Usage:
//   node scripts/exportFixture.js                 -> exports the default doc below
//   node scripts/exportFixture.js <document-id>   -> exports a specific document
//
// Writes <name>.txt (the exact full_text used by chat/retrieval) and, when the
// stored PDF is reachable, <name>.pdf.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { supabase } = require('../utils/supabaseClient');

const DEFAULT_DOC_ID = '4bc088f6-bc2e-42eb-bf68-02dbd5a70c77'; // codedutravail.pdf
const BUCKET = process.env.SUPABASE_BUCKET || 'documents';
const OUT_DIR = path.join(__dirname, '..', 'test-fixtures');

function safeBase(name) {
  return String(name || 'document')
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 80) || 'document';
}

async function main() {
  const docId = process.argv[2] || DEFAULT_DOC_ID;
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, name, full_text, storage_path')
    .eq('id', docId)
    .single();

  if (error) return console.error('❌ Could not fetch document:', error.message);
  if (!doc) return console.error('❌ No document with id', docId);

  const base = safeBase(doc.name);

  // 1) full_text -> .txt  (this is what the AI actually reads)
  const txtPath = path.join(OUT_DIR, `${base}.txt`);
  fs.writeFileSync(txtPath, doc.full_text || '', 'utf8');
  console.log(`✅ ${path.relative(path.join(__dirname, '..'), txtPath)}  (${(doc.full_text || '').length} chars)`);

  // 2) stored PDF -> .pdf  (best-effort; needs the file to still exist in storage)
  if (doc.storage_path) {
    const { data: file, error: dlErr } = await supabase.storage.from(BUCKET).download(doc.storage_path);
    if (dlErr) {
      console.warn(`⚠️  PDF download skipped: ${dlErr.message}`);
    } else {
      const buf = Buffer.from(await file.arrayBuffer());
      const pdfPath = path.join(OUT_DIR, `${base}.pdf`);
      fs.writeFileSync(pdfPath, buf);
      console.log(`✅ ${path.relative(path.join(__dirname, '..'), pdfPath)}  (${buf.length} bytes)`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
