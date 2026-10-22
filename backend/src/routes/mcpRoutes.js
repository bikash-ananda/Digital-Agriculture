const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { McpServer, createMcpHandler } = require('@modelcontextprotocol/server');
const z = require('zod/v4');
const farmingAi = require('../services/publicFarmingAi');
const agricultureKnowledge = require('../services/agricultureKnowledge');

const router = express.Router();
const requestLimit = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

function textResult(value, isError = false) {
  return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }], ...(isError ? { isError: true } : {}) };
}

function createServer() {
  const server = new McpServer({ name: 'digital-agriculture', version: '1.0.0' });

  server.registerTool('search_agriculture_knowledge', {
    title: 'Search published agriculture knowledge',
    description: 'Search published Knowledge Center articles and learning resources. Uses on-server Ollama embeddings when configured, otherwise keyword search. Draft and private content is excluded.',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: z.object({
      query: z.string().trim().min(2).max(1000),
      limit: z.number().int().min(1).max(8).optional()
    })
  }, async ({ query, limit }) => {
    try {
      return textResult(await agricultureKnowledge.search(query, limit || 5));
    } catch {
      return textResult('Published agriculture knowledge is temporarily unavailable.', true);
    }
  });

  server.registerTool('ask_agriculture_assistant', {
    title: 'Ask the agriculture assistant',
    description: 'Answer an agriculture question using the configured server-side model and relevant published Knowledge Center sources. Responses are general guidance, not a confirmed diagnosis or official recommendation.',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: z.object({
      question: z.string().trim().min(2).max(2500),
      language: z.enum(['en', 'ne']).default('en')
    })
  }, async ({ question, language }) => {
    try {
      const result = await farmingAi.askWithSources([{ role: 'user', content: question }], language);
      return textResult(result);
    } catch (error) {
      return textResult(error.code === 'AI_NOT_CONFIGURED'
        ? 'The server-side agriculture model is not configured yet.'
        : 'The agriculture assistant is temporarily unavailable.', true);
    }
  });

  server.registerTool('triage_crop_problem', {
    title: 'Triage a crop problem',
    description: 'Run the Kaski crop-assistance workflow: use a farmer-reported crop and symptoms, retrieve relevant published Knowledge Center evidence, and return cautious text-only possibilities and safe next checks. This is not a diagnosis; no image is accepted by this tool.',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: z.object({
      crop: z.string().trim().min(1).max(80),
      symptoms: z.string().trim().min(8).max(2000),
      plant_part: z.string().trim().max(80).optional(),
      crop_stage: z.string().trim().max(80).optional(),
      location: z.string().trim().max(120).optional(),
      duration: z.string().trim().max(80).optional(),
      recent_weather: z.string().trim().max(160).optional(),
      irrigation: z.string().trim().max(160).optional(),
      language: z.enum(['en', 'ne']).default('en')
    })
  }, async ({ crop, symptoms, plant_part, crop_stage, location, duration, recent_weather, irrigation, language }) => {
    try {
      const result = await farmingAi.triageCropProblem({
        crop, symptoms, plant_part, crop_stage, location, duration,
        recent_weather, irrigation
      }, language);
      return textResult(result);
    } catch (error) {
      return textResult(error.code === 'AI_NOT_CONFIGURED'
        ? 'The server-side crop assistant is not configured yet.'
        : 'The crop triage service is temporarily unavailable.', true);
    }
  });

  server.registerTool('agriculture_ai_status', {
    title: 'Agriculture AI service status',
    description: 'Report whether server-side assistant, crop image analysis, and retrieval are configured without exposing credentials or provider URLs.',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: z.object({})
  }, async () => textResult(farmingAi.status()));

  return server;
}

const mcpHandler = createMcpHandler(createServer, {
  legacy: 'stateless',
  maxRequestBodySize: 1024 * 1024,
  onerror: (error) => console.error('MCP request failed:', error.message)
});

function hasValidToken(req) {
  const expected = process.env.AGRI_MCP_TOKEN || '';
  const actual = (req.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1] || '';
  if (!expected || expected.length > 512 || !actual || actual.length > 512) return false;
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && crypto.timingSafeEqual(expectedBytes, actualBytes);
}

function webHeaders(nodeHeaders) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(nodeHeaders)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  return headers;
}

router.all('/', requestLimit, async (req, res, next) => {
  if (!process.env.AGRI_MCP_TOKEN) return res.status(503).json({ message: 'MCP access is not configured on this server.' });
  if (!hasValidToken(req)) return res.status(401).json({ message: 'Valid MCP bearer token required.' });

  try {
    const requestUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const isBodyless = req.method === 'GET' || req.method === 'HEAD';
    const body = isBodyless ? undefined : JSON.stringify(req.body ?? {});
    const request = new Request(requestUrl, { method: req.method, headers: webHeaders(req.headers), body });
    const response = await mcpHandler.fetch(request, { parsedBody: req.body });
    res.status(response.status);
    response.headers.forEach((value, name) => res.setHeader(name, value));
    if (!response.body) return res.end();
    Readable.fromWeb(response.body).on('error', next).pipe(res);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
