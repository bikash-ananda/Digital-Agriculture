const crypto = require('node:crypto');
const db = require('../config/db');

const vectorCache = new Map();
const cleanupTimes = new Map();
const MAX_VECTOR_CACHE = 300;
const MAX_DOCUMENTS = 100;
const MAX_DOCUMENT_CHARS = 1600;
let embeddingRetryAfter = 0;

function configuredOllama() {
  const model = process.env.FARMING_EMBEDDING_MODEL?.trim();
  const baseUrl = (process.env.FARMING_OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  return model ? { model, baseUrl } : null;
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function tokenize(value) {
  return new Set((String(value || '').toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || []));
}

function lexicalScore(queryTokens, phrase, document) {
  const docTokens = tokenize(`${document.title} ${document.crop || ''} ${document.topic || ''} ${document.text}`);
  if (!docTokens.size) return 0;
  let overlap = 0;
  for (const token of queryTokens) if (docTokens.has(token)) overlap += 1;
  const normalizedPhrase = phrase.toLocaleLowerCase().trim();
  const text = `${document.title} ${document.crop || ''} ${document.text}`.toLocaleLowerCase();
  const phraseBonus = normalizedPhrase.length > 2 && text.includes(normalizedPhrase) ? 2 : 0;
  return (overlap / Math.max(1, Math.sqrt(queryTokens.size * docTokens.size))) + phraseBonus;
}

async function loadPublishedDocuments() {
  const [[articles], [resources]] = await Promise.all([
    db.query(
      `SELECT a.id, a.topic, a.title_ne, a.title_en, a.body, a.updated_at,
              c.name_ne AS crop_ne, c.name_en AS crop_en
         FROM knowledge_articles a LEFT JOIN crops c ON c.id = a.crop_id
        WHERE a.status = 'published' AND COALESCE(a.body, '') <> ''
        ORDER BY a.updated_at DESC, a.id DESC LIMIT ?`, [MAX_DOCUMENTS]),
    db.query(
      `SELECT id, resource_type, title_ne, title_en, description, url, created_at
         FROM learning_resources
        WHERE status = 'published' AND COALESCE(description, '') <> ''
        ORDER BY created_at DESC, id DESC LIMIT ?`, [MAX_DOCUMENTS])
  ]);

  return [
    ...articles.map((row) => {
      const title = row.title_en || row.title_ne;
      const searchableTitle = [row.title_en, row.title_ne].filter(Boolean).join(' / ');
      const crop = row.crop_en || row.crop_ne || '';
      const text = String(row.body || '').slice(0, MAX_DOCUMENT_CHARS);
      return {
        key: `article:${row.id}:${hash(`${searchableTitle}\n${row.topic}\n${crop}\n${text}`)}`,
        id: row.id,
        kind: 'article',
        title,
        searchableTitle,
        topic: row.topic,
        crop,
        text,
        updatedAt: row.updated_at
      };
    }),
    ...resources.map((row) => {
      const title = row.title_en || row.title_ne;
      const searchableTitle = [row.title_en, row.title_ne].filter(Boolean).join(' / ');
      const text = String(row.description || '').slice(0, MAX_DOCUMENT_CHARS);
      return {
        key: `learning_resource:${row.id}:${hash(`${searchableTitle}\n${row.resource_type}\n${text}`)}`,
        id: row.id,
        kind: 'learning_resource',
        title,
        searchableTitle,
        topic: row.resource_type,
        crop: '',
        text,
        url: row.url,
        updatedAt: row.created_at
      };
    })
  ].sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0)).slice(0, MAX_DOCUMENTS);
}

function cosineSimilarity(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || !left.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  return leftNorm && rightNorm ? dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm)) : 0;
}

