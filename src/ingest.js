import { initDb, pool } from './db.js';
import { embedText } from './embeddings.js';
import { chunkText } from './chunker.js';
import { documents } from '../data/documents.js';

async function ingest() {
  console.log("ingest is running");
  await initDb();

  for (const doc of documents) {
    const chunks = chunkText(doc.content);
    console.log(`Ingesting "${doc.source}" → ${chunks.length} chunk(s)`);

    for (const chunk of chunks) {
      const embedding = await embedText(chunk);

      // Duplicate detection — skip if near-identical chunk already exists
      const existing = await pool.query(
        `SELECT id FROM documents
        WHERE source = $1
        AND 1 - (embedding <=> $2) > 0.98
        LIMIT 1`,
        [doc.source, JSON.stringify(embedding)]
      );

      if (existing.rows.length > 0) {
        console.log(`  ↩ Skipping duplicate chunk from "${doc.source}"`);
        continue;
      }

      await pool.query(
        `INSERT INTO documents (content, source, embedding) VALUES ($1, $2, $3)`,
        [chunk, doc.source, JSON.stringify(embedding)]
      );
    }
  }

  console.log('Ingestion complete');
  await pool.end();
}

ingest().catch(console.error);