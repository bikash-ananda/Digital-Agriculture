'use strict';

/**
 * nepaliVoiceAssistant.js
 * Speech Synthesis & Voice Processing Utilities for Farmer Support in Nepali / English.
 */

/**
 * Speak text out loud using browser SpeechSynthesis with Nepali preference,
 * fallback to Indian-English/standard.
 * @param {string} text 
 * @param {'ne'|'en'} lang 
 * @param {function} onEnd
 */
export function speakNepali(text, lang = 'ne', onEnd = null) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  
  const voices = window.speechSynthesis.getVoices() || [];
  // Prioritize Nepali, then Hindi/South-Asian voices for clear accent phonetics
  const match = voices.find(v => v.lang.startsWith('ne')) 
    || voices.find(v => v.lang.startsWith('hi')) 
    || voices.find(v => v.lang.startsWith('en-IN'))
    || voices[0];

  if (match) utterance.voice = match;
  utterance.lang = lang === 'ne' ? 'ne-NP' : 'en-US';
  utterance.rate = 0.95; // slightly slower for rural clarity
  utterance.pitch = 1.0;

  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
