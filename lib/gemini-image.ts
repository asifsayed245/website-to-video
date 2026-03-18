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

const MODEL = 'gemini-3.1-flash-image-preview';
const GENERATED_DIR = path.join(process.cwd(), 'public', 'generated');

function ensureDir() {
  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }
}

/** Extract and save the first image from a Gemini response. Returns local URL or null. */
function extractImage(response: Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>, jobId: string): string | null {
  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) return null;
  const imagePart = parts.find((p) => p.inlineData);
  if (!imagePart?.inlineData?.data) return null;

  ensureDir();
  const filename = `${jobId}-${Date.now()}.png`;
  const filePath = path.join(GENERATED_DIR, filename);
  const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
  fs.writeFileSync(filePath, buffer);
  return `/generated/${filename}`;
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
        model: MODEL,
        contents: prompt,
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: aspectRatio as '16:9',
            imageSize: '1K',
          },
        },
      });

      const url = extractImage(response, sceneId);
      if (!url) throw new Error('Gemini returned no image data');
      return url;
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

/**
 * Retry helper: retries a function on retryable Gemini errors with backoff.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 4,
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const lower = msg.toLowerCase();
      const isRetryable =
        msg.includes('429') || msg.includes('500') || msg.includes('503') ||
        lower.includes('rate') || lower.includes('quota') ||
        lower.includes('resource_exhausted') || lower.includes('internal') ||
        lower.includes('unavailable') || lower.includes('overloaded');

      if (isRetryable && attempt < maxAttempts - 1) {
        const wait = (attempt + 1) * 3000;
        console.log(`[storyboard] ${label} attempt ${attempt + 1}/${maxAttempts}: ${msg}. Retrying in ${wait / 1000}s...`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`withRetry: exhausted ${maxAttempts} attempts for ${label}`);
}

export interface StoryboardTask {
  jobId: string;
  sceneId: string;
  prompt: string;
}

/** Max attempts to nudge the model when it returns text-only (no image). */
const IMAGE_NUDGE_ATTEMPTS = 2;

/**
 * Generate a sequence of storyboard images using Gemini's multi-turn chat API.
 * Each image is generated within a single chat session so the model can see
 * its previous outputs and maintain visual consistency (character appearance,
 * environment details, story progression).
 *
 * The prompts passed in already contain all cinematography hints (shot design,
 * sub-shot variation, composition, narration focus, style suffix, etc.).
 * This function only changes HOW they're sent to Gemini (chat vs independent).
 *
 * @param storyOutline - A numbered scene-by-scene summary of the full story arc.
 *   Included in the system prompt so the model understands the complete narrative
 *   and can position each frame correctly within the progression.
 *
 * Returns a Map of jobId → local URL (/generated/...).
 * Falls back to independent generateImage() for any images that fail in chat.
 */
