import type { StructuredContent, KeyPoint } from './types';

/**
 * Parse a PDF buffer and extract structured content for video generation.
 * Follows the same output pattern as scraper.ts → StructuredContent.
 *
 * pdf-parse is loaded dynamically to avoid its test-file side effect at import time.
 */
export async function parsePDF(
  buffer: Buffer,
  filename: string
): Promise<StructuredContent> {
  // Require the inner module directly to skip pdf-parse's index.js wrapper
  // which tries to load test/data/05-versions-space.pdf at runtime
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse/lib/pdf-parse.js');
  const data: { text: string; numpages: number; info: Record<string, string> } = await pdfParse(buffer);
  const rawText: string = data.text || '';

  if (!rawText.trim()) {
    throw new Error('PDF contains no extractable text. It may be image-based or empty.');
  }

  // Split into paragraphs by double newlines or multiple whitespace lines
  const paragraphs = rawText
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 20);

  // Extract title: first short line, or filename without extension
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const title =
    lines.find((l) => l.length > 3 && l.length < 120) ||
    filename.replace(/\.pdf$/i, '');

  // Extract description: first substantial paragraph (not the title)
  const description =
    paragraphs.find((p) => p !== title && p.length > 40)?.slice(0, 250) || '';

  // Identify headings: short lines (<100 chars) that aren't just numbers
  // and are followed by longer content
  const headings: string[] = [];
  for (const line of lines) {
    if (
      line.length > 3 &&
      line.length < 100 &&
      !/^\d+(\.\d+)*\.?$/.test(line) && // not just numbering
      !headings.includes(line) &&
      line !== title
    ) {
      headings.push(line);
      if (headings.length >= 10) break;
    }
  }

  // Build key points from headings + following paragraphs
  const tones: KeyPoint['emotionalTone'][] = [
    'excitement', 'trust', 'confidence', 'curiosity', 'urgency',
  ];
  const keyPoints: KeyPoint[] = [];

  if (headings.length > 0) {
    for (let i = 0; i < Math.min(headings.length, 5); i++) {
      const heading = headings[i];
      // Find a paragraph that relates to this heading
      const related = paragraphs.find(
        (p) =>
          p.includes(heading) ||
          paragraphs.indexOf(p) === i
      );
      const detail = related
        ? related.replace(heading, '').trim().slice(0, 250)
        : paragraphs[i]?.slice(0, 250) || '';

      if (detail.length > 10) {
        keyPoints.push({
          heading: heading.slice(0, 60),
          detail,
          emotionalTone: tones[keyPoints.length % tones.length],
        });
      }
    }
  }

  // Fallback: if no heading-based points, use paragraphs directly
  if (keyPoints.length === 0) {
    for (let i = 0; i < Math.min(paragraphs.length, 4); i++) {
      const p = paragraphs[i];
      keyPoints.push({
        heading: p.slice(0, 50) + (p.length > 50 ? '...' : ''),
        detail: p.slice(0, 250),
        emotionalTone: tones[i % tones.length],
      });
    }
  }

  // Ensure at least 1 key point
  if (keyPoints.length === 0) {
    keyPoints.push({
      heading: title.slice(0, 50),
      detail: rawText.slice(0, 250),
      emotionalTone: 'curiosity',
    });
  }

  // Detect target audience from content (same heuristic as scraper.ts)
  const fullText = paragraphs.join(' ').toLowerCase();
  let targetAudience = 'general audience';
  if (fullText.includes('developer') || fullText.includes('api') || fullText.includes('code'))
    targetAudience = 'developers and technical professionals';
  else if (fullText.includes('business') || fullText.includes('enterprise') || fullText.includes('team'))
    targetAudience = 'business professionals and teams';
  else if (fullText.includes('creator') || fullText.includes('design') || fullText.includes('brand'))
    targetAudience = 'creators and designers';
  else if (fullText.includes('marketing') || fullText.includes('growth') || fullText.includes('customer'))
    targetAudience = 'marketers and growth professionals';

  // Use headings as themes
  const themes = headings.slice(0, 5);
  if (themes.length === 0 && keyPoints.length > 0) {
    themes.push(...keyPoints.map((kp) => kp.heading).slice(0, 3));
  }

  return {
    title,
    description,
    source: `pdf: ${filename}`,
    themes,
    keyPoints,
    targetAudience,
  };
}
