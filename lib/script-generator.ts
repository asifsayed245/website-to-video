import type { StructuredContent, VideoScript, Scene, KeyPoint, ContentStyle, ScriptLanguage, AudioMode, ShotDesign } from './types';
import { defaultConfig } from './config';
import { estimateAudioDuration, calculateSceneDurations } from './audio-timing';
import { wordCount } from './utils';
import { designShot } from './cinema-director';

export function generateScript(content: StructuredContent, contentStyle: ContentStyle = 'business', targetDuration: number = 60, scriptLanguage: ScriptLanguage = 'english', audioMode: AudioMode = 'narration'): VideoScript {
  if (contentStyle === 'story') {
    return generateStoryScript(content, targetDuration, scriptLanguage, audioMode);
  }
  const scenes: Scene[] = [];
  const topicContext = content.themes.slice(0, 3).join(', ');

  // Scene 1: Hook — distinct from key points, no description reuse
  const hookNarration = `Here's what you need to know about ${content.title} right now.`;

  // Pre-count total scenes for shot design
  const voiceLangForBudget = scriptLanguage === 'english' ? 'en-us' : 'hi';
  const speechRate = defaultConfig.voice.speechRate[voiceLangForBudget] || 2.5;
  const maxWords = Math.floor(targetDuration * speechRate * defaultConfig.voice.speed);
  let totalBusinessScenes = 2; // hook + cta
  { let tw = wordCount(hookNarration) + 10;
    for (let i = 0; i < content.keyPoints.length; i++) {
      const w = wordCount(`${content.keyPoints[i].heading}. ${content.keyPoints[i].detail}`);
      if (i >= 2 && tw + w > maxWords) break;
      tw += w; totalBusinessScenes++;
    }
  }

  let prevShot: ShotDesign | undefined;
  const hookShot = designShot('hook', 0, totalBusinessScenes, prevShot, false, hookNarration);
  prevShot = hookShot;

  scenes.push({
    id: 'hook',
    type: 'hook',
    durationSeconds: 0, // will be computed from audio
    narration: hookNarration,
    wordCount: wordCount(hookNarration),
    brollPrompt: buildHookPrompt(content.title, topicContext, hookShot),
    textOverlay: content.title,
    visualMotion: 'zoom_in',
    shotDesign: hookShot,
  });

  // Key point scenes — add points until we hit the word budget for the target duration
  const motions: Scene['visualMotion'][] = ['ken_burns_right', 'ken_burns_left', 'zoom_out', 'zoom_in'];

  let runningWords = scenes.reduce((sum, s) => sum + s.wordCount, 0);
  // Reserve ~10 words for CTA
  const ctaReserve = 10;

  for (let i = 0; i < content.keyPoints.length; i++) {
    const point = content.keyPoints[i];
    const narration = `${point.heading}. ${point.detail}`;
    const words = wordCount(narration);

    // Stop adding points if we'd exceed the budget (but always include at least 2)
    if (i >= 2 && runningWords + words + ctaReserve > maxWords) break;

    const kpShot = designShot('key_point', i + 1, totalBusinessScenes, prevShot, false, narration, point.emotionalTone);
    prevShot = kpShot;

    scenes.push({
      id: `point_${i + 1}`,
      type: 'key_point',
      durationSeconds: 0,
      narration,
      wordCount: words,
      brollPrompt: buildKeyPointPrompt(point.imagePrompt || narration, point.heading, content.title, toneToVisualStyle(point.emotionalTone), kpShot),
      textOverlay: point.heading,
      visualMotion: motions[i % motions.length],
      shotDesign: kpShot,
    });
    runningWords += words;
  }

  // CTA scene
  const ctaText = content.cta?.text || `Learn more about ${content.title}`;
  const ctaSource = content.source.startsWith('http')
    ? new URL(content.source).hostname
    : '';
  const ctaNarration = `${ctaText}. ${ctaSource ? `Visit ${ctaSource} to get started.` : 'Take action today.'}`;

  const ctaShot = designShot('cta', totalBusinessScenes - 1, totalBusinessScenes, prevShot, false, ctaNarration);

  scenes.push({
    id: 'cta',
    type: 'cta',
    durationSeconds: 0,
    narration: ctaNarration,
    wordCount: wordCount(ctaNarration),
    brollPrompt: buildCTAPrompt(content.title, topicContext, content.targetAudience, ctaShot),
    textOverlay: ctaSource ? `${ctaText}\n${ctaSource}` : ctaText,
    visualMotion: 'static',
    shotDesign: ctaShot,
  });

  // Build full narration for single TTS job
  const fullNarration = scenes.map((s) => s.narration).join(' ');

  // Auto-select voice based on script language
  const voiceId = scriptLanguage === 'english' ? 'af_heart' : 'hf_alpha';
  const voiceLang = scriptLanguage === 'english' ? 'en-us' : 'hi';

  // Estimate total duration for initial display (refined after actual TTS)
  const estimatedDuration = estimateAudioDuration(fullNarration, defaultConfig.voice.speed, voiceLang);

  // Distribute estimated duration across scenes proportionally by word count
  const timedScenes = calculateSceneDurations(scenes, estimatedDuration);
  // Add cross-scene context for image continuity
  const contextualScenes = addCrossSceneContext(timedScenes);
  const totalDuration = contextualScenes.reduce((sum, s) => sum + s.durationSeconds, 0);

  return {
    scenes: contextualScenes,
    fullNarration,
    totalDurationSeconds: totalDuration,
    voiceId,
    voiceSpeed: defaultConfig.voice.speed,
    voiceLang,
    scriptLanguage,
  };
}

