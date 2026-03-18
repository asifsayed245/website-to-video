import { delay } from './utils';
import type { KieModel, ClipResolution } from './types';

const KIE_BASE = 'https://api.kie.ai/api/v1';

function getHeaders(): HeadersInit {
  const key = process.env.KIE_API_KEY;
  if (!key) throw new Error('KIE_API_KEY environment variable not set');
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxAttempts = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(url, options);

    if (res.status === 429 && attempt < maxAttempts - 1) {
      const waitTime = (attempt + 1) * 5000;
      console.log(`kie.ai rate limited (429). Waiting ${waitTime / 1000}s before retry ${attempt + 1}/${maxAttempts}...`);
      await delay(waitTime);
      continue;
    }

    return res;
  }

  throw new Error(`fetchWithRetry: exhausted ${maxAttempts} attempts`);
}

export interface KieJobOptions {
  imageUrl: string;
  prompt: string;
  model?: KieModel;
  duration?: string;
  resolution?: ClipResolution;
  enableSound?: boolean;
  dialogueText?: string;
}

/**
 * Build model-specific input payload.
 * Each model on kie.ai has slightly different parameter names.
 */
function buildInputPayload(opts: KieJobOptions): Record<string, unknown> {
  const { imageUrl, prompt, model = 'kling-2.6/image-to-video', duration = '5', resolution, enableSound, dialogueText } = opts;

  // Append dialogue to prompt if provided
  const finalPrompt = dialogueText
    ? `${prompt}. Character dialogue: ${dialogueText}`
    : prompt;

  switch (model) {
    case 'kling-3.0/video':
      return {
        prompt: finalPrompt,
        image_urls: [imageUrl],
        sound: enableSound ?? false,
        duration,
        mode: resolution === '1080p' ? 'pro' : 'std',
      };

    case 'wan/2-6-flash-image-to-video':
      return {
        prompt: finalPrompt,
        image_urls: [imageUrl],
        audio: enableSound ?? false,
        duration,
        resolution: resolution || '720p',
      };

    case 'bytedance/seedance-1.5-pro':
      return {
        prompt: finalPrompt,
        input_urls: [imageUrl],
        generate_audio: enableSound ?? false,
        duration: parseInt(duration) || 4,
        resolution: resolution || '720p',
      };

    case 'hailuo/02-image-to-video-pro':
      return {
        prompt: finalPrompt,
        image_urls: [imageUrl],
        prompt_optimizer: false,
      };

    case 'sora-2-pro-image-to-video':
      return {
        prompt: finalPrompt,
        image_urls: [imageUrl],
        watermark_removal: true,
      };

    case 'kling-2.6/image-to-video':
    default:
      return {
        prompt: finalPrompt,
        image_urls: [imageUrl],
        sound: enableSound ?? false,
        duration,
        mode: resolution === '1080p' ? 'pro' : 'std',
      };
  }
}

/**
 * Submit an image-to-video job to kie.ai.
 * Returns a taskId for polling.
 */
export async function submitImageToVideoJob(opts: KieJobOptions): Promise<string>;
export async function submitImageToVideoJob(
  imageUrlOrOpts: string | KieJobOptions,
  prompt?: string,
  duration?: string,
  model?: string
): Promise<string> {
  // Support both old positional args and new options object
  const opts: KieJobOptions = typeof imageUrlOrOpts === 'string'
    ? { imageUrl: imageUrlOrOpts, prompt: prompt!, model: (model as KieModel) || 'kling-2.6/image-to-video', duration: duration || '5' }
    : imageUrlOrOpts;

  const payload = buildInputPayload(opts);

  const res = await fetchWithRetry(`${KIE_BASE}/jobs/createTask`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      model: opts.model || 'kling-2.6/image-to-video',
      input: payload,
    }),
  });

  if (!res.ok) {
    const text = (await res.text()).slice(0, 500);
    console.error(`kie.ai submit failed [${res.status}]:`, text);
    console.error('kie.ai request model:', opts.model || 'kling-2.6/image-to-video');
    throw new Error(`kie.ai image-to-video job failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  const taskId = json.data?.taskId;
  if (!taskId) throw new Error(`kie.ai: no taskId in response: ${JSON.stringify(json)}`);
  return taskId as string;
}

/**
 * Poll a kie.ai task for completion.
 * States: waiting | queuing | generating | success | fail
 */
export async function pollTaskStatus(taskId: string): Promise<{
  status: 'processing' | 'done' | 'failed';
  resultUrls?: string[];
  error?: string;
}> {
  const res = await fetchWithRetry(
    `${KIE_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    { headers: getHeaders() },
    2
  );

  if (!res.ok) {
    throw new Error(`kie.ai poll failed: ${res.status}`);
  }

  const json = await res.json();
  const d = json.data ?? json;

  // Map kie.ai states to our internal status
  const stateMap: Record<string, 'processing' | 'done' | 'failed'> = {
    waiting: 'processing',
    queuing: 'processing',
    generating: 'processing',
    success: 'done',
    fail: 'failed',
  };

  const status = stateMap[d.state?.toLowerCase()] ?? 'processing';

  if (status === 'failed') {
    console.error('kie.ai job failed. Full response data:', JSON.stringify(d, null, 2));
  }

  // Parse resultJson if available
  let resultUrls: string[] | undefined;
  if (status === 'done' && d.resultJson) {
    try {
      const parsed = typeof d.resultJson === 'string' ? JSON.parse(d.resultJson) : d.resultJson;
      resultUrls = parsed.resultUrls || [];
    } catch {
      console.warn('Failed to parse kie.ai resultJson:', d.resultJson);
    }
  }

  return {
    status,
    resultUrls,
    error: d.failMsg || d.failCode || undefined,
  };
}

/**
 * Check if kie.ai API key is configured.
 */
export function isKieConfigured(): boolean {
  return !!process.env.KIE_API_KEY;
}
