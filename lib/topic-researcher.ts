import type { StructuredContent, KeyPoint, ScriptLanguage, AudioMode } from './types';
import { researchWithGemini, researchStoryWithGemini } from './gemini';

/**
 * Research a topic using Gemini AI, with template fallback if API is unavailable.
 */
export async function researchTopic(
  topic: string,
  keywords: string[],
  audience?: string,
  tone?: string,
  cta?: string,
  targetDuration?: number,
  scriptLanguage?: ScriptLanguage,
): Promise<StructuredContent> {
  // Try Gemini first
  if (process.env.GEMINI_API_KEY) {
    try {
      return await researchWithGemini(topic, keywords, audience, tone, cta, targetDuration, scriptLanguage);
    } catch (err) {
      console.warn('Gemini research failed, falling back to templates:', err);
    }
  }

  // Fallback: template-based generation
  return templateResearch(topic, keywords, audience, tone, cta);
}

function templateResearch(
  topic: string,
  keywords: string[],
  audience?: string,
  tone?: string,
  cta?: string
): StructuredContent {
  const tones: KeyPoint['emotionalTone'][] = [
    'excitement', 'curiosity', 'trust', 'confidence', 'urgency',
  ];

  const keyPoints: KeyPoint[] = keywords.slice(0, 4).map((keyword, i) => ({
    heading: capitalizeFirst(keyword),
    detail: `Key insight about ${keyword} in the context of ${topic}. This is a critical aspect that the audience needs to understand.`,
    emotionalTone: tones[i % tones.length],
  }));

  if (keyPoints.length < 3) {
    const extras = [
      { heading: `Why ${topic} Matters`, detail: `Understanding ${topic} is essential for staying ahead in today's landscape.` },
      { heading: `The Future of ${topic}`, detail: `Emerging trends in ${topic} are reshaping how we think about this space.` },
      { heading: `Getting Started with ${topic}`, detail: `Practical steps to begin your journey with ${topic} today.` },
    ];
    while (keyPoints.length < 3) {
      const extra = extras[keyPoints.length];
      keyPoints.push({
        heading: extra.heading,
        detail: extra.detail,
        emotionalTone: tones[keyPoints.length % tones.length],
      });
    }
  }

  const toneLabel = tone || 'professional';
  const targetAudience = audience || `professionals interested in ${topic}`;

  return {
    title: topic,
    description: `A ${toneLabel} exploration of ${topic}, covering ${keywords.join(', ')}.`,
    source: `topic: ${topic}`,
    themes: [topic, ...keywords.slice(0, 4)],
    keyPoints,
    targetAudience,
    cta: cta ? { text: cta } : { text: `Learn more about ${topic}` },
  };
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Research a topic as a short story using Gemini AI, with template fallback.
 */
export async function researchStory(
  topic: string,
  themes: string[],
  audience?: string,
  targetDuration?: number,
  scriptLanguage?: ScriptLanguage,
  audioMode?: AudioMode,
): Promise<StructuredContent> {
  if (process.env.GEMINI_API_KEY) {
    try {
      return await researchStoryWithGemini(topic, themes, audience, targetDuration, scriptLanguage, audioMode);
    } catch (err) {
      console.warn('Gemini story research failed, falling back to templates:', err);
    }
  }

  return templateStoryResearch(topic, themes, audience);
}

function templateStoryResearch(
  topic: string,
  themes: string[],
  audience?: string,
): StructuredContent {
  const tones: KeyPoint['emotionalTone'][] = ['curiosity', 'excitement', 'trust', 'confidence'];

  const keyPoints: KeyPoint[] = [
    {
      heading: 'The Beginning',
      detail: `In a world shaped by ${topic}, something unexpected was about to happen.`,
      emotionalTone: 'curiosity',
      setting: 'A quiet village at the edge of a vast forest, early morning light filtering through the trees',
    },
    {
      heading: 'The Challenge',
      detail: `Everything changed when a new obstacle emerged. The path forward seemed uncertain.`,
      emotionalTone: 'urgency',
      setting: 'A winding forest path leading to a dark cave entrance, storm clouds gathering overhead',
    },
    {
      heading: 'The Turning Point',
      detail: `But then, a breakthrough. What seemed impossible suddenly became real.`,
      emotionalTone: 'excitement',
      setting: 'Inside the cave, a hidden chamber glowing with warm golden light',
    },
    {
      heading: 'A New Dawn',
      detail: `And so the story of ${topic} took on a whole new meaning. The journey continues.`,
      emotionalTone: 'confidence',
      setting: 'The village again, now bathed in warm sunset light, the forest visible in the background',
    },
  ];

  return {
    title: `The Story of ${topic}`,
    description: `A short narrative exploring ${topic} through a storytelling lens.`,
    source: `topic: ${topic}`,
    themes: [topic, ...themes.slice(0, 3)],
    keyPoints,
    targetAudience: audience || 'general audience',
    environmentGuide: `A small rustic village nestled at the edge of an ancient forest. Cobblestone paths, wooden cottages with thatched roofs, warm lantern light. The forest has tall oak and pine trees, dappled sunlight, moss-covered rocks, and a winding path leading deeper in. The color palette is earthy greens, warm browns, and soft golden light.`,
  };
}
