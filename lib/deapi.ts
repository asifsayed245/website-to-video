import { delay } from './utils';

const DEAPI_BASE = 'https://api.deapi.ai/api/v1/client';

function getHeaders(): HeadersInit {
  const key = process.env.DEAPI_API_KEY;
  if (!key) throw new Error('DEAPI_API_KEY environment variable not set');
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
      const waitTime = (attempt + 1) * 5000; // 5s, 10s, 15s
      console.log(`Rate limited (429). Waiting ${waitTime / 1000}s before retry ${attempt + 1}/${maxAttempts}...`);
      await delay(waitTime);
      continue;
    }

    return res;
  }

  throw new Error(`fetchWithRetry: exhausted ${maxAttempts} attempts`);
}

export async function submitAudioJob(
  text: string,
  voice = 'hf_alpha',
  speed = 1.0,
  lang = 'hi'
) {
  const res = await fetchWithRetry(`${DEAPI_BASE}/txt2audio`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      text,
      voice,
      model: 'Kokoro',
      lang,
      speed,
      format: 'mp3',
      sample_rate: 24000,
    }),
  });

  if (!res.ok) {
    const text = (await res.text()).slice(0, 500);
    throw new Error(`deAPI audio job failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  const requestId = json.data?.request_id ?? json.request_id;
  if (!requestId) throw new Error(`deAPI audio: no request_id in response: ${JSON.stringify(json)}`);
  return requestId as string;
}

export async function pollJobStatus(requestId: string): Promise<{
  status: 'processing' | 'done' | 'failed';
  resultUrl?: string;
  error?: string;
}> {
  const res = await fetchWithRetry(
    `${DEAPI_BASE}/request-status/${requestId}`,
    { headers: getHeaders() },
    2
  );

  if (!res.ok) {
    throw new Error(`deAPI poll failed: ${res.status}`);
  }

  const json = await res.json();
  const d = json.data ?? json;
  return {
    status: d.status,
    resultUrl: d.result_url,
    error: d.error,
  };
}

export async function downloadAsset(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download asset: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
