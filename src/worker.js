import dotenv from 'dotenv';
dotenv.config();

const { Worker } = await import('bullmq');
const { connection } = await import('./queue.js');
const { getPool, initDb } = await import('./db.js');
const { embedText } = await import('./embeddings.js');
const { chunkText } = await import('./chunker.js');

await initDb();

const worker = new Worker('embedding', async (job) => {
  const { source, content } = job.data;
  const chunks = chunkText(content);

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await embedText(chunk);

    const existing = await getPool().query(
      `SELECT id FROM documents
       WHERE source = $1
       AND 1 - (embedding <=> $2) > 0.98
       LIMIT 1`,
      [source, JSON.stringify(embedding)]
    );

    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }

    await getPool().query(
      `INSERT INTO documents (content, source, embedding) VALUES ($1, $2, $3)`,
      [chunk, source, JSON.stringify(embedding)]
    );
    inserted++;

    await job.updateProgress({ processed: i + 1, total: chunks.length, inserted, skipped });
  }

  return { source, inserted, skipped };

}, {
  connection,
  concurrency: 3,
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 }
});

worker.on('completed', (job, result) => {
  console.log(`✓ Job ${job.id} completed:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`✗ Job ${job.id} failed:`, err.message);
});

console.log('Worker running — concurrency: 3');