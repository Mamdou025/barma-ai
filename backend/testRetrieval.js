// backend/testRetrieval.js
// Inspect what the AI actually retrieves for your real documents.
//
// Usage:
//   node testRetrieval.js                       -> list docs: full_text length, type, #segments
//   node testRetrieval.js <docId> "question"    -> show the context that would be sent to the model
require('dotenv').config();
const { supabase } = require('./utils/supabaseClient');
const { segmentWholeDocument } = require('./services/segmenter');
const { retrieveGraph } = require('./services/retriever_graph');

async function main() {
  const [docId, ...rest] = process.argv.slice(2);
  const question = rest.join(' ');

  if (!docId) {
    const { data, error } = await supabase.from('documents').select('id, name, full_text');
    if (error) return console.error('❌ DB error:', error.message);
    if (!data || !data.length) return console.log('No documents in the database.');
    for (const d of data) {
      const text = d.full_text || '';
      const seg = segmentWholeDocument({ documentId: d.id, title: d.name, text, maxPreviewChars: 200000 });
      console.log(`\n• ${d.name}`);
      console.log(`  id:        ${d.id}`);
      console.log(`  full_text: ${text.length} chars ${text.length ? '' : '  ⚠️  EMPTY — the AI has nothing to read for this doc'}`);
      console.log(`  detected:  ${seg.detected_type} | segments: ${seg.segments.length}`);
    }
    console.log('\n→ Next: node testRetrieval.js <id from above> "your question"');
    return;
  }

  console.log(`Question: ${question || '(default)'}\n`);
  const { contextText, selected, debug } = await retrieveGraph({
    message: question || 'Quelles sont les obligations principales ?',
    document_ids: [docId],
    maxSegments: 8, expandHops: 1, maxCharsPerSegment: 1200,
  });
  console.log('Selected segments:', selected.length);
  console.log('Seeds (top matches):', JSON.stringify(debug?.seeds || [], null, 2));
  console.log('\n────────── CONTEXT SENT TO THE MODEL (first 4000 chars) ──────────\n');
  console.log((contextText || '(empty)').slice(0, 4000));
}

main().catch(e => { console.error(e); process.exit(1); });
