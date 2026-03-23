import { NextResponse } from 'next/server';
import { generateImage } from '@/lib/gemini-image';
import { IMAGE_STYLE_SUFFIXES } from '@/lib/types';
import type { ImageStyle, ReferenceImage } from '@/lib/types';
import fs from 'fs';
import path from 'path';

/**
 * Read a local image file (from /generated/...) and return as a ReferenceImage-like
 * object that generateImage can include as inline data for Gemini.
 */
function localImageToRef(localUrl: string): ReferenceImage | null {
  try {
    // localUrl is like /generated/img-scene-0-1234.png
    const filename = localUrl.split('/').pop();
    if (!filename) return null;
    const filePath = path.join(process.cwd(), 'public', 'generated', filename);
    if (!fs.existsSync(filePath)) return null;
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filename).replace('.', '');
    const mime = ext === 'jpg' ? 'jpeg' : ext;
    const dataUrl = `data:image/${mime};base64,${buffer.toString('base64')}`;
    return { id: `neighbor-${filename}`, type: 'character', dataUrl, filename };
  } catch {
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
      characterGuide,
      environmentGuide,
      neighborImageUrls,
    } = await req.json() as {
      jobId: string;
      sceneId: string;
      originalPrompt: string;
      changeDescription: string;
      imageStyle?: ImageStyle;
      imageInstruction?: string;
      referenceImages?: ReferenceImage[];
      characterGuide?: string;
      environmentGuide?: string;
      neighborImageUrls?: string[];
    };

    if (!jobId || !sceneId || !originalPrompt || !changeDescription) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const styleSuffix = IMAGE_STYLE_SUFFIXES[imageStyle || 'realistic'];

    // Build consistency context from character/environment guides
    const guideParts: string[] = [];
    if (characterGuide) guideParts.push(`Character: ${characterGuide}`);
    if (environmentGuide) guideParts.push(`Environment: ${environmentGuide}`);
    const guideContext = guideParts.length > 0
      ? `\nVisual consistency: ${guideParts.join('. ')}`
      : '';

    // Put the user's change request and instructions FIRST so the model prioritizes them
    const parts: string[] = [];
    parts.push(`IMPORTANT — Apply this change: ${changeDescription}`);
    if (imageInstruction?.trim()) {
      parts.push(`MUST FOLLOW instruction: ${imageInstruction.trim()}`);
    }
    parts.push(`Base scene: ${originalPrompt}`);
    if (guideContext) parts.push(guideContext);
    parts.push(styleSuffix);

    const fullPrompt = parts.join('\n');

    // Combine user-uploaded reference images + neighboring frame images for context
    const allRefs: ReferenceImage[] = [...(referenceImages || [])];
    if (neighborImageUrls?.length) {
      for (const url of neighborImageUrls) {
        const ref = localImageToRef(url);
        if (ref) allRefs.push(ref);
      }
      console.log(`[regenerate-image] Including ${neighborImageUrls.length} neighbor frames as visual context`);
    }

    console.log(`[regenerate-image] Regenerating ${jobId} for scene ${sceneId} (${allRefs.length} reference images)`);

    const refPreamble = allRefs.length > 0
      ? 'The reference images show the visual style and neighboring frames of this storyboard. Match the character appearance, environment, lighting, and color palette.\n'
      : '';

    const resultUrl = await generateImage(
      `${refPreamble}${fullPrompt}`,
      `regen-${jobId}`,
      '16:9',
      allRefs.length > 0 ? allRefs : undefined,
    );

    return NextResponse.json({ jobId, sceneId, resultUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Regeneration failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
