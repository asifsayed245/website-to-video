import { GoogleGenAI } from '@google/genai';
import * as fs from 'node:fs';
import * as path from 'node:path';

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!_client) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY environment variable not set');
    _client = new GoogleGenAI({ apiKey: key });
  }
  return _client;
}

const GENERATED_DIR = path.join(process.cwd(), 'public', 'generated');

function ensureDir() {
  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }
}

/**
 * Generate an image using Gemini 3.1 Flash Image (Nano Banana 2).
 * Returns a local URL like /generated/hook-1710345678901.png
 * Includes retry with backoff for rate-limit (429) errors.
 */
export async function generateImage(
  prompt: string,
  sceneId: string,
  aspectRatio = '16:9'
): Promise<string> {
  const ai = getClient();
  const maxAttempts = 4;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: prompt,
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: aspectRatio as '16:9',
            imageSize: '1K',
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts;
      if (!parts || parts.length === 0) {
        throw new Error('Gemini returned no image data');
      }

      const imagePart = parts.find((p) => p.inlineData);
      if (!imagePart?.inlineData?.data) {
        throw new Error('Gemini response missing image bytes');
      }

      // Save base64 image to disk
      ensureDir();
      const filename = `${sceneId}-${Date.now()}.png`;
      const filePath = path.join(GENERATED_DIR, filename);
      const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
      fs.writeFileSync(filePath, buffer);

      return `/generated/${filename}`;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const lower = msg.toLowerCase();
      // Retry on rate limits, transient server errors, and resource exhaustion
      const isRetryable =
        msg.includes('429') ||
        msg.includes('500') ||
        msg.includes('503') ||
        lower.includes('rate') ||
        lower.includes('quota') ||
        lower.includes('resource_exhausted') ||
        lower.includes('internal') ||
        lower.includes('unavailable') ||
        lower.includes('overloaded');

      if (isRetryable && attempt < maxAttempts - 1) {
        const wait = (attempt + 1) * 3000; // 3s, 6s, 9s
        console.log(`Gemini error for ${sceneId} (attempt ${attempt + 1}/${maxAttempts}): ${msg}. Retrying in ${wait / 1000}s...`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      console.error(`Gemini image generation failed for ${sceneId} after ${attempt + 1} attempts: ${msg}`);
      throw err;
    }
  }

  throw new Error(`generateImage: exhausted ${maxAttempts} attempts for ${sceneId}`);
}
