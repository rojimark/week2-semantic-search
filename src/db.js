import pg from 'pg';
import dotenv from 'dotenv';
import { embedText } from './embeddings.js';
dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initDb() {
  console.log("initializing db");
  await pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id        SERIAL PRIMARY KEY,
      content   TEXT NOT NULL,
      source    TEXT,
      embedding vector(1536)
    )
  `);

  // We'll add the index here in a moment — don't worry about it yet
  await pool.query(`
    CREATE INDEX IF NOT EXISTS documents_embedding_hnsw
    ON documents
    USING hnsw (embedding vector_cosine_ops)
  `);
  console.log('DB ready');
}

export async function searchSimilarChunks(query, limit = 10, threshold = 0.20) {
  const queryEmbedding = await embedText(query);
  const result = await pool.query(
    `SELECT
       id,
       source,
       content,
       1 - (embedding <=> $1) AS similarity
     FROM documents
     WHERE 1 - (embedding <=> $1) >= $2
     ORDER BY embedding <=> $1
     LIMIT $3`,
    [JSON.stringify(queryEmbedding), threshold, limit]
  );
  return result.rows;
}