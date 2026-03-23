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

  // Core visual from narration
  if (scene.narration) {
    parts.push(scene.narration.slice(0, 200));
  }

  // Text overlay adds context
  if (scene.textOverlay) {
    parts.push(`Scene: "${scene.textOverlay}"`);
  }

  // Character consistency
  if (contentStyle === 'story' && script.characterGuide) {
    parts.push(`Character: ${script.characterGuide.slice(0, 100)}`);
  }

  // Environment consistency
  if (contentStyle === 'story' && script.environmentGuide) {
    parts.push(`Setting: ${script.environmentGuide.slice(0, 100)}`);
  }

  const base = parts.join('. ').replace(/\.\./g, '.');
  return `${base}. No text, no words, no letters, no watermarks.`;
}
