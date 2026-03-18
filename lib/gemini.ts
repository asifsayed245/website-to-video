import { GoogleGenerativeAI } from '@google/generative-ai';
import type { StructuredContent, KeyPoint, ContentStyle, ScriptLanguage, AudioMode } from './types';
import { defaultConfig } from './config';
import { wordCount } from './utils';

let _client: GoogleGenerativeAI | null = null;

function getClient() {
  if (!_client) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY environment variable not set');
    _client = new GoogleGenerativeAI(key);
  }
  return _client;
}

function getLanguageInstruction(lang?: ScriptLanguage): string {
  switch (lang) {
    case 'hindi':
      return '\n\nLANGUAGE INSTRUCTION: Write ALL narration text ("detail" fields) and "heading" fields in Hindi (Devanagari script). Use natural, conversational Hindi suitable for spoken narration. ALSO provide an "imagePrompt" field (in ENGLISH) for each key point — a vivid visual scene description that captures the narrative context for image generation.';
    case 'hinglish':
      return '\n\nLANGUAGE INSTRUCTION: Write ALL narration text ("detail" fields) and "heading" fields in Hinglish — Hindi written in Roman/Latin script with English words mixed in naturally, as spoken in everyday Indian conversation. ALSO provide an "imagePrompt" field (in ENGLISH) for each key point — a vivid visual scene description that captures the narrative context for image generation.';
    default:
      return '';
  }
}

function getImagePromptSchema(lang?: ScriptLanguage): string {
  if (lang === 'hindi' || lang === 'hinglish') {
    return '\n      "imagePrompt": "A vivid ENGLISH description of the visual scene for this point, capturing the context of the narration for image generation",';
  }
  return '';
}

function getDialogueSchema(audioMode?: AudioMode): string {
  if (audioMode === 'dialogue' || audioMode === 'both') {
    return `\n      "dialogue": [
        { "speaker": "Character Name", "text": "What the character says in this scene" }
      ],`;
  }
  return '';
}

function getDialogueInstruction(audioMode?: AudioMode): string {
  if (audioMode === 'dialogue') {
    return `\n\nDIALOGUE MODE: This video uses CHARACTER DIALOGUE instead of narration. For each scene beat:
- The "detail" field should contain STAGE DIRECTIONS describing what's happening visually (not spoken aloud)
- The "dialogue" array must contain 1-3 lines of spoken dialogue between named characters
- Each dialogue line should be natural, expressive, and advance the story
- Use 2-4 distinct characters throughout the story with consistent names`;
  }
  if (audioMode === 'both') {
    return `\n\nNARRATION + DIALOGUE MODE: This video combines narration with character dialogue. For each scene beat:
- The "detail" field is the NARRATOR's spoken text (the voiceover)
- The "dialogue" array contains character interjections — short spoken lines by named characters
- Balance narration with 1-2 dialogue lines per scene
- Use 2-4 distinct characters throughout the story with consistent names`;
  }
  return '';
}

