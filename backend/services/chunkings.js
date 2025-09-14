// services/chunkings.js

const {
  findHeadings,
  findCitations,
  articleMarkerRegex,
  alineaMarkerRegex
} = require('../utils/regexes.js');
const { resolveEntities } = require('./nlp/entityRegistry');

function countTokens(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).length;
}

function createSegment(meta, role, text, extra = {}) {
  return {
    document_id: meta.document_id,
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

function cutStatute(docText, meta) {
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

function cutRegulation(docText, meta) {
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

function cutJudgment(docText, meta) {
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

function cutDoctrine(docText, meta) {
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

function cutPublicReport(docText, meta, tables = []) {
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

  const extractEntities = text =>
    resolveEntities(text.match(/\b[A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+){0,4}\b/g) || []);
  const extractIrregularities = text =>
    [...new Set((text.match(/irregularit|fraud|non[- ]?conform/gi) || []).map(m => m.toLowerCase()))];
  const extractAmounts = text =>
    [...new Set(text.match(/[€$£]?\d[\d.,]*(?:\s?(?:FCFA|CFA|EUR|USD|GBP))?/g) || [])];
  const extractDates = text => {
    const d1 = text.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g) || [];
    const d2 =
      text.match(
        /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi
      ) || [];
    return [...new Set([...d1, ...d2])];
  };
  const extractProcurementRefs = text =>
    [...new Set(text.match(/\b(?:procurement|contract|tender|rfp)\s*(?:n°|no\.|#)?\s*[\w\/\-]+/gi) || [])];
  const extractFollowUp = text =>
    [...new Set((text.match(/implemented|not implemented|ongoing|pending|in progress|completed/gi) || []).map(m => m.toLowerCase()))];
  const extractStatutes = text => findCitations(text).filter(x => /art\.|article/i.test(x));

  const enrich = (t, extra = {}) => ({
    ...extra,
    entities_mentioned: extractEntities(t),
    irregularities: extractIrregularities(t),
    amounts: extractAmounts(t),
    dates: extractDates(t),
    procurement_refs: extractProcurementRefs(t),
    statutes_cited: extractStatutes(t),
    follow_up_state: extractFollowUp(t)
  });

  if (sections.header) {
    const text = sections.header.join('\n');
    segments.push(createSegment(meta, 'header', text, enrich(text)));
  }
  if (sections.executive_summary) {
    const text = sections.executive_summary.join('\n');
    segments.push(createSegment(meta, 'executive_summary', text, enrich(text)));
  }

  if (sections.body) {
    const bodyText = sections.body.join('\n');
    const obsRegex = /Observation\s*n[°o]\s*(\d+)/gi;
    const matches = [...bodyText.matchAll(obsRegex)];

    if (!matches.length) {
      chunkParagraphs(bodyText, 300, 700, 60, meta, 'body').forEach(seg =>
        segments.push({ ...seg, metadata: { ...seg.metadata, ...enrich(seg.text) } })
      );
    } else {
      if (matches[0].index > 0) {
        const pre = bodyText.slice(0, matches[0].index);
        chunkParagraphs(pre, 300, 700, 60, meta, 'body').forEach(seg =>
          segments.push({ ...seg, metadata: { ...seg.metadata, ...enrich(seg.text) } })
        );
      }

      matches.forEach((m, idx) => {
        const start = m.index;
        const end = matches[idx + 1]?.index ?? bodyText.length;
        const block = bodyText.slice(start, end);
        const obsId = m[1];
        const afterHeading = block.slice(m[0].length).trim();

        const responseIdx = afterHeading.search(/\bResponse\b/i);
        const recommendationIdx = afterHeading.search(/\bRecommendation\b/i);
        let obsEnd = afterHeading.length;
        if (responseIdx !== -1 && responseIdx < obsEnd) obsEnd = responseIdx;
        if (recommendationIdx !== -1 && recommendationIdx < obsEnd) obsEnd = recommendationIdx;
        const obsText = afterHeading.slice(0, obsEnd).trim();

        if (obsText) {
          chunkParagraphs(obsText, 300, 700, 60, meta, 'observation').forEach(seg =>
            segments.push({
              ...seg,
              metadata: { ...seg.metadata, ...enrich(seg.text, { observation_id: obsId }) }
            })
          );
        }

        let responseText = '';
        let recBlock = '';
        if (responseIdx !== -1) {
          const rStart =
            responseIdx + afterHeading.slice(responseIdx).match(/Response/i)[0].length;
          const rEnd =
            recommendationIdx !== -1 && recommendationIdx > responseIdx
              ? recommendationIdx
              : afterHeading.length;
          responseText = afterHeading.slice(rStart, rEnd).trim();
        }
        if (recommendationIdx !== -1) {
          const recStart =
            recommendationIdx +
            afterHeading.slice(recommendationIdx).match(/Recommendation/i)[0].length;
          const recEnd =
            responseIdx !== -1 && responseIdx > recommendationIdx
              ? responseIdx
              : afterHeading.length;
          recBlock = afterHeading.slice(recStart, recEnd).trim();
        }

        if (responseText) {
          chunkParagraphs(responseText, 300, 700, 60, meta, 'response').forEach(seg =>
            segments.push({
              ...seg,
              metadata: {
                ...seg.metadata,
                ...enrich(seg.text, { observation_id: obsId, response_to: obsId })
              }
            })
          );
        }
        if (recBlock) {
          const recs = recBlock.split(/\n+(?=\s*(?:\d+\.|-))/).filter(r => r.trim());
          if (!recs.length) recs.push(recBlock);
          recs.forEach((rText, rIdx) => {
            const cleaned = rText.replace(/^\s*(?:\d+\.|-)/, '').trim();
            segments.push(
              createSegment(
                meta,
                'recommendation',
                cleaned,
                enrich(cleaned, {
                  observation_id: obsId,
                  recommendation_id: `${obsId}-${rIdx + 1}`,
                  response_to: obsId
                })
              )
            );
          });
        }
      });
    }
  }

  ['observation', 'response'].forEach(role => {
    if (!sections[role]) return;
    chunkParagraphs(sections[role].join('\n'), 300, 700, 60, meta, role).forEach(seg =>
      segments.push({ ...seg, metadata: { ...seg.metadata, ...enrich(seg.text) } })
    );
  });

  if (sections.recommendation) {
    const text = sections.recommendation.join('\n');
    const recs = text.split(/\n(?=\s*\d+\.|-)/).filter(r => r.trim());
    recs.forEach((r, i) => {
      const cleaned = r.replace(/^\s*(?:\d+\.|-)/, '').trim();
      segments.push(
        createSegment(
          meta,
          'recommendation',
          cleaned,
          enrich(cleaned, { recommendation_id: `GEN-${i + 1}` })
        )
      );
    });
  }

  if (sections.annex_caption) {
    sections.annex_caption.forEach(caption => {
      const table = tables.find(
        t => t.caption.trim().toLowerCase() === caption.trim().toLowerCase()
      );
      const extra = table ? { table_id: table.id, table_csv_url: table.csv_url } : {};
      segments.push(createSegment(meta, 'annex_caption', caption, extra));
    });
  }

  return segments;
}

function chunkText(text, maxWords = 500, overlap = 100) {
  const words = text.split(/\s+/);
  const chunks = [];

  for (let i = 0; i < words.length; i += maxWords - overlap) {
    const chunk = words.slice(i, i + maxWords).join(' ');
    chunks.push(chunk);
    if (i + maxWords >= words.length) break;
  }

  return chunks;
}

module.exports = {
  cutStatute,
  cutRegulation,
  cutJudgment,
  cutDoctrine,
  cutPublicReport,
  chunkText
};
