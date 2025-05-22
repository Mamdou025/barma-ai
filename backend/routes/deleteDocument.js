const express = require('express');
const { supabase } = require('../utils/supabaseClient');

const router = express.Router();

router.delete('/documents/:id', async (req, res) => {
  const documentId = req.params.id;

  // 1. Fetch the document to get the storage path
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('storage_url')
    .eq('id', documentId)
    .single();

  if (docError || !doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Extract bucket path (e.g. "public/myfile.pdf")
  const path = doc.storage_url.split('/storage/v1/object/public/')[1];

  // 2. Delete the file from Supabase Storage
  const { error: storageError } = await supabase.storage.from('pdfs').remove([path]);
  if (storageError) {
    console.error('Failed to delete file:', storageError);
    return res.status(500).json({ error: 'Failed to delete file from storage' });
  }

  // 3. Delete chunks
  await supabase.from('chunks').delete().eq('document_id', documentId);

  // 4. Delete document record
  await supabase.from('documents').delete().eq('id', documentId);

  res.status(200).json({ success: true });
});

module.exports = router;
