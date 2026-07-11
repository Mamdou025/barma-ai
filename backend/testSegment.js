// backend/testSegment.js
// Segment a local fixture file and print the result — fully offline, no Supabase
// or OpenAI. Use it to iterate on segmenter.js quickly.
//
// Usage:
//   node testSegment.js test-fixtures/codedutravail.txt
//   node testSegment.js test-fixtures/codedutravail.txt L.29   (show one article)
const fs = require('fs');
const path = require('path');
const { segmentWholeDocument } = require('./services/segmenter');

function main() {
  const file = process.argv[2];
  const wanted = process.argv[3]; // optional: an article number to inspect
  if (!file) {
    console.log('Usage: node testSegment.js <path-to-.txt> [articleNumber]');
    return;
  }
  const text = fs.readFileSync(path.resolve(file), 'utf8');
  const title = path.basename(file).replace(/\.txt$/i, '.pdf');

  const r = segmentWholeDocument({ documentId: 'fixture', title, text, maxPreviewChars: 200000 });
  console.log(`type: ${r.detected_type} | segments: ${r.segments.length}`);

  const numbers = r.segments.map(s => s?.meta?.number).filter(Boolean);
  console.log(`articles parsed: ${numbers.length}`);
  console.log(`first: ${numbers.slice(0, 8).join(', ')}`);
  console.log(`last:  ${numbers.slice(-8).join(', ')}`);

  if (wanted) {
    const seg = r.segments.find(s => s?.meta?.number === wanted);
    console.log(`\n── Article ${wanted} ──`);
    console.log(seg ? seg.text.slice(0, 1200) : '(not found as its own segment)');
  }
}

main();
