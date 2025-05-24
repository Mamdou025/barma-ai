const express = require('express');
const { supabase } = require('../utils/supabaseClient');

const router = express.Router();

router.get('/documents', async (req, res) => {
  console.log('📡 Received request for /api/documents from frontend');

  const { data, error } = await supabase
    .from('documents')
    .select('id, title, uploaded_at, storage_url, text_content')
    .order('uploaded_at', { ascending: false });

    

  if (error) {
    console.error('❌ Failed to fetch documents:', error.message);
    return res.status(500).json({ error: 'Error fetching documents' });
  }

  res.json({ documents: data });
});

module.exports = router;