export async function researchWithGemini(
  topic: string,
  keywords: string[],
  audience?: string,
  tone?: string,
  cta?: string,
  targetDuration?: number,
  scriptLanguage?: ScriptLanguage,
): Promise<StructuredContent> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const toneLabel = tone || 'professional';
  const targetAudience = audience || `professionals interested in ${topic}`;

  const durationSec = targetDuration || 60;
  const durationLabel = durationSec < 60 ? `${durationSec} seconds` : `${Math.round(durationSec / 60)} minute${durationSec > 60 ? 's' : ''}`;
  const keyPointRange = durationSec <= 30 ? '2 to 3'
    : durationSec <= 60 ? '3 to 5'
    : durationSec <= 120 ? '5 to 8'
    : '8 to 15';

  // Calculate target word count from speech rate config
  const lang = defaultConfig.voice.lang;
  const speechRate = defaultConfig.voice.speechRate[lang] || 2.5;
  const totalTargetWords = Math.round(durationSec * speechRate * defaultConfig.voice.speed);
  // Per-point word range: distribute across expected key points, accounting for hook + CTA overhead (~20 words)
  const midPointCount = durationSec <= 30 ? 3 : durationSec <= 60 ? 4 : durationSec <= 120 ? 7 : 12;
  const wordsPerPoint = Math.round((totalTargetWords - 20) / midPointCount);
  const minDetailWords = Math.max(10, wordsPerPoint - 5);
  const maxDetailWords = wordsPerPoint + 10;

  const prompt = `You are a content researcher creating a compelling video script outline about "${topic}".

Keywords to cover: ${keywords.join(', ')}
Target audience: ${targetAudience}
Tone: ${toneLabel}

Research this topic and create engaging content for a ${durationLabel} social media video. The TOTAL narration across all key points must be approximately ${totalTargetWords} words. Return a JSON object with EXACTLY this structure (no markdown, no code fences, just raw JSON):

{
  "title": "An engaging, specific title (not just the topic name)",
  "description": "A compelling one-line hook that grabs attention — a surprising fact, bold claim, or provocative question. Must be DIFFERENT from the key points below.",
  "themes": ["theme1", "theme2", "theme3"],
  "keyPoints": [
    {
      "heading": "Short punchy heading (3-6 words)",
      "detail": "1-3 spoken-style sentences with a specific fact or insight. Each detail MUST be ${minDetailWords}-${maxDetailWords} words.",${getImagePromptSchema(scriptLanguage)}
      "emotionalTone": "excitement"
    }
  ],
  "targetAudience": "${targetAudience}",
  "cta": { "text": "${cta || `Explore more about ${topic}`}" }
}${getLanguageInstruction(scriptLanguage)}

IMPORTANT RULES:
- emotionalTone must be one of: excitement, trust, confidence, curiosity, urgency
- Include ${keyPointRange} key points. Each point covers a distinct angle or fact.
- CRITICAL: Each key point detail MUST be ${minDetailWords}-${maxDetailWords} words. The total narration across ALL details must add up to approximately ${totalTargetWords} words. This is essential for matching the ${durationLabel} target duration.
- Write narration as spoken-aloud text — punchy, engaging, not an essay.
- Vary the emotionalTone across key points
- The description (hook) must be completely different content from any key point
- Make it genuinely interesting and informative — include real facts, trends, or statistics where possible
- Return ONLY valid JSON, no other text`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Strip markdown code fences if present
  const jsonStr = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(jsonStr);

  // Validate and normalize
  const validTones: KeyPoint['emotionalTone'][] = ['excitement', 'trust', 'confidence', 'curiosity', 'urgency'];

  const keyPoints: KeyPoint[] = (parsed.keyPoints || []).slice(0, 20).map((kp: Record<string, string>, i: number) => ({
    heading: kp.heading || `Point ${i + 1}`,
    detail: kp.detail || '',
    emotionalTone: validTones.includes(kp.emotionalTone as KeyPoint['emotionalTone'])
      ? kp.emotionalTone as KeyPoint['emotionalTone']
      : validTones[i % validTones.length],
    imagePrompt: kp.imagePrompt || undefined,
  }));

  // Ensure at least 2 key points
  while (keyPoints.length < 2) {
    keyPoints.push({
      heading: `More about ${topic}`,
      detail: `${topic} continues to evolve and create new opportunities.`,
      emotionalTone: validTones[keyPoints.length % validTones.length],
    });
  }

  return {
    title: parsed.title || topic,
    description: parsed.description || `Discover what makes ${topic} so important right now.`,
    source: `topic: ${topic}`,
    themes: parsed.themes || [topic, ...keywords.slice(0, 3)],
    keyPoints,
    targetAudience: parsed.targetAudience || targetAudience,
    cta: parsed.cta || { text: cta || `Learn more about ${topic}` },
  };
}

