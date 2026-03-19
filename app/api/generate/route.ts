import { NextResponse } from 'next/server';
import { submitAudioJob } from '@/lib/deapi';
import { generateImage, generateStoryboard } from '@/lib/gemini-image';
import type { VideoScript, AssetJob, Scene } from '@/lib/types';
import { IMAGE_STYLE_SUFFIXES } from '@/lib/types';
import { defaultConfig } from '@/lib/config';
import { planCameraDirections, deriveCompositionHint } from '@/lib/camera-director';
import { getSubShot, ACTION_PATTERN, INTIMATE_PATTERN, TENSION_PATTERN } from '@/lib/cinema-director';

/**
 * Split narration into roughly equal sentence groups for sub-image prompts.
 * Returns an array of narration segments (one per image).
 */
function splitNarration(narration: string, count: number): string[] {
  // Split on sentence boundaries (., !, ?)
  const sentences = narration
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);

  if (sentences.length <= count) {
    // Pad short splits with the full narration context
    const result = sentences.slice();
    while (result.length < count) {
      result.push(narration);
    }
    return result;
  }

  // Group sentences evenly
  const groups: string[] = [];
  const perGroup = Math.ceil(sentences.length / count);
  for (let i = 0; i < count; i++) {
    const start = i * perGroup;
    const end = Math.min(start + perGroup, sentences.length);
    groups.push(sentences.slice(start, end).join(' '));
  }
  return groups;
}

/**
 * Build a narration-focused addendum for multi-image sub-prompts.
 * The original brollPrompt (with character/environment context) stays as the base.
 * This just adds focus on a specific narration moment.
 */
function buildNarrationFocus(segment: string, fullNarration: string): string {
  // Don't add focus if the segment IS the full narration (padding case)
  if (segment === fullNarration) return '';
  const context = segment.length > 100 ? segment.slice(0, 100) : segment;
  return ` Focusing on this specific moment: "${context}".`;
}

/**
 * Intelligently determine how many images a scene needs based on its content.
 * Action-heavy scenes get more images (fast cuts), emotional scenes get fewer
 * (lingering shots). In clips mode, enforces a minimum floor so total clip
 * duration covers the scene.
 */
function planSceneImageCount(
  scene: Scene,
  clipDuration: number | null, // null = images mode, number = clips mode (seconds per clip)
): number {
  const narration = scene.narration;

  // 1. Determine base pacing tier (seconds per image)
  let secsPerImage = 5.5; // default
  if (ACTION_PATTERN.test(narration))       secsPerImage = 3.5;
  else if (TENSION_PATTERN.test(narration)) secsPerImage = 4.0;
  else if (scene.dialogue && scene.dialogue.length > 0) secsPerImage = 4.0;
  else if (INTIMATE_PATTERN.test(narration)) secsPerImage = 7.0;

  // 2. Scene type modifier: hooks need attention, CTAs are conclusive
  if (scene.type === 'hook') secsPerImage *= 0.9;
  else if (scene.type === 'cta') secsPerImage *= 1.1;

  // 3. Sentence density bonus: more sentences = more distinct moments to show
  const sentences = narration.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  const expectedSentences = Math.round(scene.durationSeconds / 4); // ~1 sentence per 4s typical
  const densityBonus = sentences > expectedSentences + 1 ? 1 : 0;

  // 4. Calculate image count
  let count = Math.ceil(scene.durationSeconds / secsPerImage) + densityBonus;

  // 5. Clips mode floor: enough clips to cover scene duration
  if (clipDuration !== null) {
    const minForClips = Math.ceil(scene.durationSeconds / clipDuration);
    count = Math.max(count, minForClips);
  }

  // 6. Bounds
  return Math.max(1, Math.min(count, 10));
}

interface ImageTask {
  jobId: string;
  sceneId: string;
  prompt: string;
  sortOrder: number; // to preserve order within a scene
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const script: VideoScript = body;

    if (!script.scenes || script.scenes.length === 0) {
      return NextResponse.json({ error: 'No scenes in script' }, { status: 400 });
    }

    const jobs: AssetJob[] = [];
    const errors: string[] = [];

