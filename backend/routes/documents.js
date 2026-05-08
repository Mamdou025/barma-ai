const express = require('express');
const { supabase } = require('../utils/supabaseClient');

const router = express.Router();

router.get('/documents', async (req, res) => {
  console.log('📡 Received request for /api/documents from frontend');

  const { data, error } = await supabase
    .from('documents')
    .select('id, title:name, uploaded_at:created_at, storage_url, text_content:full_text')
    .order('created_at', { ascending: false });

    

  if (error) {
    console.error('❌ Failed to fetch documents:', error.message);
    return res.status(500).json({ error: 'Error fetching documents' });
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
