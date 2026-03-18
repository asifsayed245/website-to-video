import type { VideoScript, CameraDirection, Scene, ShotSize } from './types';

/**
 * Camera movement library — prompt fragments for Kling AI.
 * Each movement is designed to create cinematic motion when
 * converting a static image to a video clip.
 */
const CAMERA_MOVEMENTS = {
  slow_push_in: {
    prompt: 'Camera slowly pushes forward toward the subject, creating intimacy and focus',
    energy: 'low',
    direction: 'depth',
    bestFor: ['hook', 'reveal', 'emphasis'],
  },
  pull_back: {
    prompt: 'Camera gradually pulls back, revealing the full scene and creating context',
    energy: 'low',
    direction: 'depth',
    bestFor: ['cta', 'conclusion', 'establishing'],
  },
  track_left: {
    prompt: 'Camera smoothly tracks left across the scene, following the visual flow',
    energy: 'medium',
    direction: 'lateral',
    bestFor: ['transition', 'landscape', 'exploration'],
  },
  track_right: {
    prompt: 'Camera smoothly tracks right across the scene, revealing new elements',
    energy: 'medium',
    direction: 'lateral',
    bestFor: ['transition', 'landscape', 'exploration'],
  },
  orbit_right: {
    prompt: 'Camera orbits slowly to the right around the subject, adding dimension and drama',
    energy: 'medium',
    direction: 'orbital',
    bestFor: ['product', 'emphasis', 'key_point'],
  },
  orbit_left: {
    prompt: 'Camera orbits slowly to the left around the subject, creating visual interest',
    energy: 'medium',
    direction: 'orbital',
    bestFor: ['product', 'emphasis', 'key_point'],
  },
  crane_up: {
    prompt: 'Camera rises upward revealing more of the scene, creating a sense of grandeur',
    energy: 'high',
    direction: 'vertical',
    bestFor: ['establishing', 'grandeur', 'hook'],
  },
  crane_down: {
    prompt: 'Camera descends toward the subject, creating intimacy and drawing the viewer in',
    energy: 'high',
    direction: 'vertical',
    bestFor: ['intimacy', 'focus', 'detail'],
  },
  subtle_float: {
    prompt: 'Camera gently floats with subtle, almost imperceptible movement, creating calm',
    energy: 'low',
    direction: 'static',
    bestFor: ['calm', 'reflective', 'breathing'],
  },
  static_depth: {
    prompt: 'Camera stays still with shallow depth of field as the scene breathes naturally',
    energy: 'low',
    direction: 'static',
    bestFor: ['letting_breathe', 'pause', 'contemplation'],
  },
  dolly_zoom: {
    prompt: 'Slow dolly zoom creating a vertigo effect, background shifts perspective dramatically',
    energy: 'high',
    direction: 'depth',
    bestFor: ['dramatic', 'revelation', 'urgency'],
  },
} as const;

type MovementKey = keyof typeof CAMERA_MOVEMENTS;

/**
 * Map emotional tone to preferred movement energy.
 */
function toneToEnergy(tone: string): 'low' | 'medium' | 'high' {
  switch (tone) {
    case 'excitement':
    case 'urgency':
      return 'high';
    case 'curiosity':
    case 'confidence':
      return 'medium';
    case 'trust':
    default:
      return 'low';
  }
}

/**
 * Get candidate movements for a scene based on its type, emotion, and position.
 */
function getCandidates(
  scene: Scene,
  index: number,
  total: number,
  prevMovement?: MovementKey
): MovementKey[] {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const emotionalTone = scene.narration ? 'curiosity' : 'trust'; // Default

  // Shot-size-aware preferences: match camera movement to framing
  const shotSize = scene.shotDesign?.size;

  let preferred: MovementKey[];
  if (scene.type === 'hook' || isFirst) {
    preferred = ['slow_push_in', 'crane_up', 'crane_down'];
  } else if (scene.type === 'cta' || isLast) {
    preferred = ['pull_back', 'subtle_float', 'static_depth'];
  } else if (shotSize === 'closeup' || shotSize === 'extreme_closeup') {
    // Close-ups → intimate, subtle movements that don't fight tight framing
    preferred = ['subtle_float', 'static_depth', 'slow_push_in'];
  } else if (shotSize === 'medium_closeup') {
    // Medium close-ups → gentle movements, can orbit to reveal character
    preferred = ['subtle_float', 'slow_push_in', 'orbit_left', 'orbit_right'];
  } else if (shotSize === 'wide' || shotSize === 'extreme_wide') {
    // Wide shots → sweeping movements that leverage the full environment
    preferred = ['crane_up', 'track_left', 'track_right', 'pull_back'];
  } else {
    // Medium / full — most flexible, match to energy
    const energy = toneToEnergy(emotionalTone);
    preferred = (Object.keys(CAMERA_MOVEMENTS) as MovementKey[]).filter(
      (k) => CAMERA_MOVEMENTS[k].energy === energy || CAMERA_MOVEMENTS[k].energy === 'medium'
    );
  }

  // Filmmaking rules:
  // 1. Never repeat the same movement consecutively
  if (prevMovement) {
    preferred = preferred.filter((m) => m !== prevMovement);
  }

  // 2. Avoid jarring reversals (left followed by right, push followed by pull)
  if (prevMovement) {
    const prevDir = CAMERA_MOVEMENTS[prevMovement].direction;
    if (prevMovement === 'track_left') {
      preferred = preferred.filter((m) => m !== 'track_right');
    } else if (prevMovement === 'track_right') {
      preferred = preferred.filter((m) => m !== 'track_left');
    } else if (prevMovement === 'slow_push_in') {
      preferred = preferred.filter((m) => m !== 'pull_back');
    } else if (prevMovement === 'pull_back') {
      preferred = preferred.filter((m) => m !== 'slow_push_in');
    }

    // 3. Alternate direction types (lateral → depth → orbital → vertical)
    const prevDirType = prevDir;
    const differentDir = preferred.filter(
      (m) => CAMERA_MOVEMENTS[m].direction !== prevDirType
    );
    if (differentDir.length > 0) {
      preferred = differentDir;
    }
  }

  // Ensure we always have at least one candidate
  if (preferred.length === 0) {
    preferred = ['subtle_float', 'orbit_right', 'track_left'];
    if (prevMovement) {
      preferred = preferred.filter((m) => m !== prevMovement);
    }
  }

  return preferred;
}

