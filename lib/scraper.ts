import * as cheerio from 'cheerio';
import type { StructuredContent, KeyPoint } from './types';

export async function scrapeWebsite(url: string): Promise<StructuredContent> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // Remove scripts, styles, nav, footer
  $('script, style, nav, footer, header, iframe, noscript').remove();

  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('title').text().trim() ||
    $('h1').first().text().trim() ||
    'Untitled';

  const description =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    '';

  // Extract headings as themes
  const headings: string[] = [];
  $('h1, h2, h3').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 100) headings.push(text);
  });

  // Extract paragraphs
  const paragraphs: string[] = [];
  $('p').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 30) paragraphs.push(text);
  });

  // Extract list items (often feature lists)
  const listItems: string[] = [];
  $('li').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 10 && text.length < 200) listItems.push(text);
  });

  // Build key points from headings + their following content
  const keyPoints: KeyPoint[] = [];
  const tones: KeyPoint['emotionalTone'][] = [
    'excitement',
    'trust',
    'confidence',
    'curiosity',
    'urgency',
  ];

  const sections = headings.slice(0, 5);
  for (let i = 0; i < Math.min(sections.length, 4); i++) {
    const heading = sections[i];
    // Find related paragraph
    const relatedParagraph = paragraphs[i] || listItems[i] || '';
    keyPoints.push({
      heading,
      detail: relatedParagraph.slice(0, 200),
      emotionalTone: tones[i % tones.length],
    });
  }

  // If no key points from headings, use paragraphs
  if (keyPoints.length === 0 && paragraphs.length > 0) {
    for (let i = 0; i < Math.min(paragraphs.length, 3); i++) {
      const p = paragraphs[i];
      keyPoints.push({
        heading: p.slice(0, 50) + (p.length > 50 ? '...' : ''),
        detail: p.slice(0, 200),
        emotionalTone: tones[i % tones.length],
      });
    }
  }

  // Detect CTA
  let ctaText = '';
  let ctaUrl = '';
  $('a').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    if (
      !ctaText &&
      (text.includes('sign up') ||
        text.includes('get started') ||
        text.includes('try') ||
        text.includes('start') ||
        text.includes('contact') ||
        text.includes('buy') ||
        text.includes('learn more'))
    ) {
      ctaText = $(el).text().trim();
      ctaUrl = $(el).attr('href') || '';
    }
  });

  // Deduce target audience from content
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

  return {
    title,
    description: description || paragraphs[0]?.slice(0, 200) || '',
    source: url,
    themes: headings.slice(0, 5),
    keyPoints,
    targetAudience,
    cta: ctaText ? { text: ctaText, url: ctaUrl } : undefined,
  };
}