export async function researchStoryWithGemini(
  topic: string,
  themes: string[],
  audience?: string,
  targetDuration?: number,
  scriptLanguage?: ScriptLanguage,
  audioMode?: AudioMode,
): Promise<StructuredContent> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const targetAudience = audience || 'general audience';
  const themesHint = themes.length > 0 ? `\nThemes/moods to weave in: ${themes.join(', ')}` : '';

  const durationSec = targetDuration || 60;
  const durationLabel = durationSec < 60 ? `${durationSec} seconds` : `${Math.round(durationSec / 60)} minute${durationSec > 60 ? 's' : ''}`;
  const beatRange = durationSec <= 30 ? '3 to 4'
    : durationSec <= 60 ? '5 to 6'
    : durationSec <= 120 ? '6 to 10'
    : '10 to 18';

  // Calculate target word count from speech rate config
  const lang = defaultConfig.voice.lang;
  const speechRate = defaultConfig.voice.speechRate[lang] || 2.5;
  const totalTargetWords = Math.round(durationSec * speechRate * defaultConfig.voice.speed);
  // Per-beat word range
  const midBeatCount = durationSec <= 30 ? 4 : durationSec <= 60 ? 5 : durationSec <= 120 ? 8 : 14;
  const wordsPerBeat = Math.round(totalTargetWords / midBeatCount);
  const minBeatWords = Math.max(15, wordsPerBeat - 5);
  const maxBeatWords = wordsPerBeat + 10;

  const prompt = `You are a creative storyteller. Write a short, compelling story about "${topic}".${themesHint}
Target audience: ${targetAudience}

The story should be suitable for a ${durationLabel} narrated video. It must have a clear beginning, middle, and end.
The TOTAL narration across all scene beats must be approximately ${totalTargetWords} words.

Break the story into ${beatRange} scene beats. Each beat is one visual scene in the video.

Return a JSON object with EXACTLY this structure (no markdown, no code fences, just raw JSON):

{
  "title": "A captivating story title",
  "description": "One-line logline or hook for the story",
  "themes": ["theme1", "theme2", "theme3"],
  "characterGuide": "Detailed visual description of the main character(s) that appear across scenes. Include: gender, approximate age, hair color/style, skin tone, clothing, and any distinguishing features. Example: 'A young woman in her late 20s with long dark brown hair, warm olive skin, wearing a navy blue coat and red scarf.' Be specific enough that an image generator can reproduce the same character consistently across multiple images.",
  "environmentGuide": "Detailed visual description of the PRIMARY setting/world the story takes place in. Include: location type, time of day, season/weather, lighting quality, color palette, key recurring props and objects, architectural style, and atmosphere. Example: 'A cozy small-town bookshop with warm amber lighting, dark wooden shelves floor to ceiling, stained glass window casting colorful light, vintage brass reading lamps, stacks of old leather-bound books, hardwood floors with a faded Persian rug, autumn leaves visible through the window.' This setting should be the visual anchor for ALL scenes — even if a scene moves slightly, the same world and visual language should be maintained.",
  "keyPoints": [
    {
      "heading": "Short scene title (3-6 words, e.g. 'A Fateful Discovery')",
      "detail": "1-3 sentences of narration for this scene. Written in storytelling voice, vivid and engaging. MUST be ${minBeatWords}-${maxBeatWords} words.",
      "emotionalTone": "curiosity",${getImagePromptSchema(scriptLanguage)}${getDialogueSchema(audioMode)}
      "setting": "Specific location within the story world for this scene. Example: 'The back corner of the bookshop near the stained glass window' or 'The cobblestone alley just outside the bookshop door'. Must be consistent with the environmentGuide."
    }
  ],
  "targetAudience": "${targetAudience}"
}${getLanguageInstruction(scriptLanguage)}${getDialogueInstruction(audioMode)}

IMPORTANT RULES:
- emotionalTone must be one of: excitement, trust, confidence, curiosity, urgency
- CRITICAL: Each beat's detail MUST be ${minBeatWords}-${maxBeatWords} words. The total narration across ALL beats must add up to approximately ${totalTargetWords} words. This is essential for matching the ${durationLabel} target duration. Do NOT write less.
- The first beat should set the scene / introduce the situation (like a story hook)
- The last beat should provide resolution or a thought-provoking ending
- Each beat's detail is narration — write it to be SPOKEN ALOUD, not read
- Make the story vivid and visual — each scene should paint a mental picture
- Do NOT include a CTA — this is a narrative, not a sales pitch
- The characterGuide MUST describe specific visual appearance details so every scene image looks consistent
- The environmentGuide MUST describe the story's visual world in detail — this is the MOST IMPORTANT element for visual consistency. All scenes should feel like they belong in the same world.
- Each keyPoint MUST include a "setting" field describing the specific location WITHIN the story world. Scenes should use the SAME or closely related locations (e.g., different areas of the same house, different spots in the same park). Avoid jumping to completely unrelated locations.
- Return ONLY valid JSON, no other text`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  const jsonStr = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(jsonStr);

  const validTones: KeyPoint['emotionalTone'][] = ['excitement', 'trust', 'confidence', 'curiosity', 'urgency'];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const keyPoints: KeyPoint[] = (parsed.keyPoints || []).slice(0, 20).map((kp: any, i: number) => ({
    heading: kp.heading || `Scene ${i + 1}`,
    detail: kp.detail || '',
    emotionalTone: validTones.includes(kp.emotionalTone as KeyPoint['emotionalTone'])
      ? kp.emotionalTone as KeyPoint['emotionalTone']
      : validTones[i % validTones.length],
    setting: kp.setting || undefined,
    imagePrompt: kp.imagePrompt || undefined,
    dialogue: Array.isArray(kp.dialogue)
      ? kp.dialogue.map((d: { speaker?: string; text?: string }) => ({
          speaker: d.speaker || 'Character',
          text: d.text || '',
        })).filter((d: { text: string }) => d.text)
      : undefined,
  }));

  while (keyPoints.length < 3) {
    keyPoints.push({
      heading: `The story continues`,
      detail: `And so the tale of ${topic} unfolds further.`,
      emotionalTone: validTones[keyPoints.length % validTones.length],
    });
  }

  return {
    title: parsed.title || topic,
    description: parsed.description || `A story about ${topic}.`,
    source: `topic: ${topic}`,
    themes: parsed.themes || [topic, ...themes.slice(0, 3)],
    keyPoints,
    targetAudience: parsed.targetAudience || targetAudience,
    characterGuide: parsed.characterGuide || undefined,
    environmentGuide: parsed.environmentGuide || undefined,
  };
}

