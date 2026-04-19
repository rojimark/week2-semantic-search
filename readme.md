# RAG Pipeline
### Retrieval-Augmented Generation — Portfolio Project 1

![Node.js](https://img.shields.io/badge/Node.js-16A34A?style=flat&logo=node.js&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI_Embeddings-7C3AED?style=flat&logo=openai&logoColor=white)
![pgvector](https://img.shields.io/badge/pgvector_+_HNSW-0369A1?style=flat&logo=postgresql&logoColor=white)
![Groq](https://img.shields.io/badge/Groq_LLaMA_3.3-B45309?style=flat)

A production-patterned RAG pipeline built in Node.js. Answers natural language questions by retrieving semantically relevant document chunks from a vector database and generating grounded, cited answers — without hallucinating beyond what the knowledge base contains.

Portfolio Project 1 of an AI Engineering learning path, built on top of a semantic search engine with a full answer generation layer.

---

## How It Works

Every request to `/ask` goes through a seven-step pipeline:

```
User Question
    │
    ▼
Embed (OpenAI text-embedding-3-small)   ← converts meaning to coordinates
    │
    ▼
HNSW Search (pgvector)                  ← finds nearest chunks by cosine similarity
    │
    ▼
Threshold Filter                        ← cuts weak matches
    │
    ▼
Re-rank + Trim (fetch 10, use 5)        ← keeps strongest candidates
    │
    ▼
Grounded Prompt (Groq LLaMA 3.3-70b)   ← answer only from context
    │
    ▼
Cited Answer + Sources + Confidence
```

### Key Design Decisions

| Decision | Why |
|---|---|
| Fetch 10, use 5 | Retrieves extra candidates then trims — gives room to discard borderline matches without missing good ones |
| Temperature 0.1 | RAG is a retrieval problem, not a creative one. Low temperature keeps answers faithful to retrieved context |
| Context ordering | Chunks injected in descending similarity order — LLMs attend more to content at the top of the context window |
| Early return on miss | If nothing clears the similarity threshold, the system declines to answer rather than letting the LLM free-generate |
| Query rephrasing | LLM rewrites the user's question into retrieval-friendly language before embedding — closes the gap between casual phrasing and technical documentation |
| Confidence signal | Top chunk similarity score maps to `high / medium / low`, giving API consumers a trust indicator on every response |

---

## Tech Stack

| | |
|---|---|
| **Groq** (LLaMA 3.3-70b-versatile) | Answer generation |
| **OpenAI** (text-embedding-3-small) | Embeddings — 1536-dimension vectors |
| **pgvector + HNSW index** | Vector storage and approximate nearest-neighbor search |
| **PostgreSQL** | Document and chunk storage |
| **Node.js + Express** | API server |

---

## API Reference

### `POST /ask`

Accepts a natural language question, returns a grounded cited answer.

**Request**
```json
{
  "question": "What is a database index?"
}
```

**Response**
```json
{
  "answer": "A database index is a data structure that improves retrieval speed [1].",
  "sources": [
    {
      "content": "A database index is a data structure...",
      "source": "postgres-indexes.txt",
      "similarity": 0.6858
    }
  ],
  "confidence": "high",
  "retrievalCount": 3
}
```

**Confidence levels**

| Level | Meaning |
|---|---|
| `high` | Top chunk similarity >= 0.60 — answer is reliable |
| `medium` | Top chunk similarity >= 0.35 — usable, verify if critical |
| `low` | Chunks retrieved but weak signal — treat with skepticism |
| `sources: []` | Nothing cleared the threshold — system declines to answer |

### `POST /search`

Direct semantic search — returns ranked chunks without answer generation. Useful for debugging retrieval quality.

```json
{
  "query": "vector similarity search",
  "limit": 3,
  "threshold": 0.20
}
```

---

## Project Structure

```
├── src/
│   ├── rag.js          ← answer layer: rephrasing, retrieval, grounding, generation
│   ├── db.js           ← data layer: pool, HNSW index, searchSimilarChunks()
│   ├── embeddings.js   ← embedText() via OpenAI
│   ├── chunker.js      ← overlap-based text chunking
│   ├── ingest.js       ← document ingestion with duplicate detection
│   └── server.js       ← Express routes: /ask, /search
├── data/
│   └── documents.js    ← source documents
└── .env
```

---

## Setup

**Prerequisites**
- Node.js 18+
- PostgreSQL with pgvector extension
- OpenAI API key (embeddings only)
- Groq API key (answer generation)

**Environment variables**
```
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
```

**Install and run**
```bash
npm install

# Ingest documents into the vector database
node src/ingest.js

# Start the server
node src/server.js
```

**Test the pipeline**
```bash
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is a database index?"}'
```

---

## What I Learned

**RAG Architecture**
- How to structure a pipeline where every step has a single responsibility — embedding, retrieval, re-ranking, grounding, and generation are all separate concerns
- Why retrieval and generation are kept strictly separate — mixing them makes both harder to debug
- The "lost in the middle" problem: LLMs attend more to the start and end of context, so chunk ordering matters

**Retrieval Quality**
- Similarity scores are domain-relative — a 0.25 in a narrow technical corpus can be equivalent to a 0.80 in a general one
- Query rephrasing (HyDE-lite) closes the semantic gap between conversational user language and formal document language — boosted top chunk scores from ~0.25 to ~0.46 on the same underlying questions
- Fetching more candidates than you inject gives you a re-ranking buffer without adding infrastructure

**Failure Modes**
- **Corpus poisoning:** a single authoritative-sounding wrong document can dominate retrieval and produce confident, cited, completely wrong answers — the legitimate contradicting document may never make it into context
- **Silent retrieval misses:** without an early-return guard, the LLM hallucinates freely when given an empty context block
- **Threshold miscalibration:** a threshold too high rejects all results; one too low lets noise into the context window

---

## Exercises

| Exercise | Finding |
|---|---|
| **Corpus Poisoning** | Injected a deliberately wrong document. A single high-similarity poisoned chunk dominated retrieval and produced confident wrong cited answers — the legitimate contradicting document never made it into context |
| **Query Rephrasing** | Added a pre-retrieval LLM call to rewrite user questions. Similarity scores improved from ~0.25 to ~0.46 on the same underlying question by closing the gap between casual and technical language |
| **Confidence Scoring** | Calibrated thresholds against real corpus data — generic thresholds written for a different embedding space were marking every response as `low` regardless of actual retrieval quality |

---

## What's Next

This pipeline is designed for composability. In the next phase (Weeks 5–6), it becomes one tool in an AI Agent with tool calling and memory — the agent calls `/ask` the same way a user does, treating the knowledge base as one of several available capabilities.

Planned improvements:
- Source trust scoring — weight documents by origin and recency at ingest time
- Cross-encoder re-ranking — replace similarity-based trimming with a dedicated re-ranker model
- Conflict detection — flag when retrieved chunks contradict each other before generation
- Dynamic thresholding — set the similarity floor relative to the top score rather than a hardcoded constant