/**
 * Enhance brollPrompts with cross-scene context for visual continuity.
 * Prepends neighboring scene references so image generation maintains flow.
 */
function addCrossSceneContext(scenes: Scene[]): Scene[] {
  if (scenes.length <= 1) return scenes;

  return scenes.map((scene, idx) => {
    const parts: string[] = [];

    if (idx > 0) {
      const prevOverlay = scenes[idx - 1].textOverlay.slice(0, 60);
      parts.push(`In visual continuity with previous scene: "${prevOverlay}".`);
    }
    if (idx < scenes.length - 1) {
      const nextOverlay = scenes[idx + 1].textOverlay.slice(0, 60);
      parts.push(`Transitioning toward next scene: "${nextOverlay}".`);
    }

    // Consistent lighting/palette instruction
    parts.push('Maintain consistent lighting, color palette, and visual tone across scenes.');

    const contextPrefix = parts.join(' ') + ' ';
    return { ...scene, brollPrompt: contextPrefix + scene.brollPrompt };
  });
}

function buildHookPrompt(title: string, themes: string, shot: ShotDesign): string {
  return `${shot.promptFragment} A striking photograph representing "${title}". The scene visually conveys the themes of ${themes}. Dramatic lighting. No text, no words, no letters, no watermarks`;
}

function buildKeyPointPrompt(narration: string, heading: string, mainTopic: string, moodStyle: string, shot: ShotDesign): string {
  const context = narration.length > 120 ? narration.slice(0, 120) : narration;
  return `${shot.promptFragment} A photograph that visually represents: "${context}". Subject: ${heading} as it relates to ${mainTopic}. Style: ${moodStyle}. No text, no words, no letters, no watermarks`;
}

function buildCTAPrompt(title: string, themes: string, audience: string, shot: ShotDesign): string {
  return `${shot.promptFragment} A scene showing people successfully engaging with ${title}. The environment reflects themes of ${themes}. Target audience: ${audience}. Optimistic, forward-looking mood. Warm natural lighting, authentic setting. No text, no words, no letters, no watermarks`;
}

function toneToVisualStyle(tone: KeyPoint['emotionalTone']): string {
  const styles: Record<string, string> = {
    excitement: 'vibrant energetic dynamic lighting, bold colors',
    trust: 'calm trustworthy atmosphere, professional blue tones',
    confidence: 'bold confident composition, strong geometric lines',
    curiosity: 'intriguing mysterious atmosphere, soft bokeh lighting',
    urgency: 'dramatic intense lighting, warm orange-red tones',
  };
  return styles[tone] || 'professional modern clean composition';
}

// ── Story Script Generation ──