// ── Content Density Assessment & Enrichment ──

function assessContentDensity(keyPoints: KeyPoint[], targetDuration: number, scriptLanguage: ScriptLanguage = 'english') {
  const voiceLang = scriptLanguage === 'english' ? 'en-us' : 'hi';
  const speechRate = defaultConfig.voice.speechRate[voiceLang] || 2.5;
  const targetWords = Math.round(targetDuration * speechRate * defaultConfig.voice.speed);
  const totalWords = keyPoints.reduce((sum, kp) => sum + wordCount(kp.detail), 0);
  return { totalWords, targetWords, isThin: totalWords < targetWords * 0.85 };
}

/**
 * Enrich scraped content when it's too thin for the target duration.
 * Uses Gemini to expand the topic using its own knowledge while preserving original facts.
 * Returns original content unchanged if it's already dense enough.
 */
export async function enrichScrapedContent(
  content: StructuredContent,
  targetDuration: number = 60,
  contentStyle: ContentStyle = 'business',
  scriptLanguage: ScriptLanguage = 'english',
  audioMode: AudioMode = 'narration',
): Promise<StructuredContent> {
  const density = assessContentDensity(content.keyPoints, targetDuration, scriptLanguage);

  // Story mode: ALWAYS enrich — raw scraped content needs narrative transformation
  // (characterGuide, environmentGuide, cinematic beats) regardless of word count.
  // Business mode: only enrich if content is too thin for the target duration.
  if (contentStyle !== 'story' && !density.isThin) return content;

  console.log(`[enrichScrapedContent] Enriching (${contentStyle}, ${density.totalWords}w vs ${density.targetWords}w target, thin=${density.isThin})...`);

  const genAI = getClient();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const durationSec = targetDuration;
  const voiceLang = scriptLanguage === 'english' ? 'en-us' : 'hi';
  const speechRate = defaultConfig.voice.speechRate[voiceLang] || 2.5;
  const totalTargetWords = Math.round(durationSec * speechRate * defaultConfig.voice.speed);
  const durationLabel = durationSec < 60 ? `${durationSec} seconds` : `${Math.round(durationSec / 60)} minute${durationSec > 60 ? 's' : ''}`;

  const idealPointCount = durationSec <= 30 ? 3 : durationSec <= 60 ? 5 : durationSec <= 120 ? 7 : 12;
  const wordsPerPoint = Math.round(totalTargetWords / idealPointCount);
  const minWords = Math.max(15, wordsPerPoint - 5);
  const maxWords = wordsPerPoint + 10;

  const existingContent = content.keyPoints
    .map((kp, i) => `${i + 1}. "${kp.heading}": ${kp.detail}`)
    .join('\n');

  const validTones: KeyPoint['emotionalTone'][] = ['excitement', 'trust', 'confidence', 'curiosity', 'urgency'];

  if (contentStyle === 'story') {
    return enrichAsStory(model, content, existingContent, {
      durationLabel, totalTargetWords, idealPointCount, minWords, maxWords,
    }, scriptLanguage, audioMode);
  }

  const prompt = `You are a content researcher expanding thin website content into a compelling video script outline.

ORIGINAL WEBSITE CONTENT (from "${content.title}"):
Title: ${content.title}
Description: ${content.description}
Key points extracted:
${existingContent}
Themes: ${content.themes.join(', ')}

PROBLEM: This content is too thin for a ${durationLabel} video. It only has ~${density.totalWords} words of narration but needs ~${totalTargetWords} words.

YOUR TASK: Using the topic "${content.title}" and the existing content as a foundation, EXPAND and ENRICH this into a full video script outline. Use your knowledge to:
- Keep all factual claims from the original content
- Add context, examples, statistics, or insights relevant to "${content.title}"
- Flesh out each point with real, specific details
- Add additional points to reach exactly ${idealPointCount} total points

Return a JSON object with EXACTLY this structure (no markdown, no code fences, just raw JSON):

{
  "title": "${content.title}",
  "description": "A compelling one-line hook — a surprising fact, bold claim, or provocative question about ${content.title}. Must be DIFFERENT from the key points below.",
  "themes": ${JSON.stringify(content.themes.slice(0, 5))},
  "keyPoints": [
    {
      "heading": "Short punchy heading (3-6 words)",
      "detail": "1-3 spoken-style sentences with a specific fact or insight. MUST be ${minWords}-${maxWords} words.",${getImagePromptSchema(scriptLanguage)}
      "emotionalTone": "excitement"
    }
  ],
  "targetAudience": "${content.targetAudience}",
  "cta": ${JSON.stringify(content.cta || { text: `Learn more about ${content.title}` })}
}${getLanguageInstruction(scriptLanguage)}

CRITICAL RULES:
- emotionalTone must be one of: excitement, trust, confidence, curiosity, urgency
- You MUST produce exactly ${idealPointCount} key points
- Each key point detail MUST be ${minWords}-${maxWords} words. Count every word.
- Total narration across ALL details must be approximately ${totalTargetWords} words
- Write as spoken-aloud narration — punchy, engaging, not an essay
- Preserve the original content's facts but expand with your knowledge of "${content.title}"
- The description (hook) must be completely different from any key point
- Return ONLY valid JSON, no other text`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const jsonStr = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(jsonStr);

  const keyPoints: KeyPoint[] = (parsed.keyPoints || []).slice(0, 20).map((kp: Record<string, string>, i: number) => ({
    heading: kp.heading || `Point ${i + 1}`,
    detail: kp.detail || '',
    emotionalTone: validTones.includes(kp.emotionalTone as KeyPoint['emotionalTone'])
      ? kp.emotionalTone as KeyPoint['emotionalTone']
      : validTones[i % validTones.length],
    imagePrompt: kp.imagePrompt || undefined,
  }));

  while (keyPoints.length < 3) {
    keyPoints.push({
      heading: `More about ${content.title}`,
      detail: `${content.title} continues to evolve and create new opportunities in this space.`,
      emotionalTone: validTones[keyPoints.length % validTones.length],
    });
  }

  console.log(`[enrichScrapedContent] Enriched: ${keyPoints.reduce((s, kp) => s + wordCount(kp.detail), 0)} words across ${keyPoints.length} points`);

  return {
    ...content,
    title: parsed.title || content.title,
    description: parsed.description || content.description,
    keyPoints,
    themes: parsed.themes || content.themes,
  };
}

