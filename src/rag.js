// src/rag.js
import Groq from 'groq-sdk';
import { searchSimilarChunks } from './db.js';

// const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

let _groq = null;
function getGroq() {
  if (!_groq) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

const MODEL = 'llama-3.3-70b-versatile';

// Fetch more than you'll use, then trim. More on why below.
const RETRIEVAL_TOP_K = 10;
const CONTEXT_TOP_K = 5;

const SIMILARITY_THRESHOLD = 0.20; // Same as Week 2 — tune per your data

export async function askWithContext(question) {
  // ── 1. Retrieve ──────────────────────────────────────────────
    const rephrasedQuestion = await rephraseQuery(question);
  console.log(`Original: "${question}"`);
  console.log(`Rephrased: "${rephrasedQuestion}"`);

  const candidates = await searchSimilarChunks(question, RETRIEVAL_TOP_K);
console.log('candidates:', candidates.length, candidates.map(c => c.similarity));

  // ── 2. Filter below threshold ─────────────────────────────────
  const relevant = candidates.filter(c => c.similarity >= SIMILARITY_THRESHOLD);

  // ── 3. Retrieval miss — bail early, don't hallucinate ─────────
  if (relevant.length === 0) {
    return {
      answer: "I don't have enough information in my knowledge base to answer that question confidently.",
      sources: [],
      confidence: 'none',
      retrievalCount: 0,
    };
  }

  // ── 4. Re-rank: take top-K by similarity score ────────────────
  const topChunks = relevant
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, CONTEXT_TOP_K);

  // ── 5. Build context block ────────────────────────────────────
  const contextBlock = topChunks
    .map((chunk, i) => `[${i + 1}] (source: ${chunk.source}, score: ${chunk.similarity.toFixed(3)})\n${chunk.content}`)
    .join('\n\n');

  // ── 6. Grounded prompt ────────────────────────────────────────
  const systemPrompt = `You are a precise question-answering assistant.

RULES:
- Answer ONLY using the provided context passages below.
- Do NOT use your training knowledge to fill in gaps.
- If the context doesn't contain enough information to answer, say so explicitly.
- Cite sources using the bracketed numbers [1], [2], etc. from the context.
- Be concise. Do not pad your answer.`;

  const userMessage = `Context passages:
${contextBlock}

Question: ${question}

Answer using only the context above. Cite your sources.`;

  // ── 7. Generate ───────────────────────────────────────────────
  const completion = await getGroq().chat.completions.create({
    model: MODEL,
    temperature: 0.1, // Low — you want retrieval-faithful, not creative
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  });

  const answer = completion.choices[0].message.content;

  // ── 8. Confidence signal from top chunk score ─────────────────
  const topScore = topChunks[0].similarity;
  const confidence = topScore >= 0.60 ? 'high' : topScore >= 0.35 ? 'medium' : 'low';

  return {
    answer,
    sources: topChunks.map(c => ({
      content: c.content,
      source: c.source,
      similarity: parseFloat(c.similarity.toFixed(4)),
    })),
    confidence,
    retrievalCount: relevant.length,
  };
}

export async function streamAnswer(question) {
  // ── 1. Rephrase + retrieve (identical to askWithContext) ──────
  const rephrasedQuestion = await rephraseQuery(question);
  console.log(`Original: "${question}"`);
  console.log(`Rephrased: "${rephrasedQuestion}"`);
 
  const candidates = await searchSimilarChunks(rephrasedQuestion, RETRIEVAL_TOP_K);
  console.log('candidates:', candidates.length, candidates.map(c => c.similarity));
 
  // ── 2. Filter + early return on miss ─────────────────────────
  const relevant = candidates.filter(c => c.similarity >= SIMILARITY_THRESHOLD);
 
  if (relevant.length === 0) {
    // Return null stream so the route can send the no-info response as a
    // single token event + metadata, keeping the SSE contract consistent.
    return {
      stream: null,
      metadata: {
        answer: "I don't have enough information in my knowledge base to answer that question confidently.",
        sources: [],
        confidence: 'none',
        retrievalCount: 0,
      },
    };
  }
 
  // ── 3. Re-rank + build context (identical to askWithContext) ──
  const topChunks = relevant
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, CONTEXT_TOP_K);
 
  const contextBlock = topChunks
    .map((chunk, i) => `[${i + 1}] (source: ${chunk.source}, score: ${chunk.similarity.toFixed(3)})\n${chunk.content}`)
    .join('\n\n');
 
  const systemPrompt = `You are a precise question-answering assistant.
 
RULES:
- Answer ONLY using the provided context passages below.
- Do NOT use your training knowledge to fill in gaps.
- If the context doesn't contain enough information to answer, say so explicitly.
- Cite sources using the bracketed numbers [1], [2], etc. from the context.
- Be concise. Do not pad your answer.`;
 
  const userMessage = `Context passages:
${contextBlock}
 
Question: ${question}
 
Answer using only the context above. Cite your sources.`;
 
  // ── 4. Confidence metadata (computed before streaming starts) ─
  const topScore = topChunks[0].similarity;
  const confidence = topScore >= 0.60 ? 'high' : topScore >= 0.35 ? 'medium' : 'low';
 
  const metadata = {
    sources: topChunks.map(c => ({
      content: c.content,
      source: c.source,
      similarity: parseFloat(c.similarity.toFixed(4)),
    })),
    confidence,
    retrievalCount: relevant.length,
  };
 
  // ── 5. Open a streaming completion ───────────────────────────
  // stream: true tells the SDK to return an async iterable of chunks
  // instead of waiting for the full completion.
  const stream = await getGroq().chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  });
 
  // Return the raw SDK stream + metadata to the route.
  // The route is responsible for writing SSE events — rag.js doesn't
  // touch res at all, keeping this function testable and transport-agnostic.
  return { stream, metadata };
}

async function rephraseQuery(question) {
  const completion = await getGroq().chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content: `You are a search query optimizer. 
Rewrite the user's question into a concise, keyword-rich phrase that will match technical documentation.
Return ONLY the rewritten query. No explanation, no punctuation, no preamble.`
      },
      {
        role: 'user',
        content: question
      }
    ]
  });

  return completion.choices[0].message.content.trim();
}