function generateStoryScript(content: StructuredContent, targetDuration: number = 60, scriptLanguage: ScriptLanguage = 'english', audioMode: AudioMode = 'narration'): VideoScript {
  const scenes: Scene[] = [];
  const motions: Scene['visualMotion'][] = [
    'zoom_in', 'ken_burns_right', 'ken_burns_left', 'zoom_out', 'ken_burns_right', 'zoom_in',
  ];

  // Word budget for the target duration
  const voiceLangForBudget = scriptLanguage === 'english' ? 'en-us' : 'hi';
  const speechRate = defaultConfig.voice.speechRate[voiceLangForBudget] || 2.5;
  const maxWords = Math.floor(targetDuration * speechRate * defaultConfig.voice.speed);

  // Consistency prefixes — character appearance + environment/setting
  const charPrefix = content.characterGuide
    ? `Characters in this scene: ${content.characterGuide}. `
    : '';
  const envPrefix = content.environmentGuide
    ? `Setting/environment: ${content.environmentGuide}. `
    : '';
  const consistencyPrefix = envPrefix + charPrefix;

  let runningWords = 0;
  let prevStoryShot: ShotDesign | undefined;

  // First pass: determine how many beats we'll include (for shot design decisions)
  let totalBeats = 0;
  {
    let tempWords = 0;
    for (let i = 0; i < content.keyPoints.length; i++) {
      const w = wordCount(content.keyPoints[i].detail);
      if (i >= 3 && tempWords + w > maxWords) break;
      tempWords += w;
      totalBeats++;
    }
  }

  for (let i = 0; i < content.keyPoints.length; i++) {
    const beat = content.keyPoints[i];
    const words = wordCount(beat.detail);

    // Stop adding beats if we'd exceed the word budget (but always include at least 3)
    if (i >= 3 && runningWords + words > maxWords) break;

    // Map dialogue from keyPoint if audioMode supports it
    const sceneDialogue = (audioMode === 'dialogue' || audioMode === 'both') && beat.dialogue?.length
      ? beat.dialogue.map((d) => ({ speaker: d.speaker, text: d.text }))
      : undefined;

    const dialogueWords = sceneDialogue
      ? sceneDialogue.reduce((sum, d) => sum + wordCount(d.text), 0)
      : 0;

    // Professional shot design based on scene position, content, and dialogue
    const sceneType: Scene['type'] = i === 0 ? 'hook' : (i === totalBeats - 1 ? 'cta' : 'key_point');
    const shot = designShot(sceneType, i, totalBeats, prevStoryShot, !!sceneDialogue?.length, beat.detail, beat.emotionalTone, audioMode);
    prevStoryShot = shot;

    scenes.push({
      id: `scene_${i}`,
      type: 'key_point',
      durationSeconds: 0,
      narration: audioMode === 'dialogue' ? '' : beat.detail,
      wordCount: audioMode === 'dialogue' ? dialogueWords : words + dialogueWords,
      brollPrompt: consistencyPrefix + buildStoryScenePrompt(beat.heading, beat.imagePrompt || beat.detail, content.title, toneToVisualStyle(beat.emotionalTone), beat.setting, shot),
      textOverlay: beat.heading,
      visualMotion: motions[i % motions.length],
      dialogue: sceneDialogue,
      shotDesign: shot,
    });
    runningWords += words;
  }

  // Fix up first/last scene types
  if (scenes.length > 0) {
    scenes[0] = { ...scenes[0], type: 'hook', id: 'opening' };
  }
  if (scenes.length > 1) {
    const last = scenes.length - 1;
    scenes[last] = { ...scenes[last], type: 'cta', id: 'ending' };
  }

  const fullNarration = scenes.map((s) => s.narration).join(' ');

  // Auto-select voice based on script language
  const voiceId = scriptLanguage === 'english' ? 'af_heart' : 'hf_alpha';
  const voiceLang = scriptLanguage === 'english' ? 'en-us' : 'hi';

  // In dialogue-only mode, narration is empty — estimate duration from dialogue words instead.
  // But always use targetDuration as a floor: clips provide the audio, and the user
  // explicitly selected the target length.
  const durationText = audioMode === 'dialogue'
    ? scenes.map((s) => s.dialogue ? s.dialogue.map((d) => d.text).join(' ') : '').join(' ')
    : fullNarration;
  const estimatedDuration = estimateAudioDuration(durationText, defaultConfig.voice.speed, voiceLang);
  const effectiveDuration = Math.max(estimatedDuration, targetDuration);
  const timedScenes = calculateSceneDurations(scenes, effectiveDuration);
  // Add cross-scene context for image continuity
  const contextualScenes = addCrossSceneContext(timedScenes);
  const totalDuration = contextualScenes.reduce((sum, s) => sum + s.durationSeconds, 0);

  // Extract unique character names from dialogue for voice mapping
  const characterNames = new Set<string>();
  for (const scene of contextualScenes) {
    if (scene.dialogue) {
      for (const line of scene.dialogue) {
        characterNames.add(line.speaker);
      }
    }
  }
  const characters = Array.from(characterNames).map((name) => ({
    name,
    voiceId: voiceId,
    voiceLang: voiceLang,
  }));

  return {
    scenes: contextualScenes,
    fullNarration,
    totalDurationSeconds: totalDuration,
    voiceId,
    voiceSpeed: defaultConfig.voice.speed,
    voiceLang,
    scriptLanguage,
    audioMode,
    characterGuide: content.characterGuide,
    environmentGuide: content.environmentGuide,
    characters: characters.length > 0 ? characters : undefined,
  };
}


function buildStoryScenePrompt(
  heading: string,
  narration: string,
  storyTitle: string,
  moodStyle: string,
  setting?: string,
  shot?: ShotDesign
): string {
  const context = narration.length > 120 ? narration.slice(0, 120) : narration;
  const settingClause = setting ? ` Location: ${setting}.` : '';
  const shotClause = shot ? ` ${shot.promptFragment}` : '';
  return `${shotClause} A cinematic, atmospheric illustration of this scene from a story: "${context}". Scene title: "${heading}" from the story "${storyTitle}".${settingClause} Visual mood: ${moodStyle}. Film-like composition, dramatic lighting, rich colors. Evocative and emotional. No text, no words, no letters, no watermarks`;
}
