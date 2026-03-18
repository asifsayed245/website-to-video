import { NextResponse } from 'next/server';
import { researchTopic, researchStory } from '@/lib/topic-researcher';

export async function POST(req: Request) {
  try {
    const { topic, keywords, audience, tone, cta, contentStyle, targetDuration, scriptLanguage, audioMode } = await req.json();

    if (!topic || typeof topic !== 'string') {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    // Story mode: keywords are optional themes
    if (contentStyle === 'story') {
      const themes = Array.isArray(keywords) ? keywords.filter(Boolean) : [];
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
