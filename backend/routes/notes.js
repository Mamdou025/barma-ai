const express = require('express');
const { supabase } = require('../utils/supabaseClient');


const router = express.Router();

// Save or update notes for a document
router.post('/notes', async (req, res) => {
  const { document_id, content } = req.body;

  try {
    // Check if notes already exist for this document
    const { data: existing } = await supabase
      .from('notes')
      .select('id')
      .eq('document_id', document_id)
      .single();

    let result;
    if (existing) {
      // Update existing notes
      const { data, error } = await supabase
        .from('notes')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('document_id', document_id)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    } else {
      // Create new notes
      const { data, error } = await supabase
        .from('notes')
        .insert([{ document_id, content }])
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }

    res.json({ success: true, notes: result });
  } catch (err) {
    console.error('❌ Failed to save notes:', err);
    res.status(500).json({ error: 'Failed to save notes' });
  }
});

// Get notes for a document
router.get('/notes/:documentId', async (req, res) => {
  const { documentId } = req.params;

  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('document_id', documentId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      throw error;
    }

    res.json({ notes: data || { content: '' } });
  } catch (err) {
    console.error('❌ Failed to fetch notes:', err);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

module.exports = router;