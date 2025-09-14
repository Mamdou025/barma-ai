const pdfParse = require('pdf-parse');

function stripHeadersFooters(pages) {
  const headerCounts = new Map();
  const footerCounts = new Map();
  const trimLine = (line) => line.trim();

  pages.forEach((page) => {
    const lines = page.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (!lines.length) return;
    const top = trimLine(lines[0]);
    const bottom = trimLine(lines[lines.length - 1]);
    if (top) headerCounts.set(top, (headerCounts.get(top) || 0) + 1);
    if (bottom) footerCounts.set(bottom, (footerCounts.get(bottom) || 0) + 1);
  });

  const pageThreshold = Math.max(2, Math.floor(pages.length * 0.6));
  let header = null;
  for (const [line, count] of headerCounts.entries()) {
    if (count >= pageThreshold) {
      header = line;
      break;
    }
  }

  let footer = null;
  for (const [line, count] of footerCounts.entries()) {
    if (count >= pageThreshold) {
      footer = line;
      break;
    }
  }

  return pages.map((page) => {
    const lines = page.split(/\r?\n/);
    const filtered = lines.filter((line, idx) => {
      const trimmed = trimLine(line);
      if (header && idx === 0 && trimmed === header) return false;
      if (footer && idx === lines.length - 1 && trimmed === footer) return false;
      return true;
    });
    return filtered.join('\n');
  });
}

function mergeHyphenatedWords(text) {
  return text.replace(/-\n\s*/g, '-');
}

function preserveFootnoteAnchors(text) {
  return text.replace(/\s*(\[\d+\]|\(\d+\)|\^\d+)/g, ' $1');
}

function detectTables(pages) {
  const tableRegex = /table\s+\d+/i;
  const tables = [];
  pages.forEach((page) => {
    page.split(/\n/).forEach((line) => {
      if (tableRegex.test(line)) {
        tables.push({ caption: line.trim(), csv: null });
      }
    });
  });
  return tables;
}

async function extractTextWithHelpers(buffer) {
  const rawPages = [];
  let data;
  try {
    data = await pdfParse(buffer, {
      pagerender: (pageData) =>
        pageData.getTextContent().then((textContent) => {
          const text = textContent.items.map((item) => item.str).join(' ');
          rawPages.push(text);
          return text;
        }),
    });
  } catch (err) {
    if (
      err?.message?.includes('FormatError') ||
      err?.name?.includes('FormatError')
    ) {
      throw new Error('Invalid PDF structure');
    }
    throw err;
  }

  let pages = stripHeadersFooters(rawPages).map((p) => mergeHyphenatedWords(p));
  let text = pages.join('\n');
  text = preserveFootnoteAnchors(text);
  const tables = detectTables(pages);

  return { ...data, text, tables };
}

module.exports = {
  stripHeadersFooters,
  mergeHyphenatedWords,
  preserveFootnoteAnchors,
  detectTables,
  extractTextWithHelpers,
};
