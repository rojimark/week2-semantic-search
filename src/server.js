import express from 'express';
import { initDb, pool } from './db.js';
import { embedText } from './embeddings.js';
import dotenv from 'dotenv';
import { askWithContext } from './rag.js';

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

const PORT = process.env.PORT || 3001;

initDb().then(() => {
  app.listen(PORT, () => console.log(`Server on :${PORT}`));
});