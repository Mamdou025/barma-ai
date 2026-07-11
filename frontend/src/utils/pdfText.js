// Client-side PDF text extraction using pdf.js. This runs entirely in the
// browser so documents can be processed without a backend or database.
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';

// The worker is copied into /public (see build setup) so it is served from the
// same origin — no CDN / cross-origin dependency.
pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || ''}/pdf.worker.min.js`;

// Extract the full text of a PDF File/Blob, page by page.
// Returns a single string with page breaks between pages.
export const extractPdfText = async (file) => {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const pages = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // pdf.js returns positioned text items; reassemble into lines by tracking
    // vertical position so headings stay on their own line where possible.
    let text = '';
    let lastY = null;
    for (const item of content.items) {
      const str = item.str || '';
      const y = item.transform ? item.transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
        text += '\n';
      } else if (text && !text.endsWith(' ') && !text.endsWith('\n')) {
        text += ' ';
      }
      text += str;
      lastY = y;
    }
    pages.push(text.trim());
  }

  return pages.join('\n\n').replace(/[ \t]+\n/g, '\n').trim();
};
