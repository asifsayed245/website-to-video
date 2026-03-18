import type { Scene } from './types';
import { defaultConfig } from './config';
import { wordCount } from './utils';

/**
 * Estimate total audio duration from word count and speech parameters.
 */
export function estimateAudioDuration(
  fullNarration: string,
  speed: number,
  lang: string
): number {
  const words = wordCount(fullNarration);
  const baseRate = defaultConfig.voice.speechRate[lang] || 2.5;
  const effectiveRate = baseRate * speed;
  // Add small buffer for TTS pauses between sentences
  return (words / effectiveRate) * 1.03;
}

/**
 * Distribute total audio duration across scenes proportionally by word count.
 * Each scene gets time proportional to its share of total words.
 */
export function calculateSceneDurations(
  scenes: Scene[],
  totalAudioSeconds: number,
  fps: number = 30
): Scene[] {
  const totalWords = scenes.reduce((sum, s) => sum + s.wordCount, 0);
  if (totalWords === 0) return scenes;

  const updated = scenes.map((scene) => {
    const proportion = scene.wordCount / totalWords;
    const rawDuration = totalAudioSeconds * proportion;
    // Round to nearest frame boundary
    const durationInFrames = Math.max(1, Math.round(rawDuration * fps));
    return { ...scene, durationSeconds: durationInFrames / fps };
  });

  // Absorb any rounding difference in the last scene
  const computedTotal = updated.reduce((sum, s) => sum + s.durationSeconds, 0);
  const diff = totalAudioSeconds - computedTotal;
  if (updated.length > 0) {
    updated[updated.length - 1].durationSeconds += diff;
  }

  return updated;
}