    // Use selected image style suffix, fall back to realistic
    const styleSuffix = IMAGE_STYLE_SUFFIXES[script.imageStyle || 'realistic'];
    const instructionSuffix = script.imageInstruction?.trim()
      ? `. Additional instruction: ${script.imageInstruction.trim()}`
      : '';

    // Pre-plan camera directions to derive composition hints for images
    const cameraDirections = planCameraDirections(script);
    const cameraByScene = new Map(cameraDirections.map((cd) => [cd.sceneId, cd]));

    // Build image tasks with intelligent per-scene pacing.
    // Action scenes get more images (fast cuts), emotional scenes fewer (lingering shots).
    // In clips mode, enforces a minimum so clip duration covers each scene.
    const clipDuration = script.clipModel
      ? parseFloat(script.clipDuration || '5')
      : null;
    const imageTasks: ImageTask[] = [];

    for (const scene of script.scenes) {
      const imageCount = planSceneImageCount(scene, clipDuration);

      // Get composition hint from planned camera movement
      const cam = cameraByScene.get(scene.id);
      const compositionHint = cam ? ` ${deriveCompositionHint(cam.movement, scene.shotDesign?.size)}` : '';

      if (imageCount === 1) {
        // Single image — use the scene's full brollPrompt (already has consistency context)
        imageTasks.push({
          jobId: `img-${scene.id}-0`,
          sceneId: scene.id,
          prompt: scene.brollPrompt + compositionHint + styleSuffix + instructionSuffix,
          sortOrder: 0,
        });
      } else {
        // Multiple images — keep the SAME base prompt (environment + character + setting)
        // and only vary the narration moment focus for each sub-image.
        // This ensures all images within a scene share the same environment.
        const segments = splitNarration(scene.narration, imageCount);

        for (let i = 0; i < imageCount; i++) {
          const narrationFocus = buildNarrationFocus(segments[i], scene.narration);
          // Add sequential position context for multi-image continuity
          const positionHint = ` [Image ${i + 1} of ${imageCount} — scene progression].`;
          const continuityHint = i > 0 ? ' Maintain same environment, lighting, and subject positioning as previous frame.' : '';
          // Sub-shot variation: tighter framing for alternating images (cut-in pattern)
          const subShotHint = scene.shotDesign && i > 0
            ? ` ${getSubShot(scene.shotDesign, i).promptFragment}`
            : '';
          imageTasks.push({
            jobId: `img-${scene.id}-${i}`,
            sceneId: scene.id,
            prompt: scene.brollPrompt + narrationFocus + positionHint + continuityHint + subShotHint + compositionHint + styleSuffix + instructionSuffix,
            sortOrder: i,
          });
        }
      }
    }

    // Detect story mode: use multi-turn chat for visual consistency
    const isStoryMode = !!(script.characterGuide || script.environmentGuide);

