const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const pdfModulePath = path.dirname(require.resolve('pdf-parse/package.json'));
const validPdf = path.join(pdfModulePath, 'test', 'data', '04-valid.pdf');
const invalidPdf = path.join(pdfModulePath, 'test', 'data', '03-invalid.pdf');

const pdfHelpersPath = require.resolve('./pdfHelpers');

test('extractTextWithHelpers parses PDF text', async () => {
  delete require.cache[pdfHelpersPath];
  const { extractTextWithHelpers } = require(pdfHelpersPath);
  const buffer = fs.readFileSync(validPdf);
  const result = await extractTextWithHelpers(buffer);
  assert.ok(
    result.text.includes('Turk J Med Sci'),
    'Expected text not found in parsed PDF'
  );
});

test('extractTextWithHelpers rethrows non-FormatError exceptions', async () => {
  delete require.cache[pdfHelpersPath];
  const { extractTextWithHelpers } = require(pdfHelpersPath);
  const buffer = fs.readFileSync(invalidPdf);
  await assert.rejects(
    () => extractTextWithHelpers(buffer),
    (err) =>
      err.name === 'UnknownErrorException' &&
      /invalid top-level pages dictionary/.test(err.message)
  );
});

test('extractTextWithHelpers converts FormatError to Invalid PDF structure', async () => {
  const pdfParsePath = require.resolve('pdf-parse');
  const originalPdfParse = require(pdfParsePath);
  const mockErr = new Error('bad format');
  mockErr.name = 'FormatError';
  require.cache[pdfParsePath].exports = () => Promise.reject(mockErr);
  delete require.cache[pdfHelpersPath];
  const { extractTextWithHelpers } = require(pdfHelpersPath);
  await assert.rejects(
    () => extractTextWithHelpers(Buffer.from('')), 
    /Invalid PDF structure/
  );
  require.cache[pdfParsePath].exports = originalPdfParse;
  delete require.cache[pdfHelpersPath];
});
