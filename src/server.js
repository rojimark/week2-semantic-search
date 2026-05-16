import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { initDb, getPool, searchSimilarChunks } from './db.js';
import { embedText } from './embeddings.js';
import { chunkText } from './chunker.js';
import { askWithContext, streamAnswer } from './rag.js';
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

app.post('/ask/stream', async (req, res) => {
  const { question } = req.body;
  if (!question?.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }
 
  // ── Headers must be set before the first res.write() call. ───
  // Once you flush a single byte the HTTP status line and headers
  // are committed — you cannot change them after that point.
  //
  // Cache-Control: no-cache  → prevents proxies/CDNs from buffering
  // X-Accel-Buffering: no    → disables nginx proxy_buffer specifically
  // Connection: keep-alive   → tells the client the connection stays open
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
 
  // Helper: write a single SSE event. Every SSE event on the wire is:
  //   data: <json>\n\n
  // The double newline is what signals the end of one event to the client.
  const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
 
  try {
    const { stream, metadata } = await streamAnswer(question);
 
    // ── Retrieval miss — no chunks cleared the threshold ──────
    // Still use the SSE protocol so the client doesn't need special-casing.
    if (!stream) {
      send({ type: 'token', content: metadata.answer });
      send({ type: 'metadata', sources: [], confidence: 'none', retrievalCount: 0 });
      send({ type: 'done' });
      return res.end();
    }
 
    // ── Stream tokens as they arrive from Groq ────────────────
    // The Groq SDK with stream: true returns an async iterable.
    // Each chunk has the same shape as a non-streaming completion choice,
    // but delta.content holds just the new tokens for that chunk (not the
    // accumulated text). Chunks with no content (role-only chunks) are
    // skipped — delta.content will be null or an empty string.
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        send({ type: 'token', content });
      }
    }
 
    // ── Metadata sent after the token stream closes ───────────
    // Sources and confidence arrive as a single structured event after
    // all tokens are done. This lets the client render the answer first
    // and attach citations afterward without parsing mid-stream JSON.
    send({ type: 'metadata', ...metadata });
 
    // ── Explicit terminal signal ──────────────────────────────
    // Don't rely on connection close. Proxies, load balancers, and n8n
    // all handle connection close differently. An explicit done event
    // makes client consumption deterministic — the client knows exactly
    // when to stop listening.
    send({ type: 'done' });
    res.end();
 
  } catch (err) {
    console.error('Streaming RAG error:', err);
 
    // If generation fails after streaming has already started, we cannot
    // change the HTTP status — headers are already committed. The only
    // way to signal failure to the client is an error event.
    // The client must listen for { type: 'error' } and handle it.
    send({ type: 'error', message: err.message });
    res.end();
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
      priority: doc.priority ?? 10,
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