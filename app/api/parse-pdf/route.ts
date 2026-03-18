import { NextResponse } from 'next/server';
import { parsePDF } from '@/lib/pdf-parser';
import { enrichScrapedContent, extractPDFWithVision } from '@/lib/gemini';
import type { ContentStyle, ScriptLanguage, AudioMode, StructuredContent } from '@/lib/types';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const contentStyle = (formData.get('contentStyle') as ContentStyle) || 'business';
    const targetDuration = Number(formData.get('targetDuration')) || 60;
    const scriptLanguage = (formData.get('scriptLanguage') as ScriptLanguage) || 'english';
    const audioMode = (formData.get('audioMode') as AudioMode) || 'narration';

    if (!file) {
      return NextResponse.json({ error: 'No PDF file uploaded' }, { status: 400 });
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let content: StructuredContent;
    let usedVision = false;

    try {
      content = await parsePDF(buffer, file.name);
    } catch (err) {
      // Text extraction failed (likely image-based PDF) — fall back to Gemini Vision
      if (!process.env.GEMINI_API_KEY) throw err;
      console.log('[parse-pdf] Text extraction failed, falling back to Gemini Vision...');
      content = await extractPDFWithVision(buffer, file.name, targetDuration, contentStyle, scriptLanguage);
      usedVision = true;
    }

    // Enrich thin content using Gemini (skip if vision already produced full content)
    if (!usedVision && process.env.GEMINI_API_KEY) {
      try {
        content = await enrichScrapedContent(content, targetDuration, contentStyle, scriptLanguage, audioMode);
      } catch (err) {
        console.warn('[parse-pdf] Gemini enrichment failed, using raw parsed content:', err);
      }
    }

    return NextResponse.json(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF parsing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
