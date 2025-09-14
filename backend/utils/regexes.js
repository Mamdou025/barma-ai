export const headingRegex = /^\s*(?:#+\s+.*|[A-Z][A-Z\s]+)\s*$/gm;
export const citationRegex = /\[[^\]]+\]|\((?:[^()]*\d{4}[^()]*)\)/g;
export const articleMarkerRegex = /(Article|Art\.?)[\s\n]*(\d+[A-Za-z0-9-]*)/gi;
export const alineaMarkerRegex = /\n\s*(?:\(\d+\)|\d+\.|-)/g;

export function findHeadings(text) {
  return [...text.matchAll(headingRegex)].map(m => m[0]);
}

export function findCitations(text) {
  return [...text.matchAll(citationRegex)].map(m => m[0]);
}
