import { NextResponse } from 'next/server';
import { scrapeWebsite } from '@/lib/scraper';
import { enrichScrapedContent } from '@/lib/gemini';

export async function POST(req: Request) {
  try {
    const { url, contentStyle, targetDuration, scriptLanguage, audioMode } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    let content = await scrapeWebsite(url);

    // Enrich thin content using Gemini — expands sparse websites to match target duration
    if (process.env.GEMINI_API_KEY) {
      try {
        content = await enrichScrapedContent(content, targetDuration || 60, contentStyle || 'business', scriptLanguage || 'english', audioMode || 'narration');
      } catch (err) {
        console.warn('[scrape] Gemini enrichment failed, using raw scraped content:', err);
      }
    }

    return NextResponse.json(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scraping failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
