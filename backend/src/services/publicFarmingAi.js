const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

function configuration() {
  const apiKey = process.env.FARMING_AI_API_KEY || '';
  const endpoint = process.env.FARMING_AI_URL || (apiKey ? DEFAULT_ENDPOINT : '');
  const model = process.env.FARMING_AI_MODEL || '';
  return {
    endpoint,
    model,
    apiKey,
    configured: Boolean(endpoint && model),
    cropDoctorConfigured: Boolean(endpoint && model && process.env.FARMING_CROP_DOCTOR_ENABLED === 'true')
  };
}

function status() {
  const config = configuration();
  return { assistant_configured: config.configured, crop_doctor_configured: config.cropDoctorConfigured };
}

async function complete(messages, options = {}) {
  const config = configuration();
  if (!config.configured || (options.image && !config.cropDoctorConfigured)) {
    const error = new Error('The Smart Farming AI service is not configured.');
    error.status = 503;
    error.code = 'AI_NOT_CONFIGURED';
    throw error;
  }

  const requestMessages = [
    {
      role: 'system',
      content: options.systemPrompt || 'You are a careful agricultural information assistant for farmers in Kaski District, Nepal. Reply in the requested language using clear, practical steps. Separate general guidance from verified local advice. Do not invent live weather, prices, official recommendations, or diagnoses. Do not prescribe pesticide brands, doses, or application schedules. When symptoms are uncertain or severe, advise contacting an agricultural technician. State uncertainty clearly.'
    },
    ...messages
  ];
  const headers = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  let response;
  try {
      response = await fetch(config.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: config.model, messages: requestMessages, temperature: 0.25, max_tokens: 1000 }),
      signal: AbortSignal.timeout(30000)
    });
  } catch {
    const error = new Error('The Smart Farming AI provider could not be reached.');
    error.status = 502;
    error.code = 'AI_PROVIDER_UNAVAILABLE';
    throw error;
  }
  if (!response.ok) {
    const error = new Error('The Smart Farming AI provider did not complete the request.');
    error.status = response.status === 429 ? 503 : 502;
    error.code = response.status === 429 ? 'AI_PROVIDER_BUSY' : 'AI_PROVIDER_ERROR';
    throw error;
  }
  const result = await response.json().catch(() => null);
  const content = result?.choices?.[0]?.message?.content;
  const text = Array.isArray(content) ? content.map((part) => part.text || '').join('\n').trim() : (typeof content === 'string' ? content.trim() : '');
  if (!text) {
    const error = new Error('The Smart Farming AI provider returned an empty response.');
    error.status = 502;
    error.code = 'AI_EMPTY_RESPONSE';
    throw error;
  }
  return text;
}

async function ask(messages, lang) {
  const language = lang === 'ne' ? 'Nepali' : 'English';
  return complete(messages, { systemPrompt: `You are a careful agricultural information assistant for farmers in Kaski District, Gandaki Province, Nepal. Reply in ${language}. Use simple language, short headings and numbered practical steps. Ask a brief follow-up when key details are missing. Distinguish general guidance from verified local recommendations. Never invent live weather, prices, official recommendations, or diagnoses. Do not recommend pesticide products or application rates. For uncertain or serious crop problems, recommend inspection by an agricultural technician. Say when information is uncertain.` });
}

async function diagnose(fields, image, lang = 'en') {
  const { crop, symptoms, plantPart, cropStage, location, duration, recentWeather, irrigation } = fields;
  const description = [
    `Crop: ${crop}`,
    plantPart && `Affected plant part: ${plantPart}`,
    cropStage && `Crop stage: ${cropStage}`,
    location && `Location: ${location}`,
    duration && `Symptoms observed for: ${duration}`,
    recentWeather && `Recent weather: ${recentWeather}`,
    irrigation && `Irrigation practices: ${irrigation}`,
    `Farmer's symptom description: ${symptoms}`,
    'Inspect the supplied image and the text. Return: (1) what can be observed, (2) a short list of possible causes with uncertainty, (3) safe observations the farmer can make next, (4) low-risk prevention steps, and (5) when to contact an agricultural technician. Do not claim a confirmed diagnosis. Do not name pesticide products or give pesticide rates. If the photo is unclear, say so.'
  ].filter(Boolean).join('\n');
  const mime = image.mimetype;
  const dataUrl = `data:${mime};base64,${image.buffer.toString('base64')}`;
  return complete([{ role: 'user', content: [
    { type: 'text', text: description },
    { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } }
  ] }], { image: true, systemPrompt: `You are an agricultural crop symptom triage assistant for farmers in Kaski District, Nepal. Reply in ${lang === 'ne' ? 'Nepali' : 'English'}. Image-based output is preliminary and must not be presented as a diagnosis. Be cautious, explain uncertainty and use integrated pest management principles. Never recommend pesticide brands, dosages, or application schedules. Escalate uncertain, spreading, or severe problems to a qualified local agricultural technician.` });
}

module.exports = { status, ask, diagnose };
