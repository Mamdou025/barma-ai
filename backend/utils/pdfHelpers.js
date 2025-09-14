const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

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

function detectTables(pages, outputDir) {
  const tableRegex = /^table\s+\d+/i;
  const tables = [];
  fs.mkdirSync(outputDir, { recursive: true });
  let idx = 1;

  pages.forEach((page) => {
    const lines = page.split(/\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (tableRegex.test(line)) {
        const id = `table-${idx++}`;
        const caption = line;
        const rows = [];
        i++;
        while (i < lines.length && lines[i].trim() !== '') {
          rows.push(lines[i]);
          i++;
        }
        let csvPath = null;
        if (rows.length) {
          const csv = rows
            .map((r) =>
              r
                .trim()
                .split(/\s{2,}|\t/)
                .map((c) => `"${c.replace(/"/g, '""')}"`)
                .join(',')
            )
            .join('\n');
          const filename = `${id}.csv`;
          csvPath = path.join(outputDir, filename);
          fs.writeFileSync(csvPath, csv, 'utf8');
        }
        tables.push({ id, caption, csv_url: csvPath });
      }
    }
  });
  return tables;
}

async function extractTextWithHelpers(buffer, outputDir = '.') {
  const rawPages = [];
  try {
    await pdfParse(buffer, {
      pagerender: (pageData) =>
        pageData.getTextContent().then((textContent) => {
          const text = textContent.items
            .map((item) => item.str + (item.hasEOL ? '\n' : ' '))
            .join('');
          rawPages.push(text.trim());
          return text;
        }),
    });
  } catch (err) {
    if (err?.message?.includes('FormatError') || err?.name?.includes('FormatError')) {
      throw new Error('Invalid PDF structure');
    }
    throw err;
  }

  const pages = stripHeadersFooters(rawPages).map((p) => mergeHyphenatedWords(p));
  let text = pages.join('\n');
  text = preserveFootnoteAnchors(text);
  const tables = detectTables(pages, outputDir);

  return { text, tables };
}

module.exports = {
  stripHeadersFooters,
  mergeHyphenatedWords,
  preserveFootnoteAnchors,
  detectTables,
  extractTextWithHelpers,
};
