// services/chunking.js

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