async function enrichAsStory(
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  content: StructuredContent,
  existingContent: string,
  targets: { durationLabel: string; totalTargetWords: number; idealPointCount: number; minWords: number; maxWords: number },
  scriptLanguage?: ScriptLanguage,
  audioMode?: AudioMode,
): Promise<StructuredContent> {
  const validTones: KeyPoint['emotionalTone'][] = ['excitement', 'trust', 'confidence', 'curiosity', 'urgency'];

  const prompt = `You are a creative storyteller. Transform thin website content into a compelling narrated story.

ORIGINAL WEBSITE CONTENT (from "${content.title}"):
${existingContent}
Themes: ${content.themes.join(', ')}

PROBLEM: This content is too thin for a ${targets.durationLabel} narrated video. It needs ~${targets.totalTargetWords} words of narration.

YOUR TASK: Using "${content.title}" as inspiration, create a vivid short story suitable for a ${targets.durationLabel} narrated video.

Return a JSON object with EXACTLY this structure (no markdown, no code fences, just raw JSON):

{
  "title": "A captivating story title related to ${content.title}",
  "description": "One-line logline or hook",
  "themes": ${JSON.stringify(content.themes.slice(0, 3))},
  "characterGuide": "Detailed visual description of the main character(s). Include: gender, age, hair, skin tone, clothing, distinguishing features. Be specific for image consistency.",
  "environmentGuide": "Detailed visual description of the PRIMARY setting. Include: location type, time of day, lighting, color palette, key props, atmosphere. This anchors ALL scenes visually.",
  "keyPoints": [
    {
      "heading": "Short scene title (3-6 words)",
      "detail": "1-3 sentences of narration. MUST be ${targets.minWords}-${targets.maxWords} words.",
      "emotionalTone": "curiosity",${getImagePromptSchema(scriptLanguage)}${getDialogueSchema(audioMode)}
      "setting": "Specific location within the story world"
    }
  ],
  "targetAudience": "${content.targetAudience}"
}${getLanguageInstruction(scriptLanguage)}${getDialogueInstruction(audioMode)}

CRITICAL RULES:
- emotionalTone must be one of: excitement, trust, confidence, curiosity, urgency
- You MUST produce exactly ${targets.idealPointCount} scene beats
- Each beat MUST be ${targets.minWords}-${targets.maxWords} words. Count every word.
- Total narration must be approximately ${targets.totalTargetWords} words
- Write as spoken-aloud narration — vivid, cinematic
- First beat: set the scene. Last beat: resolution or thought-provoking ending
- All scenes should use the SAME or closely related locations
- Return ONLY valid JSON, no other text`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const jsonStr = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(jsonStr);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const keyPoints: KeyPoint[] = (parsed.keyPoints || []).slice(0, 20).map((kp: any, i: number) => ({
    heading: kp.heading || `Scene ${i + 1}`,
    detail: kp.detail || '',
    emotionalTone: validTones.includes(kp.emotionalTone as KeyPoint['emotionalTone'])
      ? kp.emotionalTone as KeyPoint['emotionalTone']
      : validTones[i % validTones.length],
    setting: kp.setting || undefined,
    imagePrompt: kp.imagePrompt || undefined,
    dialogue: Array.isArray(kp.dialogue)
      ? kp.dialogue.map((d: { speaker?: string; text?: string }) => ({
          speaker: d.speaker || 'Character',
          text: d.text || '',
        })).filter((d: { text: string }) => d.text)
      : undefined,
  }));

  while (keyPoints.length < 3) {
    keyPoints.push({
      heading: 'The story continues',
      detail: `And so the tale of ${content.title} unfolds further, revealing new dimensions.`,
      emotionalTone: validTones[keyPoints.length % validTones.length],
    });
  }

  console.log(`[enrichAsStory] Enriched: ${keyPoints.reduce((s, kp) => s + wordCount(kp.detail), 0)} words across ${keyPoints.length} beats`);

  return {
    ...content,
    title: parsed.title || content.title,
    description: parsed.description || content.description,
    keyPoints,
    themes: parsed.themes || content.themes,
    characterGuide: parsed.characterGuide || undefined,
    environmentGuide: parsed.environmentGuide || undefined,
  };
}