/**
 * Plan camera directions for all scenes in a video script.
 * Applies filmmaking rules for visual continuity and compelling storytelling.
 *
 * Rules applied:
 * 1. Shot variety: Never repeat the same camera movement consecutively
 * 2. Emotional pacing: Match camera energy to scene emotion
 * 3. 30-degree rule: Each shot differs in camera angle/direction from the previous
 * 4. Rhythm alternation: Alternate between movement types (lateral ↔ depth ↔ orbital)
 * 5. Continuity: Avoid jarring directional reversals between consecutive scenes
 */
export function planCameraDirections(script: VideoScript): CameraDirection[] {
  const { scenes } = script;
  const directions: CameraDirection[] = [];
  let prevMovement: MovementKey | undefined;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const candidates = getCandidates(scene, i, scenes.length, prevMovement);

    // Pick the first candidate (highest priority based on scene context)
    const movement = candidates[0];
    const movementData = CAMERA_MOVEMENTS[movement];

    directions.push({
      sceneId: scene.id,
      movement,
      promptFragment: movementData.prompt,
      rationale: `Scene ${i + 1} (${scene.type}): ${movement.replace(/_/g, ' ')} — ${movementData.direction} direction, ${movementData.energy} energy`,
    });

    prevMovement = movement;
  }

  return directions;
}

/**
 * Combine camera direction prompt with scene's b-roll prompt for Kling AI.
 */
export function buildClipPrompt(cameraDirection: CameraDirection, brollPrompt: string): string {
  return `${cameraDirection.promptFragment}. ${brollPrompt}`;
}

/**
 * Derive a composition hint for image generation based on planned camera movement.
 * This ensures the generated image has a composition that works well
 * when the camera movement is applied during image-to-video conversion.
 */
export function deriveCompositionHint(movement: string, shotSize?: ShotSize): string {
  // Shot-size-specific composition layered with movement guidance
  const sizeHint = shotSize ? getShotSizeCompositionHint(shotSize, movement) : '';

  let movementHint: string;
  switch (movement) {
    case 'track_left':
    case 'track_right':
      movementHint = 'Wide horizontal composition with clear lateral flow, subject slightly off-center with open space for camera tracking.';
      break;
    case 'slow_push_in':
      movementHint = 'Central subject with clear focal point and depth layers, background elements visible for push-in depth.';
      break;
    case 'pull_back':
      movementHint = 'Rich environment surrounding the subject with interesting edge details visible for reveal.';
      break;
    case 'orbit_left':
    case 'orbit_right':
      movementHint = 'Three-dimensional subject with visible depth and volume, slightly angled perspective.';
      break;
    case 'crane_up':
      movementHint = 'Scene composed with strong ground-level detail and visible horizon, content stacked vertically.';
      break;
    case 'crane_down':
      movementHint = 'Scene with aerial perspective elements and clear downward focal point.';
      break;
    case 'dolly_zoom':
      movementHint = 'Strong central subject with layered background at different depth planes.';
      break;
    case 'subtle_float':
    case 'static_depth':
    default:
      movementHint = 'Balanced composition with natural depth of field.';
      break;
  }

  return sizeHint ? `${sizeHint} ${movementHint}` : movementHint;
}

/**
 * Shot-size-specific hints that help the image work well with a given camera movement.
 */
function getShotSizeCompositionHint(size: ShotSize, movement: string): string {
  if (size === 'closeup' || size === 'extreme_closeup') {
    if (movement === 'slow_push_in') {
      return 'Tight framing on subject face with depth layers behind for push-in.';
    }
    return 'Tight framing with shallow depth of field, subject expression clearly visible.';
  }
  if (size === 'medium_closeup') {
    if (movement === 'orbit_left' || movement === 'orbit_right') {
      return 'Chest-up framing with visible depth and volume for orbital reveal.';
    }
    return 'Chest-up framing, subject expression visible, soft background separation.';
  }
  if (size === 'wide' || size === 'extreme_wide') {
    if (movement === 'crane_up') {
      return 'Ground-level detail with visible horizon, content stacked vertically for upward reveal.';
    }
    if (movement === 'track_left' || movement === 'track_right') {
      return 'Expansive environment with clear horizontal layers for lateral tracking.';
    }
    return 'Full environment visible, subject small in frame with expansive surroundings.';
  }
  return '';
}
