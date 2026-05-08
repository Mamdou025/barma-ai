const express = require('express');
const openai = require('../utils/openaiClient');
const { supabase } = require('../utils/supabaseClient');

const router = express.Router();

router.post('/mindmap', async (req, res) => {
  const { document_ids } = req.body;

  console.log('🟡 Received document_ids:', document_ids);

  try {
    const { data: docs, error: fetchErr } = await supabase
      .from('documents')
      .select('full_text')
      .in('id', document_ids);

    if (fetchErr || !docs) {
      console.error('❌ Failed to fetch document text:', fetchErr);
      return res.status(500).json({ error: 'Failed to load document text.' });
    }

    const fullText = docs.map(doc => doc.full_text).join('\n\n');
    console.log('🧠 Sending full text to GPT:', fullText.slice(0, 300)); // log only start

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `Tu es un assistant juridique. À partir d’un texte de décision judiciaire, génère une mind map hiérarchisée sous format JSON avec les clés : "title" (string) et "children" (array récursive).

Structure logique : Parties, Faits, Articles de loi, Motifs, Conclusion. Par contre il s'agit d'un resumé et les documents ne suivent pas une structure attendue mais determine les elements importnts et génère quand meme un mindmap qui sort l'essentiel du document logiquement. Evite aussi de generer des mindmaps avec des sections vides 

Retourne uniquement un objet JSON. Exemple :
{
  "title": "Résumé",
  "children": [
    { "title": "Faits", "children": ["A", "B", "C"] },
    { "title": "Articles", "children": ["Article 1", "Article 2"] }
  ]
}`
        },
        { role: 'user', content: fullText }
      ]
    });

    const raw = completion.choices[0].message.content;
    console.log('🟢 GPT raw response:', raw);

    let mindmap;
    try {
      mindmap = JSON.parse(raw);
    } catch (e) {
      console.error('❌ GPT did not return valid JSON:', raw);
      return res.status(500).json({ error: 'Mind map format error from GPT' });
    }

    res.json({ mindmap });

  } catch (err) {
    console.error('❌ GPT API Error:', err);
    res.status(500).json({ error: 'Erreur lors de la génération de la mind map.' });
  }
});

module.exports = router;

