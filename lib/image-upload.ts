import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Upload a local image to a public host so external APIs (like kie.ai) can access it.
 * Uses freeimage.host — free, reliable, URLs accessible by external services.
 *
 * @param localUrl - Local URL like "/generated/hook-123.png"
 * @returns Public URL like "https://iili.io/abc123.png"
 */
export async function uploadToPublicHost(localUrl: string): Promise<string> {
  // If already a full URL, return as-is
  if (localUrl.startsWith('http://') || localUrl.startsWith('https://')) {
    return localUrl;
  }

  // Resolve local path from public directory
  const filePath = path.join(process.cwd(), 'public', localUrl);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Local image not found: ${filePath}`);
  }

  const fileBuffer = fs.readFileSync(filePath);
  const filename = path.basename(filePath);
  const base64 = fileBuffer.toString('base64');

  // Upload to freeimage.host (free, no personal API key needed)
  const formData = new URLSearchParams();
  formData.append('source', base64);
  formData.append('type', 'base64');
  formData.append('action', 'upload');
  formData.append('format', 'json');

  const res = await fetch(
    'https://freeimage.host/api/1/upload?key=6d207e02198a847aa98d0a2a901485a5',
    { method: 'POST', body: formData }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Image upload failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  const publicUrl = json.image?.url;
  if (!publicUrl || !publicUrl.startsWith('http')) {
    throw new Error(`Unexpected upload response: ${JSON.stringify(json).slice(0, 200)}`);
  }

  console.log(`Uploaded ${filename} → ${publicUrl}`);
  return publicUrl;
}
