/**
 * Browser Web Speech Synthesis Alert Hook
 * Announces critical QA milestones (healed locators, fatal crashes, completed runs) aloud.
 */

export function speakAlert(message: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  try {
    window.speechSynthesis.cancel(); // Stop any pending speech
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("[WebSpeech] Voice alert error:", err);
  }
}
