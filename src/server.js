import express from 'express';
import { initDb, pool } from './db.js';
import { embedText } from './embeddings.js';
import dotenv from 'dotenv';
import { askWithContext } from './rag.js';
import { chunkText } from './chunker.js';

dotenv.config();

const app = express();
app.use(express.json());

app.post('/search', async (req, res) => {
  const { query, limit = 3, threshold = 0.75 } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });

  const results = await searchSimilarChunks(query, limit, threshold);
  if (results.length === 0) {
    return res.json({ message: 'No relevant results found', results: [] });
  }
  res.json({ results });
});

app.post('/ask', async (req, res) => {
  const { question } = req.body;

  if (!question?.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }

  try {
    const result = await askWithContext(question);
    res.json(result);
  } catch (err) {
    console.error('RAG pipeline error:', err);
    res.status(500).json({ error: 'Pipeline failed', detail: err.message });
  }
});

app.get('/debug-search', async (req, res) => {
  const { searchSimilarChunks } = await import('./db.js');
  const results = await searchSimilarChunks('What is semantic search?', 10, 0.0);
  res.json(results);
});

app.post('/ingest', async (req, res) => {
  const { documents } = req.body;

  if (!Array.isArray(documents) || documents.length === 0) {
    return res.status(400).json({ error: 'documents array is required' });
  }

  const results = [];

  for (const doc of documents) {
    if (!doc.content || !doc.source) {
      results.push({ source: doc.source ?? 'unknown', status: 'skipped', reason: 'missing content or source' });
      continue;
    }

    const chunks = chunkText(doc.content);
    let inserted = 0;
    let skipped = 0;

    for (const chunk of chunks) {
      const embedding = await embedText(chunk);

      const existing = await pool.query(
        `SELECT id FROM documents
         WHERE source = $1
         AND 1 - (embedding <=> $2) > 0.98
         LIMIT 1`,
        [doc.source, JSON.stringify(embedding)]
      );

      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      await pool.query(
        `INSERT INTO documents (content, source, embedding) VALUES ($1, $2, $3)`,
        [chunk, doc.source, JSON.stringify(embedding)]
      );
      inserted++;
    }

    results.push({ source: doc.source, status: 'done', inserted, skipped });
  }

  res.json({ results });
});

const PORT = process.env.PORT || 3001;

initDb().then(() => {
  app.listen(PORT, () => console.log(`Server on :${PORT}`));
});