    if (isStoryMode) {
      // Story mode: sequential chat-based generation for storyboard consistency
      const storyContext = [
        script.characterGuide ? `Characters: ${script.characterGuide}` : '',
        script.environmentGuide ? `Environment: ${script.environmentGuide}` : '',
        `Visual style: ${styleSuffix}`,
      ].filter(Boolean).join('\n');

      // Build a numbered story outline so the model understands the full arc
      // and can position each frame correctly within the progression
      const storyOutline = script.scenes.map((s, idx) => {
        const sceneLabel = s.type === 'hook' ? 'Opening' : s.type === 'cta' ? 'Ending' : `Scene ${idx}`;
        return `${idx + 1}. [${sceneLabel}] ${s.textOverlay}: ${s.narration}`;
      }).join('\n');

      const storyboardResults = await generateStoryboard(imageTasks, storyContext, storyOutline);

      for (const task of imageTasks) {
        const url = storyboardResults.get(task.jobId);
        if (url) {
          jobs.push({
            id: task.jobId,
            sceneId: task.sceneId,
            type: 'image',
            requestId: '',
            status: 'done',
            resultUrl: url,
          });
        } else {
          errors.push(`${task.jobId}: Storyboard generation failed`);
          jobs.push({
            id: task.jobId,
            sceneId: task.sceneId,
            type: 'image',
            requestId: '',
            status: 'failed',
          });
        }
      }
    } else {
      // Business mode: parallel batch generation (unchanged)
      const BATCH_SIZE = 4;
      const imageResults: PromiseSettledResult<string>[] = [];

      for (let b = 0; b < imageTasks.length; b += BATCH_SIZE) {
        const batch = imageTasks.slice(b, b + BATCH_SIZE);
        const batchResults = await Promise.allSettled(
          batch.map((task) => generateImage(task.prompt, task.jobId))
        );
        imageResults.push(...batchResults);
        // Brief delay between batches to stay within Gemini rate limits
        if (b + BATCH_SIZE < imageTasks.length) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      for (let i = 0; i < imageTasks.length; i++) {
        const task = imageTasks[i];
        const result = imageResults[i];

        if (result.status === 'fulfilled') {
          jobs.push({
            id: task.jobId,
            sceneId: task.sceneId,
            type: 'image',
            requestId: '',
            status: 'done',
            resultUrl: result.value,
          });
        } else {
          const msg = result.reason instanceof Error ? result.reason.message : 'Image generation failed';
          errors.push(`${task.jobId}: ${msg}`);
          jobs.push({
            id: task.jobId,
            sceneId: task.sceneId,
            type: 'image',
            requestId: '',
            status: 'failed',
          });
        }
      }
    }

    // ── Audio job submission ──
    const audioMode = script.audioMode || 'narration';

    // Narration TTS (for 'narration' and 'both' modes)
    if (audioMode !== 'dialogue') {
      const fullNarration = script.fullNarration || script.scenes.map((s) => s.narration).join(' ');
      if (fullNarration.trim()) {
        try {
          const audRequestId = await submitAudioJob(
            fullNarration,
            script.voiceId,
            script.voiceSpeed,
            script.voiceLang || defaultConfig.voice.lang
          );
          jobs.push({
            id: 'aud-full',
            sceneId: 'full',
            type: 'audio',
            requestId: audRequestId,
            status: 'processing',
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Audio job failed';
          errors.push(`aud-full: ${msg}`);
          jobs.push({
            id: 'aud-full',
            sceneId: 'full',
            type: 'audio',
            requestId: '',
            status: 'failed',
          });
        }
      }
    }

    // Per-character dialogue TTS — only for 'both' mode as a narration supplement.
    // In 'dialogue' mode, video clips provide character audio via native lip-sync
    // (the per-character TTS approach is not used because clips embed dialogue audio).
    if (audioMode === 'both') {
      // Collect all dialogue lines grouped by character
      const characterLines = new Map<string, string[]>();
      for (const scene of script.scenes) {
        if (scene.dialogue) {
          for (const line of scene.dialogue) {
            if (!characterLines.has(line.speaker)) {
              characterLines.set(line.speaker, []);
            }
            characterLines.get(line.speaker)!.push(line.text);
          }
        }
      }

      // Submit one TTS job per character with all their lines concatenated
      const characters = script.characters || [];
      for (const [charName, lines] of characterLines) {
        const charText = lines.join('. ');
        if (!charText.trim()) continue;

        // Find character voice mapping, fall back to default
        const charMapping = characters.find((c) => c.name === charName);
        const charVoiceId = charMapping?.voiceId || script.voiceId;
        const charVoiceLang = charMapping?.voiceLang || script.voiceLang || defaultConfig.voice.lang;

        const jobId = `aud-char-${charName.toLowerCase().replace(/\s+/g, '-')}`;
        try {
          const audRequestId = await submitAudioJob(
            charText,
            charVoiceId,
            script.voiceSpeed,
            charVoiceLang
          );
          jobs.push({
            id: jobId,
            sceneId: `char-${charName}`,
            type: 'audio',
            requestId: audRequestId,
            status: 'processing',
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Dialogue audio failed';
          errors.push(`${jobId}: ${msg}`);
          jobs.push({
            id: jobId,
            sceneId: `char-${charName}`,
            type: 'audio',
            requestId: '',
            status: 'failed',
          });
        }
      }
    }

    const allFailed = jobs.every((j) => j.status === 'failed');
    if (allFailed) {
      return NextResponse.json(
        { error: `All asset jobs failed. ${errors[0] || 'Unknown error'}`, jobs, errors },
        { status: 502 }
      );
    }

    return NextResponse.json({ jobs, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
