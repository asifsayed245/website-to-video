import { NextResponse } from 'next/server';
import { generateScript } from '@/lib/script-generator';
import type { StructuredContent, ContentStyle, ScriptLanguage, AudioMode } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Support both old shape (just StructuredContent) and new shape ({ content, contentStyle })
    const content: StructuredContent = body.content || body;
    const contentStyle: ContentStyle = body.contentStyle || 'business';
    const targetDuration: number = body.targetDuration || 60;
    const scriptLanguage: ScriptLanguage = body.scriptLanguage || 'english';
    const audioMode: AudioMode = body.audioMode || 'narration';

    if (!content.title || !content.keyPoints) {
      return NextResponse.json(
        { error: 'Invalid content: title and keyPoints are required' },
        { status: 400 }
      );
    }

    const script = generateScript(content, contentStyle, targetDuration, scriptLanguage, audioMode);
    return NextResponse.json(script);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
