const test = require('node:test');
const assert = require('node:assert');

test('cutStatute invokes findHeadings without throwing', t => {
  const regexes = require('../utils/regexes');
  const spy = t.mock.method(regexes, 'findHeadings');

  const { cutStatute } = require('./chunkings');

  const sampleText = 'Article 1\nSome content\nArticle 2\nMore content';
  const meta = { document_id: 'doc1', type: 'statute' };

  assert.doesNotThrow(() => {
    cutStatute(sampleText, meta);
  });

  assert.ok(spy.mock.calls.length > 0);
});

test('cutPublicReport resolves entities via registry', () => {
  const { cutPublicReport } = require('./chunkings');

  const sample = 'header\nAcme\nrecommendation\n- Acme was sanctioned.';
  const meta = { document_id: 'doc2', type: 'public_report' };
  const segments = cutPublicReport(sample, meta);
  const recSegment = segments.find(s => s.role === 'recommendation');

  assert.deepStrictEqual(recSegment.metadata.entities_mentioned, [
    { name: 'ACME Corporation', sector: 'manufacturing' }
  ]);
});

