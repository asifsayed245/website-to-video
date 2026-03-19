/**
 * Cinema Director — professional shot design for AI image generation.
 *
 * Applies filmmaking cinematography rules to decide shot size, camera angle,
 * lens perspective, depth-of-field, and composition for each scene.
 *
 * Sources:
 * - Standard dialogue coverage: Master → OTS → Medium → Close-up
 * - Blain Brown, The Basics of Filmmaking (lighting, OTS, reaction shots)
 * - LTX Studio / StudioBinder shot type guides
 */

import type { ShotSize, CameraAngle, ShotDesign, AudioMode } from './types';

// ── Lens & DoF lookup ──

const LENS_HINTS: Record<ShotSize, string> = {
  extreme_wide: 'wide-angle 24mm lens perspective, deep focus, everything sharp',
  wide: 'wide-angle 28mm lens perspective, deep focus, full environment sharp',
  full: '35mm lens perspective, moderate depth of field',
  medium: '50mm standard lens perspective, moderate depth of field, subject sharp with soft background',
  medium_closeup: '85mm portrait lens perspective, shallow depth of field, background bokeh',
  closeup: '85mm portrait lens perspective, shallow depth of field, creamy bokeh background',
  extreme_closeup: '100mm macro lens perspective, very shallow depth of field, subject isolated from background',
};

// ── Composition rules per shot size ──

const COMPOSITION_RULES: Record<ShotSize, string> = {
  extreme_wide: 'Full environment visible, subject small in lower third, vast landscape or setting dominant, leading lines guiding eye to subject.',
  wide: 'Full environment visible with subject head-to-toe, subject placed on left or right third line, clear foreground and background layers.',
  full: 'Subject shown full body, balanced with environment, rule of thirds placement, clear ground and context.',
  medium: 'Subject framed waist-up, on right-third line with leading space in gaze direction, environment context visible but secondary.',
  medium_closeup: 'Subject framed chest-up, eyes on upper-third line, clear facial features, soft background separation.',
  closeup: 'Subject face fills frame, eyes on upper-third line, expression clearly visible, shallow depth of field isolates subject.',
  extreme_closeup: 'Tight crop on eyes or hands, detail fills entire frame, maximum emotional intimacy, background completely blurred.',
};

// ── Angle description fragments ──

const ANGLE_PROMPTS: Record<CameraAngle, string> = {
  eye_level: 'Camera at eye level, neutral and relatable perspective.',
  low_angle: 'Camera below eye level looking up, subject appears powerful and commanding.',
  high_angle: 'Camera above eye level looking down, subject appears vulnerable or diminished.',
  dutch: 'Slightly tilted dutch angle, creating tension and unease.',
  birds_eye: 'Overhead bird\'s-eye view looking straight down, showing spatial layout.',
  over_shoulder: 'Over-the-shoulder framing, one character\'s shoulder/back in soft-focus foreground, speaking character in sharp focus.',
};

// ── Shot size labels for prompt ──

const SIZE_LABELS: Record<ShotSize, string> = {
  extreme_wide: 'Extreme wide shot',
  wide: 'Wide establishing shot',
  full: 'Full shot (head to toe)',
  medium: 'Medium shot (waist up)',
  medium_closeup: 'Medium close-up (chest up)',
  closeup: 'Close-up shot (face and shoulders)',
  extreme_closeup: 'Extreme close-up (eyes or detail)',
};

// ── Content analysis patterns ──

export const INTIMATE_PATTERN = /whisper|secret|confess|tears|cry|emotion|feel|heart|love|grief|sorrow|regret|longing/i;
export const ACTION_PATTERN = /run|fight|chase|escape|journey|travel|walk|arrive|battle|attack|defend|crash|explode/i;
const POWER_PATTERN = /power|authority|command|leader|king|queen|ruler|conquer|dominate|triumph|victory/i;
const VULNERABLE_PATTERN = /vulnerable|weak|helpless|lost|afraid|scared|trapped|alone|abandoned|broken/i;
export const TENSION_PATTERN = /tension|suspense|danger|threat|risk|countdown|ticking|urgent|deadline|crisis/i;

/**
 * Design a professional cinematographic shot for a scene.
 *
 * @param sceneType - hook, key_point, or cta
 * @param sceneIndex - position in the sequence
 * @param totalScenes - total number of scenes
 * @param prevShot - previous scene's shot design (for anti-repetition)
 * @param hasDialogue - whether this scene has character dialogue
 * @param narration - scene narration/detail text (for content analysis)
 * @param emotionalTone - the scene's emotional tone from content research
 * @param audioMode - narration, dialogue, or both
 */
