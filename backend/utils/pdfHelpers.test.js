const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { extractTextWithHelpers } = require('./pdfHelpers');

const pdfModulePath = path.dirname(require.resolve('pdf-parse/package.json'));
const validPdf = path.join(pdfModulePath, 'test', 'data', '04-valid.pdf');
const invalidPdf = path.join(pdfModulePath, 'test', 'data', '03-invalid.pdf');

test('extractTextWithHelpers parses PDF text', async () => {
  const buffer = fs.readFileSync(validPdf);
  const result = await extractTextWithHelpers(buffer);
  assert.ok(
    result.text.includes('Turk J Med Sci'),
    'Expected text not found in parsed PDF'
  );
});

test('extractTextWithHelpers rejects invalid PDFs', async () => {
  const buffer = fs.readFileSync(invalidPdf);
  await assert.rejects(
    () => extractTextWithHelpers(buffer),
    /Invalid PDF structure/
  );
});
