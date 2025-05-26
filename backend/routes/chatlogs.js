
const express = require('express');

const router = express.Router();

// Save chat log entry
router.post('/chat-logs', async (req, res) => {
  const { document_id, user_message, ai_response } = req.body;

  try {
    const { data, error } = await supabase
      .from('chat_logs')
      .insert([{ document_id, user_message, ai_response }])
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, chat_log: data });
  } catch (err) {
    console.error('❌ Failed to save chat log:', err);
    res.status(500).json({ error: 'Failed to save chat log' });
  }
});

const { supabase } = require('../utils/supabaseClient');


// Get chat logs for a specific document
router.get('/chatlogs/:documentId', async (req, res) => {
  const { documentId } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  try {
    const { data: logs, error } = await supabase
      .from('chat_logs')
      .select(`
        id,
        session_id,
        user_message,
        ai_response,
        created_at,
        response_time_ms,
        documents (title)
      `)
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('❌ Failed to fetch chat logs:', error.message);
      return res.status(500).json({ error: 'Failed to fetch chat logs' });
    }

    res.json({ logs, total: logs.length });
  } catch (err) {
    console.error('❌ Chat logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all chat logs (with pagination)
router.get('/chatlogs', async (req, res) => {
  const { limit = 50, offset = 0, session_id } = req.query;

  try {
    let query = supabase
      .from('chat_logs')
      .select(`
        id,
        session_id,
        document_id,
        user_message,
        ai_response,
        created_at,
        response_time_ms,
        documents (title)
      `)
      .order('created_at', { ascending: false });

    // Filter by session if provided
    if (session_id) {
      query = query.eq('session_id', session_id);
    }

    const { data: logs, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error('❌ Failed to fetch chat logs:', error.message);
      return res.status(500).json({ error: 'Failed to fetch chat logs' });
    }

    res.json({ logs, total: logs.length });
  } catch (err) {
    console.error('❌ Chat logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete chat logs for a document
router.delete('/chatlogs/:documentId', async (req, res) => {
  const { documentId } = req.params;

  try {
    const { error } = await supabase
      .from('chat_logs')
      .delete()
      .eq('document_id', documentId);

    if (error) {
      console.error('❌ Failed to delete chat logs:', error.message);
      return res.status(500).json({ error: 'Failed to delete chat logs' });
    }

    res.json({ success: true, message: 'Chat logs deleted successfully' });
  } catch (err) {
    console.error('❌ Delete chat logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;