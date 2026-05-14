import pg from 'pg';
import { embedText } from './embeddings.js';

let _pool = null;

export function getPool() {
  if (!_pool) {
    _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}

export async function initDb() {
  console.log("initializing db");
  await getPool().query(`CREATE EXTENSION IF NOT EXISTS vector`);
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS documents (
      id        SERIAL PRIMARY KEY,
      content   TEXT NOT NULL,
      source    TEXT,
      embedding vector(1536)
    )
  `);
  await getPool().query(`
    CREATE INDEX IF NOT EXISTS documents_embedding_hnsw
    ON documents
    USING hnsw (embedding vector_cosine_ops)
  `);
  console.log('DB ready');
}

export async function searchSimilarChunks(query, limit = 10, threshold = 0.20) {
  const queryEmbedding = await embedText(query);
  const result = await getPool().query(
    `SELECT id, source, content, 1 - (embedding <=> $1) AS similarity
     FROM documents
     WHERE 1 - (embedding <=> $1) >= $2
     ORDER BY embedding <=> $1
     LIMIT $3`,
    [JSON.stringify(queryEmbedding), threshold, limit]
  );
  return result.rows;
}