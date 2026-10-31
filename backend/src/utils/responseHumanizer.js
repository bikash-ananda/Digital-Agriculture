'use strict';

/**
 * responseHumanizer.js
 * Transforms robotic or clinical AI responses into warm, conversational,
 * empathetic guidance tailored for farmers in Nepal (in Nepali and English).
 */

const ROBOTIC_PREFIXES = [
  /^as an (ai|artificial intelligence|agricultural language model)[^,\.\n]*[,\.\n]\s*/i,
  /^i am an ai[^,\.\n]*[,\.\n]\s*/i,
  /^certainly! Here is the information[^:\n]*[:\n]\s*/i,
  /^sure! here are the details[^:\n]*[:\n]\s*/i,
  /^based on the provided information[^,\.\n]*[,\.\n]\s*/i
];

function humanizeResponse(text, lang = 'en') {
  if (!text || typeof text !== 'string') return text;

  let cleaned = text.trim();

  // 1. Strip robotic prefixes
  for (const prefix of ROBOTIC_PREFIXES) {
    cleaned = cleaned.replace(prefix, '');
  }

  // 2. Simplify stiff words with whole-word replacement
  cleaned = cleaned
    .replace(/\butilize\b/gi, 'use')
    .replace(/\bcommence\b/gi, 'start')
    .replace(/\bterminate\b/gi, 'stop')
    .replace(/\boptimal parameters\b/gi, 'good conditions')
    .replace(/\bit is imperative that\b/gi, 'please be sure to');

  cleaned = cleaned.trim();

  // 3. Add warm greeting and helpful closing
  const isNe = lang === 'ne' || /[\u0900-\u097F]/.test(cleaned);

  if (isNe) {
    if (!cleaned.startsWith('नमस्ते') && !cleaned.startsWith('किसान') && !cleaned.startsWith('नमस्कार')) {
      cleaned = `नमस्ते किसान साथी! 🙏\n\n${cleaned}`;
    }
    if (!cleaned.includes('सफल खेतीको कामना')) {
      cleaned = `${cleaned}\n\nराम्रो उब्जनी र सफल खेतीको कामना!`;
    }
  } else {
    if (!cleaned.toLowerCase().startsWith('hello') && !cleaned.toLowerCase().startsWith('hi') && !cleaned.toLowerCase().startsWith('namaste')) {
      cleaned = `Namaste! Here is what will help your crops:\n\n${cleaned}`;
    }
    if (!cleaned.toLowerCase().includes('happy farming') && !cleaned.toLowerCase().includes('healthy harvest')) {
      cleaned = `${cleaned}\n\nWishing you a healthy harvest! Feel free to ask anytime if you need more tips.`;
    }
  }

  return cleaned;
}

module.exports = {
  humanizeResponse
};