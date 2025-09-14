const test = require('node:test');
const assert = require('node:assert');

// Utility to create a minimal response object
function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test('upload route processes public reports and stores segments', async () => {
  let usedCutter = '';
  let insertedSegments;

  const fakeSupabase = {
    storage: {
      from() {
        return {
          upload: async () => ({ data: {}, error: null }),
          getPublicUrl: () => ({ data: { publicUrl: 'http://example.com/fake.pdf' } })
        };
      }
    },
    from(table) {
      if (table === 'documents') {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: 'doc123' }, error: null })
            })
          })
        };
      }
      if (table === 'document_segments') {
        return {
          insert: async (rows) => {
            insertedSegments = rows;
            return { error: null };
          }
        };
      }
      return {};
    }
  };

  // Patch modules before requiring the route
  const pdfHelpers = require('../utils/pdfHelpers.js');
  pdfHelpers.extractTextWithHelpers = async () => ({
    text: 'Executive Summary\nObservation 1\nRecommendation\n- Do something',
    tables: []
  });

  process.env.SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_SERVICE_KEY = 'key';
  const supabaseClient = require('../utils/supabaseClient.js');
  supabaseClient.supabase = fakeSupabase;

  process.env.OPENAI_API_KEY = 'test';
  const embedding = require('../services/embedding.js');
  embedding.embedAndStoreSegments = async (segments, { supabase }) => {
    await supabase.from('document_segments').insert(segments);
  };

  const graphBuilder = require('../utils/graphBuilder.js');
  graphBuilder.extractAndBuildEdges = () => ({ edges: [], unresolved: [] });
  graphBuilder.persistEdges = async () => {};

  const chunkings = require('../services/chunkings.js');
  chunkings.cutStatute = () => { usedCutter = 'statute'; return []; };
  chunkings.cutRegulation = () => { usedCutter = 'regulation'; return []; };
  chunkings.cutJudgment = () => { usedCutter = 'judgment'; return []; };
  chunkings.cutDoctrine = () => { usedCutter = 'doctrine'; return []; };
  chunkings.cutPublicReport = (text, meta) => {
    usedCutter = 'public_report';
    return [
      {
        document_id: meta.document_id,
        type: meta.type,
        role: 'executive_summary',
        text: 'summary',
        metadata: {}
      }
    ];
  };

  const router = require('./upload');
  const layer = router.stack.find(
    (l) => l.route && l.route.path === '/upload'
  );
  const handler = layer.route.stack[1].handle;

  const req = {
    file: {
      path: '/tmp/fake.pdf',
      mimetype: 'application/pdf',
      originalname: 'r.pdf'
    }
  };
  const res = createRes();

  const fs = require('fs');
  fs.readFileSync = () => Buffer.from('%PDF-1.4');
  fs.unlinkSync = () => {};

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(usedCutter, 'public_report', 'cutPublicReport was not used');
  assert.ok(insertedSegments, 'segments were not inserted');
  assert.equal(insertedSegments[0].document_id, 'doc123');
});
