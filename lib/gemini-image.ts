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
      // If reference images exist, build multimodal contents with images + text prompt.
      // The prompt itself already describes how to use the images — don't add extra preamble.
      const contents = refParts.length > 0
        ? [...refParts, { text: prompt }]
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
 * Edit an existing image using Gemini's multimodal editing capability.
 *
 * Uses a multi-turn chat structure (per Google's official quickstart):
 * - Turn 1 (user): presents the image
 * - Turn 1 (model): acknowledges + includes image in response (establishes "ownership")
 * - Turn 2 (user): requests the specific edit
 *
 * IMPORTANT: No imageConfig constraints — forcing size/aspect during editing
 * causes the model to regenerate from scratch instead of editing in-place.
 */
export async function editImage(
  editInstruction: string,
  sourceImage: ReferenceImage,
  sceneId: string,
): Promise<string> {
  const ai = getClient();
  const maxAttempts = 4;

  // Convert source image to inline data part
  const match = sourceImage.dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error('Invalid source image data URL');
  const imagePart: Part = { inlineData: { mimeType: match[1], data: match[2] } };

  console.log(`[editImage] Starting edit for ${sceneId} | instruction: "${editInstruction}" | image size: ${match[2].length} bytes base64`);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Multi-turn chat structure following Google's official image editing quickstart.
      // The model's "previous response" includes the image as inlineData, which tells
      // the model it "owns" the image and should modify it rather than generate anew.
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Here is my current image. Remember every detail.' },
              imagePart,
            ],
          },
          {
            role: 'model',
            parts: [
              { text: 'I can see the image clearly. I have noted all the details — the subjects, composition, colors, lighting, and style. What changes would you like me to make?' },
              imagePart,
            ],
          },
          {
            role: 'user',
            parts: [
              { text: editInstruction },
            ],
          },
        ],
        config: {
          // TEXT+IMAGE required for editing per Gemini docs
          responseModalities: ['TEXT', 'IMAGE'],
          // NO imageConfig — do not force size/aspect ratio during editing.
          // Constraints cause the model to regenerate instead of editing.
        },
      });

      const url = extractImage(response, sceneId);
      if (!url) {
        // Log what the model actually returned
        const textParts = response.candidates?.[0]?.content?.parts?.filter((p) => p.text);
        console.warn(`[editImage] No image in response. Model text: ${textParts?.map((p) => p.text).join(' ') || '(empty)'}`);
        throw new Error('Gemini returned no image data for edit');
      }
      console.log(`[editImage] Success for ${sceneId}: ${url}`);
      return url;
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
        console.log(`[editImage] ${sceneId} attempt ${attempt + 1}/${maxAttempts}: ${msg}. Retrying in ${wait / 1000}s...`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      console.error(`[editImage] Failed for ${sceneId} after ${attempt + 1} attempts: ${msg}`);
      throw err;
    }
  }

  throw new Error(`editImage: exhausted ${maxAttempts} attempts for ${sceneId}`);
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

  // All reference images (character + environment) for per-frame reinforcement
  const allRefParts = refImagesToParts(referenceImages);
  const hasRefs = allRefParts.length > 0;

  try {
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

    // System message: short, direct, focused on the 3 things that matter most:
    // 1. Same character appearance  2. Same art style  3. Same spatial layout
    const systemMessage = [
      `You are generating ${tasks.length} storyboard frames for a video. One image per response.`,
      '',
      'RULES (follow these EXACTLY):',
      '- ALWAYS generate an image. Never respond with text only.',
      '- SAME CHARACTER in every frame: identical face, body, hair, skin, clothing. Never change the character.',
      '- SAME ART STYLE in every frame. Never switch between 2D/3D or change rendering style.',
      '- SAME SPATIAL LAYOUT: objects stay in the same relative positions. If something is on the left, it stays on the left.',
      '',
      storyContext,
      '',
      'STORY:',
      storyOutline,
    ].join('\n');

    const primeMessage = hasRefs
      ? [...allRefParts, { text: systemMessage + '\n\nThese reference images show EXACTLY how the character and environment should look. Copy them precisely in every frame.' }]
      : systemMessage;

    console.log(`[storyboard] Priming chat${hasRefs ? ` with ${allRefParts.length} reference images` : ''}...`);
    await withRetry(
      () => chat.sendMessage({ message: primeMessage }),
      'prime',
    );

    let chatFailed = false;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];

      if (chatFailed) break;

      try {
        // Keep per-frame prompt SHORT. The system message already has all context.
        // Only describe what's different: the action happening in this frame.
        const framePrompt = `FRAME ${i + 1}/${tasks.length}: ${task.prompt}. Same character, same style, same world.`;

        // Attach reference images on EVERY frame to prevent any character/style drift.
        // This is the single most effective technique for visual consistency.
        const frameMessage = hasRefs
          ? [...allRefParts, { text: framePrompt }]
          : framePrompt;

        console.log(`[storyboard] Generating frame ${i + 1}/${tasks.length} (${task.jobId})${hasRefs ? ' [+refs]' : ''}...`);

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