export function designShot(
  sceneType: 'hook' | 'key_point' | 'cta',
  sceneIndex: number,
  totalScenes: number,
  prevShot: ShotDesign | undefined,
  hasDialogue: boolean,
  narration: string,
  emotionalTone?: string,
  audioMode?: AudioMode,
): ShotDesign {
  // 1. Determine shot size
  let size = decideShotSize(sceneType, sceneIndex, totalScenes, prevShot?.size, hasDialogue, narration, audioMode);

  // 2. Determine camera angle
  let angle = decideCameraAngle(narration, emotionalTone, hasDialogue, size);

  // 3. Anti-repetition: don't repeat same size consecutively
  if (prevShot && size === prevShot.size) {
    size = getAlternateSize(size, sceneType, hasDialogue);
  }

  // 4. Build the complete prompt fragment
  const promptFragment = buildShotPrompt(size, angle);

  return { size, angle, promptFragment };
}

function decideShotSize(
  sceneType: 'hook' | 'key_point' | 'cta',
  sceneIndex: number,
  totalScenes: number,
  prevSize: ShotSize | undefined,
  hasDialogue: boolean,
  narration: string,
  audioMode?: AudioMode,
): ShotSize {
  const isFirst = sceneIndex === 0;
  const isLast = sceneIndex === totalScenes - 1;

  // Opening / hook — wide establishing shot
  if (sceneType === 'hook' || isFirst) {
    return 'wide';
  }

  // CTA / ending — medium shot, balanced and conclusive
  if (sceneType === 'cta' || isLast) {
    return 'medium';
  }

  // Dialogue scenes — alternate between close-up and medium close-up
  // for lip-sync visibility and visual variety
  if (hasDialogue && (audioMode === 'dialogue' || audioMode === 'both')) {
    // Alternate for variety
    if (prevSize === 'closeup' || prevSize === 'extreme_closeup') {
      return 'medium_closeup';
    }
    if (prevSize === 'medium_closeup') {
      return 'closeup';
    }
    // Default dialogue: odd scenes get close-up, even get medium close-up
    return sceneIndex % 2 === 1 ? 'closeup' : 'medium_closeup';
  }

  // Intimate/emotional content → extreme close-up
  if (INTIMATE_PATTERN.test(narration)) {
    return 'extreme_closeup';
  }

  // Action content → wide or full to show movement
  if (ACTION_PATTERN.test(narration)) {
    return prevSize === 'wide' ? 'full' : 'wide';
  }

  // Default key point — medium shot (the "sweet spot")
  return 'medium';
}

function decideCameraAngle(
  narration: string,
  emotionalTone?: string,
  hasDialogue?: boolean,
  size?: ShotSize,
): CameraAngle {
  // Heavy dialogue → over-the-shoulder for conversational coverage
  if (hasDialogue && size && (size === 'medium' || size === 'medium_closeup')) {
    return 'over_shoulder';
  }

  // Power/authority in content or confidence tone
  if (POWER_PATTERN.test(narration) || emotionalTone === 'confidence') {
    return 'low_angle';
  }

  // Vulnerability in content
  if (VULNERABLE_PATTERN.test(narration)) {
    return 'high_angle';
  }

  // Tension/suspense → dutch angle for unease
  if (TENSION_PATTERN.test(narration) || emotionalTone === 'urgency') {
    return 'dutch';
  }

  // Default — eye level (neutral, relatable)
  return 'eye_level';
}

/**
 * When the shot size would repeat, pick an alternative that still fits.
 */
function getAlternateSize(
  currentSize: ShotSize,
  sceneType: 'hook' | 'key_point' | 'cta',
  hasDialogue: boolean,
): ShotSize {
  const alternates: Record<ShotSize, ShotSize> = {
    extreme_wide: 'wide',
    wide: 'full',
    full: 'medium',
    medium: hasDialogue ? 'medium_closeup' : 'full',
    medium_closeup: hasDialogue ? 'closeup' : 'medium',
    closeup: 'medium_closeup',
    extreme_closeup: 'closeup',
  };
  return alternates[currentSize] || 'medium';
}

/**
 * Build the complete cinematography prompt fragment from shot design.
 */
function buildShotPrompt(size: ShotSize, angle: CameraAngle): string {
  const parts = [
    SIZE_LABELS[size] + '.',
    ANGLE_PROMPTS[angle],
    COMPOSITION_RULES[size],
    LENS_HINTS[size] + '.',
  ];
  return parts.join(' ');
}

/**
 * Get a tighter sub-shot for multi-image variation within a scene.
 * Image 1 uses the primary shot; Image 2+ uses tighter framing
 * to create a natural "cut-in" pattern.
 */
export function getSubShot(primary: ShotDesign, imageIndex: number): ShotDesign {
  if (imageIndex === 0) return primary;

  // Tighten the shot for subsequent images
  const tighterSizes: Partial<Record<ShotSize, ShotSize>> = {
    extreme_wide: 'wide',
    wide: 'medium',
    full: 'medium_closeup',
    medium: 'medium_closeup',
    medium_closeup: 'closeup',
    closeup: 'extreme_closeup',
    extreme_closeup: 'extreme_closeup',
  };

  // Alternate: even sub-images tighten, odd sub-images return to primary
  if (imageIndex % 2 === 0) return primary;

  const tighterSize = tighterSizes[primary.size] || primary.size;
  return {
    size: tighterSize,
    angle: primary.angle,
    promptFragment: buildShotPrompt(tighterSize, primary.angle),
  };
}