async function embed(texts, config) {
  if (Date.now() < embeddingRetryAfter) return null;
  try {
    const response = await fetch(`${config.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, input: texts }),
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) {
      embeddingRetryAfter = Date.now() + 15000;
      return null;
    }
    const payload = await response.json();
    const embeddings = Array.isArray(payload.embeddings) && payload.embeddings.length === texts.length ? payload.embeddings : null;
    embeddingRetryAfter = embeddings ? 0 : Date.now() + 15000;
    return embeddings;
  } catch {
    embeddingRetryAfter = Date.now() + 15000;
    return null;
  }
}

async function semanticScores(query, documents, config) {
  const queryVector = (await embed([query], config))?.[0];
  if (!queryVector) return null;

  let missing = documents.filter((document) => !vectorCache.has(`${config.model}:${document.key}`));
  if (missing.length) {
    await loadStoredVectors(missing, config.model);
    missing = missing.filter((document) => !vectorCache.has(`${config.model}:${document.key}`));
  }
  if (missing.length) {
    const prefix = config.model.startsWith('nomic-embed-text-v2') ? 'search_document: ' : '';
    const vectors = await embed(missing.map((document) => `${prefix}${document.searchableTitle}\n${document.crop || ''}\n${document.topic || ''}\n${document.text}`), config);
    if (!vectors) return null;
    missing.forEach((document, index) => {
      const key = `${config.model}:${document.key}`;
      vectorCache.set(key, vectors[index]);
      while (vectorCache.size > MAX_VECTOR_CACHE) vectorCache.delete(vectorCache.keys().next().value);
    });
    await storeVectors(missing, vectors, config.model);
  }

  return documents.map((document) => cosineSimilarity(queryVector, vectorCache.get(`${config.model}:${document.key}`)));
}

async function loadStoredVectors(documents, model) {
  if (!documents.length) return;
  const conditions = documents.map(() => '(source_type = ? AND source_id = ?)').join(' OR ');
  const params = [model, ...documents.flatMap((document) => [document.kind, document.id])];
  try {
    const [rows] = await db.query(
      `SELECT source_type, source_id, content_hash, embedding
         FROM ai_knowledge_embeddings WHERE model = ? AND (${conditions})`, params);
    for (const row of rows) {
      const document = documents.find((item) => item.kind === row.source_type && Number(item.id) === Number(row.source_id));
      if (!document || document.key.slice(document.key.lastIndexOf(':') + 1) !== row.content_hash) continue;
      const vector = typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding;
      if (!Array.isArray(vector)) continue;
      const key = `${model}:${document.key}`;
      vectorCache.set(key, vector);
      while (vectorCache.size > MAX_VECTOR_CACHE) vectorCache.delete(vectorCache.keys().next().value);
    }
  } catch {
    // The published content remains searchable by keyword if this optional migration is not installed.
  }
}

async function storeVectors(documents, vectors, model) {
  if (!documents.length) return;
  const values = [];
  const tuples = documents.map((document, index) => {
    values.push(document.kind, document.id, model, document.key.slice(document.key.lastIndexOf(':') + 1), JSON.stringify(vectors[index]));
    return '(?, ?, ?, ?, CAST(? AS JSON))';
  });
  try {
    await db.query(
      `INSERT INTO ai_knowledge_embeddings (source_type, source_id, model, content_hash, embedding)
       VALUES ${tuples.join(', ')}
       ON DUPLICATE KEY UPDATE content_hash = VALUES(content_hash), embedding = VALUES(embedding), updated_at = CURRENT_TIMESTAMP`, values);
  } catch {
    // Keep the in-process vector cache if persistent vector storage is unavailable.
  }
}

async function cleanStaleVectors(model) {
  const lastCleanup = cleanupTimes.get(model) || 0;
  if (Date.now() - lastCleanup < 5 * 60 * 1000) return;
  cleanupTimes.set(model, Date.now());
  try {
    await db.query(
      `DELETE FROM ai_knowledge_embeddings WHERE model = ? AND (
         (source_type = 'article' AND source_id NOT IN (
           SELECT id FROM knowledge_articles WHERE status = 'published' AND COALESCE(body, '') <> ''
         )) OR
         (source_type = 'learning_resource' AND source_id NOT IN (
           SELECT id FROM learning_resources WHERE status = 'published' AND COALESCE(description, '') <> ''
         ))
       )`, [model]);
  } catch {
    // The knowledge search must remain available even before this optional table is migrated.
  }
}

async function search(query, limit = 5) {
  const phrase = String(query || '').trim().slice(0, 1000);
  if (phrase.length < 2) return { mode: configuredOllama() ? 'semantic' : 'keyword', results: [] };
  const documents = await loadPublishedDocuments();
  if (!documents.length) return { mode: configuredOllama() ? 'semantic' : 'keyword', results: [] };

  const config = configuredOllama();
  if (config) await cleanStaleVectors(config.model);
  const semantic = config ? await semanticScores(phrase, documents, config) : null;
  const queryTokens = tokenize(phrase);
  const ranked = documents.map((document, index) => ({
    document,
    score: semantic ? semantic[index] : lexicalScore(queryTokens, phrase, document),
    mode: semantic ? 'semantic' : 'keyword'
  })).filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, Math.min(Number(limit) || 5, 8)));

  return {
    mode: semantic ? 'semantic' : 'keyword',
    results: ranked.map(({ document, score }) => ({
      id: document.id,
      kind: document.kind,
      title: document.title,
      topic: document.topic,
      crop: document.crop || null,
      excerpt: document.text,
      url: document.url || null,
      score: Number(score.toFixed(4))
    }))
  };
}

module.exports = { search };
