import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { initDb, getPool, searchSimilarChunks } from './db.js';
import { embedText } from './embeddings.js';
import { chunkText } from './chunker.js';
import { askWithContext } from './rag.js';
import { embeddingQueue } from './queue.js';

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

app.post('/ingest', async (req, res) => {
  const { documents } = req.body;
  if (!Array.isArray(documents) || documents.length === 0) {
    return res.status(400).json({ error: 'documents array is required' });
  }

  const jobs = [];
  for (const doc of documents) {
    if (!doc.content || !doc.source) {
      jobs.push({ source: doc.source ?? 'unknown', status: 'skipped', reason: 'missing content or source' });
      continue;
    }
    const job = await embeddingQueue.add('index-document', {
      source: doc.source,
      content: doc.content,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });
    jobs.push({ id: job.id, source: doc.source, status: 'queued' });
  }

  res.json({ jobs });
});

app.get('/ingest/:jobId', async (req, res) => {
  const job = await embeddingQueue.getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  const state = await job.getState();
  res.json({
    id: job.id,
    source: job.data.source,
    state,
    progress: job.progress,
    result: job.returnvalue ?? null,
    failedReason: job.failedReason ?? null,
  });
});

app.get('/debug-search', async (req, res) => {
  const results = await searchSimilarChunks('What is semantic search?', 10, 0.0);
  res.json(results);
});

const PORT = process.env.PORT || 3001;
initDb().then(() => {
  app.listen(PORT, () => console.log(`Server on :${PORT}`));
});