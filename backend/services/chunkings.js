// services/chunking.js
// services/chunkings.js

import {
  findHeadings,
  findCitations,
  articleMarkerRegex,
  alineaMarkerRegex
} from '../utils/regexes.js';

function countTokens(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).length;
}

function createSegment(meta, role, text, extra = {}) {
  return {
    doc_id: meta.doc_id,
    type: meta.type,
    role,
    text: text.trim(),
    metadata: { ...extra }
  };
}

function splitByRegex(text, regex) {
  const matches = [...text.matchAll(regex)];
  const segments = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = matches[i + 1]?.index ?? text.length;
    const part = text.slice(start, end);
    segments.push({ marker: matches[i], text: part });
  }
  return segments;
}

export function cutStatute(docText, meta) {
  const segments = [];
  const articles = splitByRegex(docText, articleMarkerRegex);

  articles.forEach(({ marker, text }) => {
    const articleNumber = marker[2];
    const tokens = countTokens(text);
    if (tokens > 900) {
      const parts = text.split(alineaMarkerRegex).filter(t => t.trim());
      parts.forEach((p, idx) => {
        segments.push(
          createSegment(meta, 'article', p, {
            article_number: `${articleNumber}${idx ? `-${idx + 1}` : ''}`,
            breadcrumb: findHeadings(p),
            marginal_notes: findHeadings(p),
            cross_refs: findCitations(p),
            definitions_used: []
          })
        );
      });
    } else {
      segments.push(
        createSegment(meta, 'article', text, {
          article_number: articleNumber,
          breadcrumb: findHeadings(text),
          marginal_notes: findHeadings(text),
          cross_refs: findCitations(text),
          definitions_used: []
        })
      );
    }
  });
  return segments;
}

export function cutRegulation(docText, meta) {
  return cutStatute(docText, meta);
}

function splitSections(docText, roles) {
  const lines = docText.split(/\n+/);
  const sections = {};
  let current = roles[0];
  sections[current] = [];
  lines.forEach(line => {
    const lower = line.trim().toLowerCase();
    if (roles.includes(lower)) {
      current = lower;
      if (!sections[current]) sections[current] = [];
    } else {
      if (!sections[current]) sections[current] = [];
      sections[current].push(line);
    }
  });
  return sections;
}

function chunkParagraphs(text, minTokens, maxTokens, overlapTokens, meta, role) {
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let current = [];
  let tokens = 0;
  paragraphs.forEach(p => {
    const t = countTokens(p);
    if (tokens + t > maxTokens && tokens >= minTokens) {
      chunks.push(current.join('\n\n'));
      if (overlapTokens > 0) {
        let overlap = [];
        let ot = 0;
        for (let i = current.length - 1; i >= 0 && ot < overlapTokens; i--) {
          overlap.unshift(current[i]);
          ot += countTokens(current[i]);
        }
        current = overlap;
        tokens = ot;
      } else {
        current = [];
        tokens = 0;
      }
    }
    current.push(p);
    tokens += t;
  });
  if (current.length) chunks.push(current.join('\n\n'));

  return chunks.map(c =>
    createSegment(meta, role, c, {
      cases_cited: findCitations(c).filter(x => /v\.|vs\./i.test(x)),
      statutes_cited: findCitations(c).filter(x => /art\.|article/i.test(x))
    })
  );
}

export function cutJudgment(docText, meta) {
  const roles = ['header', 'facts', 'arguments', 'reasons', 'disposition', 'signatures'];
  const sections = splitSections(docText, roles);
  const segments = [];

  if (sections.header) {
    segments.push(createSegment(meta, 'header', sections.header.join('\n'), {}));
  }
  if (sections.facts) {
    segments.push(
      ...chunkParagraphs(sections.facts.join('\n'), 300, 700, 0, meta, 'facts')
    );
  }
  if (sections.arguments) {
    segments.push(createSegment(meta, 'arguments', sections.arguments.join('\n'), {}));
  }
  if (sections.reasons) {
    segments.push(
      ...chunkParagraphs(sections.reasons.join('\n'), 400, 900, 80, meta, 'reasons')
    );
  }
  if (sections.disposition) {
    const text = sections.disposition.join('\n');
    segments.push(
      createSegment(meta, 'disposition', text, {
        outcome: text.split(/\n/)[0] || '',
        cases_cited: findCitations(text).filter(x => /v\.|vs\./i.test(x)),
        statutes_cited: findCitations(text).filter(x => /art\.|article/i.test(x))
      })
    );
  }
  if (sections.signatures) {
    segments.push(createSegment(meta, 'signatures', sections.signatures.join('\n'), {}));
  }
  return segments;
}

