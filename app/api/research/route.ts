import { NextResponse } from 'next/server';
import { researchTopic, researchStory } from '@/lib/topic-researcher';
import { enrichScrapedContent } from '@/lib/gemini';
import type { StructuredContent } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const { topic, keywords, audience, tone, cta, contentStyle, targetDuration, scriptLanguage, audioMode, storyText } = await req.json();

    if (!topic || typeof topic !== 'string') {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    // Story mode: keywords are optional themes
    if (contentStyle === 'story') {
      const themes = Array.isArray(keywords) ? keywords.filter(Boolean) : [];

      // If user provided their own story text, use it directly instead of AI research
      if (storyText && typeof storyText === 'string' && storyText.trim()) {
        console.log(`[research] User provided story text (${storyText.trim().length} chars), enriching...`);
        const rawContent: StructuredContent = {
          title: topic,
          description: '',
          source: 'user-story',
          themes,
          keyPoints: [],
          targetAudience: audience || '',
          rawText: storyText.trim(),
        };
        const enriched = await enrichScrapedContent(rawContent, targetDuration, 'story', scriptLanguage, audioMode);
        return NextResponse.json(enriched);
      }

      const content = await researchStory(topic, themes, audience, targetDuration, scriptLanguage, audioMode);
      return NextResponse.json(content);
    }

    // Business mode: keywords required
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'At least one keyword is required' },
        { status: 400 }
      );
    }

    const content = await researchTopic(topic, keywords, audience, tone, cta, targetDuration, scriptLanguage);
    return NextResponse.json(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Research failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
