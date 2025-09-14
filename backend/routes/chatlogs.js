
const express = require('express');
const { supabase } = require('../utils/supabaseClient');

const router = express.Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Save chat log entry
router.post('/chat-logs', async (req, res) => {
  const { document_id, user_message, ai_response } = req.body;

  if (!UUID_REGEX.test(document_id)) {
    return res.status(400).json({ error: 'document_id must be a valid UUID' });
  }

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

// Get chat logs for a specific document
router.get('/chatlogs/:documentId', async (req, res) => {
  const { documentId } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  if (!UUID_REGEX.test(documentId)) {
    return res.status(400).json({ error: 'documentId must be a valid UUID' });
  }

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

  if (!UUID_REGEX.test(documentId)) {
    return res.status(400).json({ error: 'documentId must be a valid UUID' });
  }

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