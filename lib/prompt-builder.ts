import type { Scene, VideoScript, ContentStyle } from '@/lib/types';

/**
 * Rebuild the brollPrompt for a scene based on its narration, textOverlay,
 * and the script's character/environment guides.
 */
export function rebuildBrollPrompt(
  scene: Scene,
  script: VideoScript,
  contentStyle: ContentStyle = 'business',
): string {
  const parts: string[] = [];

  // Character and environment FIRST so they get highest attention from the model
  if (contentStyle === 'story' && script.characterGuide) {
    parts.push(`SAME CHARACTER in every frame: ${script.characterGuide}`);
  }
  if (contentStyle === 'story' && script.environmentGuide) {
    parts.push(`SAME WORLD: ${script.environmentGuide}`);
  }

  // Scene title for context
  if (scene.textOverlay) {
    parts.push(`Scene: "${scene.textOverlay}"`);
  }

  // Core visual from narration (up to 350 chars to preserve story details)
  if (scene.narration) {
    parts.push(`What is happening: ${scene.narration.slice(0, 350)}`);
  }

  const base = parts.join('. ').replace(/\.\./g, '.');
  return `${base}. No text, no words, no letters, no watermarks.`;
}
