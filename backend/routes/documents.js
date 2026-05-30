const express = require('express');
const { supabase, supabaseConfig } = require('../utils/supabaseClient');

const router = express.Router();

// Directly probe the Supabase host to distinguish *why* a "fetch failed"
// happens at the backend: DNS/wrong-URL (ENOTFOUND), firewall/paused/no-outbound
// (ETIMEDOUT), nothing listening (ECONNREFUSED), or reachable (then it's not
// connectivity). Returns a short human string; never throws.
async function probeSupabase() {
  const url = process.env.SUPABASE_URL;
  if (!url) return 'SUPABASE_URL is not set';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const r = await fetch(`${url.replace(/\/$/, '')}/auth/v1/health`, { signal: controller.signal });
    clearTimeout(timer);
    return `reachable (HTTP ${r.status})`;
  } catch (e) {
    const cause = e?.cause;
    return cause?.code || cause?.message || e?.message || 'unreachable';
  }
}

router.get('/documents', async (req, res) => {
  console.log('📡 Received request for /api/documents from frontend');

  const { data, error } = await supabase
    .from('documents')
    .select('id, title:name, uploaded_at:created_at, storage_url, text_content:full_text')
    .order('created_at', { ascending: false });



  if (error) {
    console.error('❌ Failed to fetch documents:', error.message, error.code || '', error.hint || '');

    // "fetch failed" means the backend couldn't reach Supabase — probe to pinpoint why.
    const connectivity = /fetch failed/i.test(error.message || '')
      ? await probeSupabase()
      : null;
    if (connectivity) console.error('   ↳ Supabase connectivity probe:', connectivity);

    return res.status(500).json({
      error: 'Error fetching documents',
      // Surface the real cause so it is visible in the browser/network tab.
      // No secrets are included — only presence flags and Supabase's own message.
      detail: error.message,
      code: error.code || null,
      hint: error.hint || null,
      connectivity,
      env: supabaseConfig
    });
  }

  res.json({ documents: data });
});


// GET /api/documents/:id  -> single document
router.get('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('documents')
      .select('id, title:name, uploaded_at:created_at, storage_url, text_content:full_text')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Failed to fetch document:', error.message);
      return res.status(500).json({ error: 'Error fetching document' });
    }
    if (!data) {
      return res.status(404).json({ error: 'Document not found' });
    }
    return res.json({ document: data });
  } catch (e) {
    console.error('❌ /documents/:id error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});



module.exports = router;
