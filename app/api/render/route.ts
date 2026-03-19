import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { PLATFORMS } from '@/lib/types';
import type { VideoFormat, Scene, AudioMode } from '@/lib/types';
import { defaultConfig } from '@/lib/config';

const execAsync = promisify(exec);

const FORMAT_KEYS = Object.keys(PLATFORMS) as VideoFormat[];

const COMPOSITION_IDS: Record<VideoFormat, string> = {
  reel: 'Reel',
  linkedin: 'LinkedIn',
  square: 'Square',
};

async function downloadToLocal(
  remoteUrl: string,
  filename: string,
  generatedDir: string,
  origin: string,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
  try {
    const res = await fetch(remoteUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) throw new Error('Downloaded file is empty');
    const filePath = path.join(generatedDir, filename);
    fs.writeFileSync(filePath, buffer);
    console.log(`[render] Downloaded ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
    // Return absolute URL — Remotion resolves relative URLs against its own
    // temp webpack bundle, not the project's public/ directory
    return `${origin}/generated/${filename}`;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/** Download with retry (2 attempts) */
async function downloadWithRetry(
  remoteUrl: string,
  filename: string,
  generatedDir: string,
  origin: string,
): Promise<string> {
  try {
    return await downloadToLocal(remoteUrl, filename, generatedDir, origin);
  } catch (firstErr) {
    console.warn(`[render] Download attempt 1 failed for ${filename}:`, firstErr instanceof Error ? firstErr.message : firstErr);
    // Brief pause then retry once
    await new Promise((r) => setTimeout(r, 2000));
    return await downloadToLocal(remoteUrl, filename, generatedDir, origin);
  }
}

export async function POST(req: Request) {
  try {
    const { format, scenes, jobs, audioMode = 'narration' } = await req.json() as {
      format: string;
      scenes: (Partial<Scene> & { id: string })[];
      jobs: { type: string; status: string; sceneId: string; resultUrl?: string }[];
      audioMode?: AudioMode;
    };

    const validFormats = [...FORMAT_KEYS, 'all'];
    if (!format || !validFormats.includes(format)) {
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
    }

    const projectRoot = process.cwd();
    const outputDir = path.join(projectRoot, 'output');
    const generatedDir = path.join(projectRoot, 'public', 'generated');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(generatedDir, { recursive: true });

    const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -1);
    const reqUrl = new URL(req.url);
    const origin = process.env.NEXT_PUBLIC_SITE_URL || `${reqUrl.protocol}//${reqUrl.host}`;

    // Collect assets per scene
    const imagesByScene = new Map<string, string[]>();
    const videosByScene = new Map<string, string[]>();
    let remoteAudioUrl: string | undefined;
    const remoteDialogueAudioUrls = new Map<string, string>();

    for (const j of (jobs || [])) {
      if (j.status !== 'done' || !j.resultUrl) continue;

      if (j.type === 'image') {
        if (!imagesByScene.has(j.sceneId)) imagesByScene.set(j.sceneId, []);
        imagesByScene.get(j.sceneId)!.push(j.resultUrl);
      } else if (j.type === 'video') {
        if (!videosByScene.has(j.sceneId)) videosByScene.set(j.sceneId, []);
        videosByScene.get(j.sceneId)!.push(j.resultUrl);
      } else if (j.type === 'audio' && j.sceneId === 'full') {
        remoteAudioUrl = j.resultUrl;
      } else if (j.type === 'audio' && j.sceneId.startsWith('char-')) {
        // Character dialogue audio
        const charName = j.sceneId.replace('char-', '');
        if (!remoteDialogueAudioUrls.has(charName)) {
          remoteDialogueAudioUrls.set(charName, j.resultUrl);
        }
      }
    }

    // Download audio locally (with retry)
    let localAudioUrl: string | undefined;
    if (remoteAudioUrl) {
      try {
        localAudioUrl = await downloadWithRetry(
          remoteAudioUrl,
          `audio-${ts}.mp3`,
          generatedDir,
          origin,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[render] Failed to download audio after retries:', msg);
        // Last resort: use remote URL (Remotion will try to download it)
        localAudioUrl = remoteAudioUrl;
      }
    }

    // Download dialogue audio locally
    const localDialogueAudioUrls: Record<string, string> = {};
    for (const [charName, remoteUrl] of remoteDialogueAudioUrls) {
      try {
        const localUrl = await downloadWithRetry(
          remoteUrl,
          `audio-char-${charName.replace(/\s+/g, '-')}-${ts}.mp3`,
          generatedDir,
          origin,
        );
        localDialogueAudioUrls[charName] = localUrl;
      } catch (err) {
        console.error(`[render] Failed to download dialogue audio for ${charName}:`, err instanceof Error ? err.message : err);
        localDialogueAudioUrls[charName] = remoteUrl;
      }
    }

    // Download video clips locally
    const localVideosByScene = new Map<string, string[]>();
    for (const [sceneId, urls] of videosByScene) {
      const localUrls: string[] = [];
      for (let i = 0; i < urls.length; i++) {
        try {
          const localUrl = await downloadWithRetry(
            urls[i],
            `video-${sceneId}-${i}-${ts}.mp4`,
            generatedDir,
            origin,
          );
          localUrls.push(localUrl);
        } catch (err) {
          console.error(`[render] Failed to download video clip for ${sceneId}:`, err instanceof Error ? err.message : err);
        }
      }
      if (localUrls.length > 0) {
        localVideosByScene.set(sceneId, localUrls);
      }
    }

    const toAbsoluteUrl = (url?: string) => {
      if (!url) return url;
      if (url.startsWith('/')) return `${origin}${url}`;
      return url;
    };

    // Debug: log scene ID mapping
    console.log('[render] Script scene IDs:', (scenes || []).map((s: { id: string }) => s.id));
    console.log('[render] Video scene IDs:', [...localVideosByScene.keys()]);
    console.log('[render] Image scene IDs:', [...imagesByScene.keys()]);

    const scenesWithAssets = (scenes || []).map((scene: Partial<Scene> & { id: string }) => {
      const sceneImages = imagesByScene.get(scene.id) || [];
      const absoluteImages = sceneImages
        .map((url) => toAbsoluteUrl(url))
        .filter(Boolean) as string[];

      const sceneVideos = localVideosByScene.get(scene.id) || [];

      console.log(`[render] Scene ${scene.id}: ${sceneVideos.length} videos, ${absoluteImages.length} images`);

      return {
        id: scene.id,
        type: scene.type,
        durationSeconds: scene.durationSeconds,
        narration: scene.narration,
        textOverlay: scene.textOverlay,
        visualMotion: scene.visualMotion,
        imageUrl: absoluteImages[0],
        imageUrls: absoluteImages.length > 1 ? absoluteImages : undefined,
        videoUrl: sceneVideos[0],
        videoUrls: sceneVideos.length > 1 ? sceneVideos : undefined,
        dialogue: scene.dialogue,
      };
    });

    // Clean up old generated files to prevent Remotion from copying hundreds of MBs
    // of stale assets. Only keep files referenced in the current render.
    const currentFiles = new Set<string>();
    for (const s of scenesWithAssets) {
      for (const url of [s.imageUrl, ...(s.imageUrls || []), s.videoUrl, ...(s.videoUrls || [])]) {
        if (url) {
          const filename = url.split('/').pop();
          if (filename) currentFiles.add(filename);
        }
      }
    }
    if (localAudioUrl) {
      const audioFilename = localAudioUrl.split('/').pop();
      if (audioFilename) currentFiles.add(audioFilename);
    }
    for (const url of Object.values(localDialogueAudioUrls)) {
      const fn = url.split('/').pop();
      if (fn) currentFiles.add(fn);
    }
    try {
      const allGenerated = fs.readdirSync(generatedDir);
      let removedCount = 0;
      for (const f of allGenerated) {
        if (!currentFiles.has(f)) {
          fs.unlinkSync(path.join(generatedDir, f));
          removedCount++;
        }
      }
      if (removedCount > 0) console.log(`[render] Cleaned up ${removedCount} old generated files`);
    } catch (cleanupErr) {
      console.warn('[render] Cleanup warning:', cleanupErr instanceof Error ? cleanupErr.message : cleanupErr);
    }

    const formatsToRender: VideoFormat[] = format === 'all'
      ? FORMAT_KEYS
      : [format as VideoFormat];

    const entryPoint = path.join(projectRoot, 'remotion', 'index.ts');

    const files: string[] = [];
    const errors: string[] = [];

    for (const fmt of formatsToRender) {
      const spec = PLATFORMS[fmt];
      const outputFile = `output/${fmt}-${spec.width}x${spec.height}-${ts}.mp4`;
      const outputPath = path.join(projectRoot, outputFile);
      const compositionId = COMPOSITION_IDS[fmt];

      // In dialogue mode, video clips have embedded audio (lip-sync) — don't overlay TTS
      // In 'both' mode, play narration TTS only — clips handle dialogue audio
      const hasClips = scenesWithAssets.some((s: { videoUrl?: string }) => !!s.videoUrl);
      const skipDialogueTTS = (audioMode === 'dialogue' || audioMode === 'both') && hasClips;
      const skipNarrationTTS = audioMode === 'dialogue';

      const propsData = {
        format: fmt,
        scenes: scenesWithAssets,
        audioUrl: skipNarrationTTS ? undefined : localAudioUrl,
        dialogueAudioUrls: skipDialogueTTS ? undefined : (Object.keys(localDialogueAudioUrls).length > 0 ? localDialogueAudioUrls : undefined),
        audioMode,
        brand: {
          colors: defaultConfig.brand.colors,
          fonts: defaultConfig.brand.fonts,
          typography: defaultConfig.brand.typography[fmt],
        },
      };

      const propsFile = path.join(outputDir, `props-${fmt}.json`);
      fs.writeFileSync(propsFile, JSON.stringify(propsData));

      console.log(`[render:${fmt}] Audio: ${propsData.audioUrl ? (propsData.audioUrl.startsWith('/') ? 'local' : 'REMOTE') : 'none'}`);
      const cmd = `npx remotion render "${entryPoint}" ${compositionId} "${outputPath}" --props="${propsFile}" --concurrency=4`;

      try {
        const { stderr } = await execAsync(cmd, {
          cwd: projectRoot,
          timeout: 1800000,
          maxBuffer: 10 * 1024 * 1024,
        });
        files.push(outputFile);
        if (stderr) console.log(`[render:${fmt}] stderr:`, stderr.slice(0, 500));
      } catch (err) {
        const msg = err instanceof Error ? err.message.slice(0, 2000) : 'Render failed';
        console.error(`[render:${fmt}] failed:`, msg);
        errors.push(`${fmt}: ${msg}`);
      } finally {
        // Keep a debug copy, clean the original
        try {
          fs.copyFileSync(propsFile, path.join(outputDir, `debug-props-${fmt}.json`));
          fs.unlinkSync(propsFile);
        } catch {}
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: errors[0] || 'All renders failed', errors }, { status: 500 });
    }

    return NextResponse.json({ files, errors: errors.length > 0 ? errors : undefined, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Render failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
