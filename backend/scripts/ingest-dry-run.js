#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { extractTextWithHelpers } = require('../utils/pdfHelpers.js');
const regexes = require('../utils/regexes.js');

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name) => {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
  };
  return { file: get('file'), type: get('type') || 'auto' };
}

function detectType(text) {
  const header = text.slice(0, 1000);
  const test = (re) => {
    re.lastIndex = 0;
    return re.test(header);
  };
  if (test(regexes.regulations.visa)) return 'regulation';
  if (test(regexes.statutes.articleMarker)) return 'statute';
  if (test(regexes.judgments.headings.facts)) return 'judgment';
  if (test(regexes.doctrine.resume)) return 'doctrine';
  if (test(regexes.publicReports.executiveSummary)) return 'public_report';
  return 'unknown';
}

function summarize(segments) {
  const summary = {
    roles: {},
    cross_refs: [],
    cases_cited: [],
    statutes_cited: [],
    entities: [],
    irregularities: [],
    amounts: []
  };
  const pushUnique = (arr, list = []) =>
    list.forEach((item) => item && !arr.includes(item) && arr.push(item));

  segments.forEach((seg) => {
    summary.roles[seg.role] = (summary.roles[seg.role] || 0) + 1;
    const md = seg.metadata || {};
    pushUnique(summary.cross_refs, md.cross_refs);
    pushUnique(summary.cases_cited, md.cases_cited);
    pushUnique(summary.statutes_cited, md.statutes_cited);
    pushUnique(summary.entities, md.entities || md.entities_mentioned);
    pushUnique(summary.irregularities, md.irregularities);
    pushUnique(summary.amounts, md.amounts);
  });
  return summary;
}

async function run() {
  const { file, type } = parseArgs();
  if (!file) {
    console.error('Usage: node scripts/ingest-dry-run.js --file=/path/to.pdf [--type=auto]');
    process.exit(1);
  }

  const resolved = path.resolve(file);
  const buffer = fs.readFileSync(resolved);
  const { text, tables } = await extractTextWithHelpers(buffer, path.dirname(resolved));

  const docType = type === 'auto' ? detectType(text) : type;
  console.log(`Document type: ${docType}`);

  const meta = { document_id: 'dry-run', type: docType };
  const chunkings = await import('../services/chunkings.js');

  let segments = [];
  switch (docType) {
    case 'statute':
      segments = chunkings.cutStatute(text, meta);
      break;
    case 'regulation':
      segments = chunkings.cutRegulation(text, meta);
      break;
    case 'judgment':
      segments = chunkings.cutJudgment(text, meta);
      break;
    case 'doctrine':
      segments = chunkings.cutDoctrine(text, meta);
      break;
    case 'public_report':
      segments = chunkings.cutPublicReport(text, meta, tables);
      break;
    default:
      console.error('❌ Could not detect document type. Use --type to specify.');
      process.exit(1);
  }

  const summary = summarize(segments);
  console.log('Summary:', summary);

  const report = { file: path.resolve(file), type: docType, summary, segments };
  fs.writeFileSync('/tmp/barma-ingest-report.json', JSON.stringify(report, null, 2));
  console.log('Report written to /tmp/barma-ingest-report.json');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
