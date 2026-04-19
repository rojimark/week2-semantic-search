/**
 * Split text into overlapping chunks.
 * @param {string} text
 * @param {number} chunkSize     - target chars per chunk
 * @param {number} overlapSize   - chars to repeat from previous chunk
 */
export function chunkText(text, chunkSize = 500, overlapSize = 100) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end).trim());

    // Move forward by (chunkSize - overlap) so next chunk repeats the tail
    start += chunkSize - overlapSize;
  }

  return chunks.filter(c => c.length > 50); // drop tiny tail fragments
}