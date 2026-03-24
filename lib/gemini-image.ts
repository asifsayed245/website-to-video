import { GoogleGenAI, type Part } from '@google/genai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ReferenceImage } from '@/lib/types';

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

/** Convert reference images to Gemini inline data parts */
function refImagesToParts(refs?: ReferenceImage[]): Part[] {
  if (!refs?.length) return [];
  return refs.map((ref) => {
    // dataUrl format: data:image/png;base64,xxxxx
    const match = ref.dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return null;
    return {
      inlineData: {
        mimeType: match[1],
        data: match[2],
      },
    } as Part;
  }).filter(Boolean) as Part[];
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
  aspectRatio = '16:9',
  referenceImages?: ReferenceImage[],
): Promise<string> {
  const ai = getClient();
  const maxAttempts = 4;
  const refParts = refImagesToParts(referenceImages);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // If reference images exist, build multimodal contents with text + images
      const contents = refParts.length > 0
        ? [
            ...refParts,
            { text: `Use these reference images to guide the visual style and characters. Generate: ${prompt}` },
          ]
        : prompt;

      const response = await ai.models.generateContent({
        model: MODEL,
        contents,
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
  referenceImages?: ReferenceImage[],
): Promise<Map<string, string>> {
  const ai = getClient();
  const results = new Map<string, string>();

  if (tasks.length === 0) return results;

  console.log(`[storyboard] Starting multi-turn chat generation for ${tasks.length} images`);

  // Extract character/environment guide text from storyContext for per-frame reinforcement
  const charLine = storyContext.split('\n').find((l) => l.startsWith('Characters:'));
  const envLine = storyContext.split('\n').find((l) => l.startsWith('Environment:'));
  const styleLine = storyContext.split('\n').find((l) => l.startsWith('Visual style:'));

  // Separate character refs from environment refs for targeted reinforcement
  const charRefs = referenceImages?.filter((r) => r.type === 'character') || [];
  const envRefs = referenceImages?.filter((r) => r.type === 'environment') || [];

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
      '2. NEVER CHANGE THE ART STYLE between frames. Every single frame must use the EXACT SAME art style throughout.',
      `   ${styleLine || ''}`,
      '3. Maintain STRICT visual consistency across ALL frames:',
      '   - The SAME character must appear in every frame they are in — identical face, body type, hair, clothing, skin tone',
      '   - The environment must stay spatially consistent — if a tunnel entrance is next to a bed, it stays next to the bed in ALL frames',
      '   - Same lighting mood and color palette',
      '4. Story MUST progress — each frame shows a DIFFERENT moment in the narrative:',
      '   - Characters change position, action, and expression to match the story beat',
      '   - The setting may shift but spatial relationships between objects MUST remain consistent',
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

    // Include reference images in the priming message for visual consistency
    const refParts = refImagesToParts(referenceImages);
    const primeMessage = refParts.length > 0
      ? [...refParts, { text: systemMessage + '\n\nThe images above are reference images for character appearance and environment style. The character in these reference images MUST appear in every frame — match their face, body, hair, and clothing EXACTLY.' }]
      : systemMessage;

    console.log(`[storyboard] Priming chat with story context + outline${refParts.length > 0 ? ` + ${refParts.length} reference images` : ''}...`);
    await withRetry(
      () => chat.sendMessage({ message: primeMessage }),
      'prime',
    );

    // Generate each image sequentially within the chat
    let chatFailed = false;

    // Re-inject character reference images every N frames to prevent attention decay
    const REINFORCE_INTERVAL = 3;
    const charRefParts = refImagesToParts(charRefs);

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];

      if (chatFailed) break;

      try {
        // Build per-frame reinforcement of character + environment + style
        const reinforcement: string[] = [];
        if (charLine) reinforcement.push(`REMEMBER — ${charLine}`);
        if (envLine) reinforcement.push(`REMEMBER — ${envLine}`);
        if (styleLine) reinforcement.push(`SAME ART STYLE — ${styleLine}`);

        const framePrompt = [
          `FRAME ${i + 1} of ${tasks.length}:`,
          task.prompt,
          '',
          ...reinforcement,
          '',
          'Generate this image now. The character MUST look identical to the reference and all previous frames. Keep the EXACT SAME art style. Show the story progression described above.',
        ].join('\n');

        // Re-inject reference images periodically to combat attention decay
        const shouldReinforceWithImages = charRefParts.length > 0 && i > 0 && i % REINFORCE_INTERVAL === 0;
        const frameMessage = shouldReinforceWithImages
          ? [...charRefParts, { text: `(Reference images re-attached for consistency.)\n\n${framePrompt}` }]
          : framePrompt;

        console.log(`[storyboard] Generating frame ${i + 1}/${tasks.length} (${task.jobId})${shouldReinforceWithImages ? ' [+ref images]' : ''}...`);

        // Attempt to get an image — retry with nudge if model returns text-only
        let url: string | null = null;

        const response = await withRetry(
          () => chat.sendMessage({ message: frameMessage }),
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
          const url = await generateImage(task.prompt, task.jobId, aspectRatio, referenceImages);
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
        const url = await generateImage(task.prompt, task.jobId, aspectRatio, referenceImages);
        results.set(task.jobId, url);
      } catch (fallbackErr) {
        console.error(`[storyboard] Fallback failed for ${task.jobId}:`, fallbackErr instanceof Error ? fallbackErr.message : fallbackErr);
      }
    }
  }

  console.log(`[storyboard] Complete: ${results.size}/${tasks.length} images generated`);
  return results;
}