export async function generateStoryboard(
  tasks: StoryboardTask[],
  storyContext: string,
  storyOutline: string,
  aspectRatio = '16:9',
): Promise<Map<string, string>> {
  const ai = getClient();
  const results = new Map<string, string>();

  if (tasks.length === 0) return results;

  console.log(`[storyboard] Starting multi-turn chat generation for ${tasks.length} images`);

  try {
    // Create a chat session with TEXT+IMAGE modalities.
    // TEXT is required alongside IMAGE for multi-turn to work — the model uses
    // text reasoning to maintain consistency across turns.
    const chat = ai.chats.create({
      model: MODEL,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: aspectRatio as '16:9',
          imageSize: '1K',
        },
      },
    });

    // Prime the chat with the story world + full story outline
    const systemMessage = [
      'You are a storyboard artist creating a sequence of images for a video.',
      `You will generate exactly ${tasks.length} frames, one at a time.`,
      '',
      'CRITICAL RULES:',
      '1. EVERY response MUST include a generated image. Never respond with only text.',
      '2. Maintain STRICT visual consistency across ALL frames:',
      '   - Same character designs, clothing, proportions, facial features, and colors',
      '   - Same environment style, lighting mood, and color palette',
      '3. Story MUST progress — each frame shows a DIFFERENT moment in the narrative:',
      '   - Characters change position, action, and expression to match the story beat',
      '   - The setting may shift (e.g., from starting line to forest path to finish line)',
      '   - Never repeat or regress to an earlier story moment',
      '',
      'STORY WORLD:',
      storyContext,
      '',
      'FULL STORY ARC (so you understand the complete narrative):',
      storyOutline,
      '',
      'I will now describe each frame. Generate an image for each one and briefly note what you drew.',
    ].join('\n');

    console.log('[storyboard] Priming chat with story context + outline...');
    await withRetry(
      () => chat.sendMessage({ message: systemMessage }),
      'prime',
    );

    // Generate each image sequentially within the chat
    let chatFailed = false;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];

      if (chatFailed) break;

      try {
        const framePrompt = [
          `FRAME ${i + 1} of ${tasks.length}:`,
          task.prompt,
          '',
          'Generate this image now. Keep characters visually identical to previous frames but show the story progression described above.',
        ].join('\n');

        console.log(`[storyboard] Generating frame ${i + 1}/${tasks.length} (${task.jobId})...`);

        // Attempt to get an image — retry with nudge if model returns text-only
        let url: string | null = null;

        const response = await withRetry(
          () => chat.sendMessage({ message: framePrompt }),
          task.jobId,
        );
        url = extractImage(response, task.jobId);

        // If model returned text-only, nudge it to actually generate the image
        if (!url) {
          for (let nudge = 0; nudge < IMAGE_NUDGE_ATTEMPTS; nudge++) {
            console.log(`[storyboard] Frame ${i + 1} returned text-only, nudging (attempt ${nudge + 1}/${IMAGE_NUDGE_ATTEMPTS})...`);
            await new Promise((r) => setTimeout(r, 1000));
            const nudgeResponse = await withRetry(
              () => chat.sendMessage({
                message: 'You did not generate an image. Please generate the image for the frame described above. You MUST output an image.',
              }),
              `${task.jobId}-nudge-${nudge}`,
            );
            url = extractImage(nudgeResponse, task.jobId);
            if (url) break;
          }
        }

        if (url) {
          results.set(task.jobId, url);
          console.log(`[storyboard] Frame ${i + 1} done: ${url}`);
        } else {
          console.warn(`[storyboard] Frame ${i + 1} still no image after nudges, will fall back`);
        }

        // Brief delay between frames to respect rate limits
        if (i < tasks.length - 1) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[storyboard] Chat failed at frame ${i + 1}: ${msg}`);
        chatFailed = true;
      }
    }

    // Fall back to independent generation for any missing images
    const missing = tasks.filter((t) => !results.has(t.jobId));
    if (missing.length > 0) {
      console.log(`[storyboard] Falling back to independent generation for ${missing.length} remaining images`);
      for (const task of missing) {
        try {
          const url = await generateImage(task.prompt, task.jobId, aspectRatio);
          results.set(task.jobId, url);
        } catch (err) {
          console.error(`[storyboard] Fallback also failed for ${task.jobId}:`, err instanceof Error ? err.message : err);
        }
      }
    }
  } catch (err) {
    // Chat creation or priming failed — fall back entirely to independent generation
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[storyboard] Chat session failed: ${msg}. Falling back to independent generation.`);

    for (const task of tasks) {
      if (results.has(task.jobId)) continue;
      try {
        const url = await generateImage(task.prompt, task.jobId, aspectRatio);
        results.set(task.jobId, url);
      } catch (fallbackErr) {
        console.error(`[storyboard] Fallback failed for ${task.jobId}:`, fallbackErr instanceof Error ? fallbackErr.message : fallbackErr);
      }
    }
  }

  console.log(`[storyboard] Complete: ${results.size}/${tasks.length} images generated`);
  return results;
}
