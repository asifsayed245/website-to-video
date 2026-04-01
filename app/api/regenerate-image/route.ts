import { NextResponse } from 'next/server';
import { generateImage, editImage } from '@/lib/gemini-image';
import { IMAGE_STYLE_SUFFIXES } from '@/lib/types';
import type { ImageStyle, ReferenceImage } from '@/lib/types';
import fs from 'fs';
import path from 'path';

/**
 * Read a local image file (from /generated/...) and return as a ReferenceImage-like
 * object that generateImage can include as inline data for Gemini.
 */
function localImageToRef(localUrl: string, refType: 'character' | 'environment' = 'character'): ReferenceImage | null {
  try {
    const filename = localUrl.split('/').pop();
    if (!filename) {
      console.warn(`[localImageToRef] Could not extract filename from: ${localUrl}`);
      return null;
    }
    const filePath = path.join(process.cwd(), 'public', 'generated', filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`[localImageToRef] File not found: ${filePath}`);
      return null;
    }
    const buffer = fs.readFileSync(filePath);
    console.log(`[localImageToRef] Loaded ${filename} (${buffer.length} bytes)`);
    const ext = path.extname(filename).replace('.', '');
    const mime = ext === 'jpg' ? 'jpeg' : ext;
    const dataUrl = `data:image/${mime};base64,${buffer.toString('base64')}`;
    return { id: `local-${filename}`, type: refType, dataUrl, filename };
  } catch (err) {
    console.error(`[localImageToRef] Error loading ${localUrl}:`, err);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const {
      jobId,
      sceneId,
      originalPrompt,
      changeDescription,
      imageStyle,
      imageInstruction,
      referenceImages,
      currentImageUrl,
      neighborImageUrls,
    } = await req.json() as {
      jobId: string;
      sceneId: string;
      originalPrompt: string;
      changeDescription: string;
      imageStyle?: ImageStyle;
      imageInstruction?: string;
      referenceImages?: ReferenceImage[];
      currentImageUrl?: string;
      neighborImageUrls?: string[];
    };

    if (!jobId || !sceneId || !originalPrompt || !changeDescription) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const styleSuffix = IMAGE_STYLE_SUFFIXES[imageStyle || 'realistic'];

    // Build reference images list. Order matters — model pays most attention to first images.
    // 1. Current image (the one being edited) — MOST IMPORTANT
    // 2. User-uploaded character/environment refs
    // 3. Neighboring frames for context
    const allRefs: ReferenceImage[] = [];

    // The current image is the PRIMARY reference — model must reproduce it with changes
    if (currentImageUrl) {
      const currentRef = localImageToRef(currentImageUrl);
      if (currentRef) {
        currentRef.id = 'current-image';
        allRefs.push(currentRef);
      }
    }

    // User-uploaded references (character/environment)
    if (referenceImages?.length) {
      allRefs.push(...referenceImages);
    }

    // Neighboring frames for style/consistency context
    if (neighborImageUrls?.length) {
      for (const url of neighborImageUrls) {
        const ref = localImageToRef(url, 'environment');
        if (ref) allRefs.push(ref);
      }
    }

    // Find the current image for editing
    const currentRef = allRefs.find((r) => r.id === 'current-image');

    console.log(`[regenerate] ${jobId} — "${changeDescription}" | hasCurrentImage: ${!!currentRef} | currentUrl: ${currentImageUrl || 'none'} | allRefs: ${allRefs.length}`);

    let resultUrl: string;

    if (currentRef) {
      // EDIT MODE: Use Gemini's multi-turn image editing capability.
      // The editImage function uses a chat-like structure so the model
      // understands it should MODIFY the existing image, not generate anew.
      const editPrompt = [
        `Edit the image: ${changeDescription}.`,
        imageInstruction?.trim() ? imageInstruction.trim() + '.' : '',
        'IMPORTANT: Do NOT generate a new image. Modify the existing image.',
        'Keep the same characters, same composition, same background, same art style.',
        'Only change what was specifically requested above.',
      ].filter(Boolean).join(' ');

      console.log(`[regenerate] EDIT MODE — prompt: ${editPrompt}`);

      resultUrl = await editImage(
        editPrompt,
        currentRef,
        `regen-${jobId}`,
      );
    } else {
      // GENERATE MODE: No current image — generate from scratch
      console.warn(`[regenerate] No current image for ${currentImageUrl}, generating from scratch`);
      const prompt = [
        changeDescription,
        imageInstruction?.trim() || '',
        `Scene: ${originalPrompt.slice(0, 200)}`,
        styleSuffix.trim(),
      ].filter(Boolean).join('. ');

      resultUrl = await generateImage(
        prompt,
        `regen-${jobId}`,
        '16:9',
        allRefs.length > 0 ? allRefs : undefined,
      );
    }

    return NextResponse.json({ jobId, sceneId, resultUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Regeneration failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
