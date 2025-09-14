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