export function cutDoctrine(docText, meta) {
  const roles = ['header', 'abstract', 'body', 'conclusion', 'notes', 'bibliography'];
  const sections = splitSections(docText, roles);
  const segments = [];

  if (sections.header) {
    segments.push(createSegment(meta, 'header', sections.header.join('\n'), {}));
  }
  if (sections.abstract) {
    segments.push(createSegment(meta, 'abstract', sections.abstract.join('\n'), {}));
  }
  if (sections.body) {
    const bodyChunks = chunkParagraphs(
      sections.body.join('\n'),
      250,
      600,
      50,
      meta,
      'body'
    ).map(seg => ({
      ...seg,
      metadata: {
        ...seg.metadata,
        outline_path: findHeadings(seg.text),
        footnote_refs: findCitations(seg.text)
      }
    }));
    segments.push(...bodyChunks);
  }
  if (sections.conclusion) {
    segments.push(
      createSegment(meta, 'conclusion', sections.conclusion.join('\n'), {
        outline_path: findHeadings(sections.conclusion.join('\n')),
        footnote_refs: findCitations(sections.conclusion.join('\n'))
      })
    );
  }
  if (sections.notes) {
    segments.push(
      createSegment(meta, 'notes', sections.notes.join('\n'), {
        footnote_refs: findCitations(sections.notes.join('\n'))
      })
    );
  }
  if (sections.bibliography) {
    segments.push(
      createSegment(meta, 'bibliography', sections.bibliography.join('\n'), {
        bibliography_ids: findCitations(sections.bibliography.join('\n'))
      })
    );
  }
  return segments;
}

export function cutPublicReport(docText, meta) {
  const roles = [
    'header',
    'executive_summary',
    'body',
    'observation',
    'response',
    'recommendation',
    'annex_caption'
  ];
  const sections = splitSections(docText, roles);
  const segments = [];

  const extractEntities = text => {
    const matches = text.match(/\b[A-Z][a-z]+\b/g) || [];
    return Array.from(new Set(matches));
  };
  const extractIrregularities = text => {
    const matches = text.match(/irregularit|fraud|non[- ]?conform/gi) || [];
    return matches.map(m => m.toLowerCase());
  };
  const extractAmounts = text => {
    const matches = text.match(/[€$£]?\d+[\d\.,]*(?:\s?(?:EUR|USD|GBP))?/g) || [];
    return matches;
  };

  roles.forEach(role => {
    if (!sections[role]) return;
    const text = sections[role].join('\n');
    if (role === 'recommendation') {
      const recs = text.split(/\n(?=\s*\d+\.|-)/).filter(r => r.trim());
      recs.forEach(r => {
        segments.push(
          createSegment(meta, role, r, {
            entities: extractEntities(r),
            irregularities: extractIrregularities(r),
            amounts: extractAmounts(r)
          })
        );
      });
    } else {
      segments.push(
        createSegment(meta, role, text, {
          entities: extractEntities(text),
          irregularities: extractIrregularities(text),
          amounts: extractAmounts(text)
        })
      );
    }
  });
  return segments;
}

export function chunkText(text, maxWords = 500, overlap = 100) {
  const words = text.split(/\s+/);
  const chunks = [];

  for (let i = 0; i < words.length; i += maxWords - overlap) {
    const chunk = words.slice(i, i + maxWords).join(' ');
    chunks.push(chunk);
    if (i + maxWords >= words.length) break;
  }

  return chunks;
}

export default {
  cutStatute,
  cutRegulation,
  cutJudgment,
  cutDoctrine,
  cutPublicReport,
  chunkText
};