/**
 * Extract content from an image-based / scanned PDF using Gemini Vision.
 * Sends the raw PDF as inline base64 data — Gemini 2.0 Flash reads it natively.
 * Returns fully structured content ready for the video pipeline (no extra enrichment needed).
 */
export async function extractPDFWithVision(
  pdfBuffer: Buffer,
  filename: string,
  targetDuration: number = 60,
  contentStyle: ContentStyle = 'business',
  scriptLanguage: ScriptLanguage = 'english',
): Promise<StructuredContent> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const durationSec = targetDuration;
  const lang = defaultConfig.voice.lang;
  const speechRate = defaultConfig.voice.speechRate[lang] || 2.5;
  const totalTargetWords = Math.round(durationSec * speechRate * defaultConfig.voice.speed);
  const durationLabel = durationSec < 60 ? `${durationSec} seconds` : `${Math.round(durationSec / 60)} minute${durationSec > 60 ? 's' : ''}`;

  const idealPointCount = durationSec <= 30 ? 3 : durationSec <= 60 ? 5 : durationSec <= 120 ? 7 : 12;
  const wordsPerPoint = Math.round(totalTargetWords / idealPointCount);
  const minWords = Math.max(15, wordsPerPoint - 5);
  const maxWords = wordsPerPoint + 10;

  const validTones: KeyPoint['emotionalTone'][] = ['excitement', 'trust', 'confidence', 'curiosity', 'urgency'];

  const isStory = contentStyle === 'story';

  const storyAddendum = isStory
    ? `\nCONTENT STYLE: Story / Narrative. Transform the PDF content into an engaging cinematic story with:
- A compelling narrative arc (setup → conflict → resolution)
- Vivid, descriptive language suitable for spoken narration
- Each key point should be a "scene beat" in the story
- Add "characterGuide" (visual description of main character/subject) and "environmentGuide" (visual description of setting/locations) fields to the JSON`
    : `\nCONTENT STYLE: Business / Informational. Extract key information and present it as a professional video script outline with clear, punchy narration.`;

  const prompt = `You are an expert content analyst. Read this PDF document carefully — it may contain scanned images, text, diagrams, or a mix of all.

YOUR TASK: Extract ALL meaningful content from this PDF and structure it as a video script outline for a ${durationLabel} video.${storyAddendum}

Return a JSON object with EXACTLY this structure (no markdown, no code fences, just raw JSON):

{
  "title": "Compelling title derived from the PDF content",
  "description": "A one-line hook — a surprising fact, bold claim, or provocative question from the content",
  "themes": ["theme1", "theme2", "theme3"],
  "keyPoints": [
    {
      "heading": "Short punchy heading (3-6 words)",
      "detail": "1-3 spoken-style sentences. MUST be ${minWords}-${maxWords} words.",${getImagePromptSchema(scriptLanguage)}
      "emotionalTone": "excitement"
    }
  ],
  "targetAudience": "who this content is best suited for"${isStory ? ',\n  "characterGuide": "Detailed visual description of the main character/subject for consistent image generation",\n  "environmentGuide": "Detailed visual description of the primary setting and locations"' : ''}
}${getLanguageInstruction(scriptLanguage)}

CRITICAL RULES:
- Read EVERY page of the PDF including any images, charts, or diagrams
- emotionalTone must be one of: excitement, trust, confidence, curiosity, urgency
- You MUST produce exactly ${idealPointCount} key points
- Each key point detail MUST be ${minWords}-${maxWords} words
- Total narration across ALL details must be approximately ${totalTargetWords} words
- Write as spoken-aloud narration — punchy, engaging, not an essay
- Return ONLY valid JSON, no other text`;

  console.log(`[extractPDFWithVision] Sending PDF "${filename}" (${(pdfBuffer.length / 1024).toFixed(0)}KB) to Gemini Vision...`);

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: pdfBuffer.toString('base64'),
      },
    },
    prompt,
  ]);

  const text = result.response.text().trim();
  const jsonStr = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(jsonStr);

  const keyPoints: KeyPoint[] = (parsed.keyPoints || []).slice(0, 20).map((kp: Record<string, string>, i: number) => ({
    heading: kp.heading || `Point ${i + 1}`,
    detail: kp.detail || '',
    emotionalTone: validTones.includes(kp.emotionalTone as KeyPoint['emotionalTone'])
      ? kp.emotionalTone as KeyPoint['emotionalTone']
      : validTones[i % validTones.length],
    imagePrompt: kp.imagePrompt || undefined,
  }));

  while (keyPoints.length < 3) {
    keyPoints.push({
      heading: `More from ${filename}`,
      detail: `This document reveals additional insights worth exploring further.`,
      emotionalTone: validTones[keyPoints.length % validTones.length],
    });
  }

  console.log(`[extractPDFWithVision] Extracted: ${keyPoints.reduce((s, kp) => s + wordCount(kp.detail), 0)} words across ${keyPoints.length} points`);

  return {
    title: parsed.title || filename.replace(/\.pdf$/i, ''),
    description: parsed.description || '',
    source: `pdf: ${filename}`,
    themes: parsed.themes || [],
    keyPoints,
    targetAudience: parsed.targetAudience || 'general audience',
    characterGuide: parsed.characterGuide || undefined,
    environmentGuide: parsed.environmentGuide || undefined,
  };
}
