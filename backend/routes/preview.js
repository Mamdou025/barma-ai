// routes/preview.js

const express = require('express');
const { parsedTexts } = require('./upload');

const router = express.Router();

router.post('/preview', (req, res) => {
  const { filename } = req.body;

  if (!parsedTexts[filename]) {
    return res.status(404).json({ error: 'Texte non trouvé pour ce fichier.' });
  }

  res.json({ text: parsedTexts[filename] });
});

module.exports = router;
