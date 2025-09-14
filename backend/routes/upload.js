// routes/upload.js

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { extractTextWithHelpers } = require('../utils/pdfHelpers');
const { supabase } = require('../utils/supabaseClient');
const regexes = require('../utils/regexes');
const graphBuilder = require('../utils/graphBuilder');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Preload ESM services using dynamic import
const chunkingsPromise = import('../services/chunkings.js');
const embeddingPromise = import('../services/embedding.js');

router.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const dataBuffer = fs.readFileSync(file.path);
    const hasPDFHeader = dataBuffer.slice(0, 4).toString() === '%PDF';
    const isPDFMime = file.mimetype === 'application/pdf';
    if (!hasPDFHeader || !isPDFMime) {
      fs.unlinkSync(file.path);
      return res
        .status(400)
        .json({ error: 'Invalid or corrupted PDF file' });
    }

    const parsedData = await extractTextWithHelpers(dataBuffer);
    const headerSample = parsedData.text.slice(0, 200);

    console.log(`✅ Extracted text from ${file.originalname}:\n`);
    console.log(headerSample);

    // Detect document family
    let family = 'statute';
    const { statutes, regulations, judgments, doctrine, publicReports } = regexes;
    if (regulations.visa.test(headerSample) || regulations.considerants.test(headerSample)) {
      family = 'regulation';
    } else if (
      judgments.headings.facts.test(headerSample) ||
      judgments.neutralCitation.test(headerSample)
    ) {
      family = 'judgment';
    } else if (doctrine.resume.test(headerSample)) {
      family = 'doctrine';
    } else if (publicReports.executiveSummary.test(headerSample)) {
      family = 'public_report';
    } else if (statutes.articleMarker.test(headerSample)) {
      family = 'statute';
    }

    // Generate a unique filename for storage
    const fileExt = path.extname(file.originalname);
    const uniqueFilename = `${crypto.randomUUID()}${fileExt}`;

    // Upload file to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from('pdfs')
      .upload(uniqueFilename, dataBuffer, {
        contentType: file.mimetype,
      });

    if (uploadErr) {
      console.error('❌ Failed to upload to Supabase Storage:', uploadErr.message);
      return res.status(500).json({ error: 'Failed to upload file to storage' });
    }

    // Get the public URL
    const { data: publicURLData } = supabase.storage
      .from('pdfs')
      .getPublicUrl(uniqueFilename);

    const publicURL = publicURLData.publicUrl;

    // Insert document metadata into the database
    const { data: docInsert, error: insertErr } = await supabase
      .from('documents')
      .insert([
        {
          title: file.originalname,
          filename: uniqueFilename,
          storage_url: publicURL,
          text_content: parsedData.text,
        },
      ])
      .select()
      .single();

    if (insertErr) {
      console.error('❌ Failed to save document:', insertErr.message);
      return res.status(500).json({ error: 'Failed to store document' });
    }

    // Dynamically load cutters and embedding service
    const {
      cutStatute,
      cutRegulation,
      cutJudgment,
      cutDoctrine,
      cutPublicReport,
    } = await chunkingsPromise;
    const { embedAndStoreSegments } = await embeddingPromise;

    const meta = { doc_id: docInsert.id, type: family };
    let segments = [];
    switch (family) {
      case 'regulation':
        segments = cutRegulation(parsedData.text, meta);
        break;
      case 'judgment':
        segments = cutJudgment(parsedData.text, meta);
        break;
      case 'doctrine':
        segments = cutDoctrine(parsedData.text, meta);
        break;
      case 'public_report':
        segments = cutPublicReport(parsedData.text, meta);
        break;
      case 'statute':
      default:
        segments = cutStatute(parsedData.text, meta);
        break;
    }

    segments = segments.map((s) => ({ ...s, document_id: s.doc_id }));

    await embedAndStoreSegments(segments, { supabase });

    const { edges, unresolved } = graphBuilder.extractAndBuildEdges(segments);
    await graphBuilder.persistEdges(edges, { supabase });
    if (unresolved.length) {
      console.log('⚠️ Unresolved edges:', unresolved.length);
    }

    fs.unlinkSync(file.path);

    const typesDetected = [...new Set(segments.map((s) => s.type))];
    const rolesCount = segments.reduce((acc, seg) => {
      acc[seg.role] = (acc[seg.role] || 0) + 1;
      return acc;
      }, {});

    res.json({
      message: 'PDF parsed, segmented, embedded, and uploaded successfully',
      public_url: publicURL,
      segments_count: segments.length,
      types_detected: typesDetected,
      roles_count: rolesCount,
    });

  } catch (err) {
    console.error('❌ PDF parse error:', err);
    res.status(500).json({ error: 'Failed to parse and embed PDF' });
  }
});

module.exports = router;
