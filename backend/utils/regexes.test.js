const test = require('node:test');
const assert = require('node:assert');

const {
  findHeadings,
  findCitations,
  articleMarkerRegex,
  alineaMarkerRegex
} = require('./regexes');

test('findHeadings extracts headings', () => {
  const text = '1. Introduction\nSome text\nI. Background\nA) Subsection';
  assert.deepStrictEqual(findHeadings(text), [
    '1. Introduction',
    'I. Background',
    'A) Subsection'
  ]);
});

test('findCitations finds statute and case references', () => {
  const text = 'See Article 12 and 2020 SCC 10 in Roe v. Wade.';
  const citations = findCitations(text);
  assert.ok(citations.includes('Article 12'));
  assert.ok(citations.includes('2020 SCC 10'));
  assert.ok(citations.some(c => /Roe v\. Wade/.test(c)));
});

test('articleMarkerRegex captures article numbers', () => {
  const text = 'Article 42\nArticle 5-1';
  const numbers = [...text.matchAll(articleMarkerRegex)].map(m => m[2]);
  assert.deepStrictEqual(numbers, ['42', '5-1']);
});

test('alineaMarkerRegex splits on paragraph markers', () => {
  const article = 'Intro\n1. First part\n2. Second part';
  const parts = article.split(alineaMarkerRegex).map(s => s.trim()).filter(Boolean);
  assert.deepStrictEqual(parts, ['Intro', '1. First part', '2. Second part']);
});
