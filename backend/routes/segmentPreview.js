// backend/routes/segmentPreview.js
const express = require('express');
const { supabase } = require('../utils/supabaseClient');
const { segmentWholeDocument } = require('../services/segmenter');

const router = express.Router();

// helper to trim quotes/newlines/tabs etc.
const sanitizeUuid = (val) =>
  String(val ?? '')
    .trim()
    .replace(/[\r\n\t]/g, '')
    .replace(/^"+|"+$/g, ''); // strip accidental quotes

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Read-only preview of segmentation. No writes. Safe to call anytime.
 * GET /api/segment-preview?document_id=...&maxPreviewChars=50000
 */
router.get('/segment-preview', async (req, res) => {
  try {
    const rawId = req.query.document_id ?? req.query.doc_id;
    if (!rawId) return res.status(400).json({ error: "Missing 'document_id' query param" });

    const documentId = sanitizeUuid(rawId);

    // (optional but helpful) validate uuid shape
    if (!UUID_RE.test(documentId)) {
      return res.status(400).json({ error: 'Invalid document_id format', received: documentId });
    }

    const maxPreviewChars = req.query.maxPreviewChars
      ? Math.max(1000, Math.min(200000, parseInt(req.query.maxPreviewChars, 10) || 50000))
      : 50000;

    const { data, error } = await supabase
      .from('documents')
      .select('id, title, text_content')
      .eq('id', documentId)
      .single();

    if (error) {
      console.error('❌ Supabase error fetching document:', error.message, { documentId });
      return res.status(500).json({ error: 'Error fetching document' });
    }
    if (!data) return res.status(404).json({ error: 'Document not found' });

    const payload = segmentWholeDocument({
      documentId: data.id,
      title: data.title,
      text: data.text_content || '',
      maxPreviewChars
    });

    return res.json(payload);
  } catch (err) {
    console.error('❌ segment-preview failure:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
