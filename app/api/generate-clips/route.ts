import { NextResponse } from 'next/server';
import { submitImageToVideoJob, isKieConfigured } from '@/lib/kie';
import { planCameraDirections, buildClipPrompt } from '@/lib/camera-director';
import { uploadToPublicHost } from '@/lib/image-upload';
import type { AssetJob, VideoScript, KieModel, ClipResolution, AudioMode, DialogueLine } from '@/lib/types';
import { KIE_MODEL_OPTIONS } from '@/lib/types';
import { delay } from '@/lib/utils';

export async function POST(req: Request) {
  try {
    if (!isKieConfigured()) {
      return NextResponse.json(
        { error: 'KIE_API_KEY not configured. Skipping clip generation.' },
        { status: 400 }
      );
    }

    const { jobs, script, clipModel, clipResolution, clipDuration, audioMode } = (await req.json()) as {
      jobs: AssetJob[];
      script: VideoScript;
      clipModel?: KieModel;
      clipResolution?: ClipResolution;
      clipDuration?: string;
      audioMode?: AudioMode;
    };

    // Check if selected model supports sound (for dialogue mode)
    const modelDef = KIE_MODEL_OPTIONS.find((m) => m.value === clipModel);
    const modelSupportsSound = modelDef?.soundSupported ?? false;
    const useSound = (audioMode === 'dialogue' || audioMode === 'both') && modelSupportsSound;

    if (!jobs || !Array.isArray(jobs)) {
      return NextResponse.json({ error: 'Jobs array required' }, { status: 400 });
    }

    if (!script?.scenes) {
      return NextResponse.json({ error: 'Script with scenes required' }, { status: 400 });
    }

    // Plan camera directions for all scenes
    const cameraDirections = planCameraDirections(script);

    // Filter to completed image jobs only
    const imageJobs = jobs.filter(
      (j) => j.type === 'image' && j.status === 'done' && j.resultUrl
    );

    if (imageJobs.length === 0) {
      return NextResponse.json({ error: 'No completed images to convert' }, { status: 400 });
    }

    const clipJobs: AssetJob[] = [];
    const errors: string[] = [];

    // Process images sequentially to avoid rate-limiting the upload host
    for (let i = 0; i < imageJobs.length; i++) {
      const imgJob = imageJobs[i];

      try {
        // Upload local image to a public host so kie.ai can access it
        console.log(`Uploading image ${i + 1}/${imageJobs.length}: ${imgJob.sceneId}`);
        const imageUrl = await uploadToPublicHost(imgJob.resultUrl!);

        // Find the matching camera direction for this scene
        const direction = cameraDirections.find((d) => d.sceneId === imgJob.sceneId);
        const scene = script.scenes.find((s) => s.id === imgJob.sceneId);

        // Build the combined prompt: camera direction + visual description
        let prompt = scene?.brollPrompt || 'Gentle cinematic camera motion';
        if (direction) {
          prompt = buildClipPrompt(direction, prompt);
        }

        // Build dialogue text for sound-enabled models
        let dialogueText: string | undefined;
        if (useSound && scene?.dialogue?.length) {
          dialogueText = scene.dialogue
            .map((d: DialogueLine) => `[${d.speaker}]: "${d.text}"`)
            .join(' ');
        }

        const taskId = await submitImageToVideoJob({
          imageUrl,
          prompt,
          model: clipModel,
          resolution: clipResolution,
          duration: clipDuration,
          enableSound: useSound,
          dialogueText,
        });

        console.log(`Clip submitted for ${imgJob.sceneId}: taskId=${taskId}`);

        clipJobs.push({
          id: `vid-${imgJob.sceneId}-${Date.now()}`,
          sceneId: imgJob.sceneId,
          type: 'video',
          requestId: taskId,
          status: 'processing',
          sourceImageUrl: imgJob.resultUrl,
          cameraDirection: direction?.movement,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Clip submission failed';
        console.error(`Clip submission failed for scene ${imgJob.sceneId}:`, msg);
        errors.push(msg);
        clipJobs.push({
          id: `vid-${imgJob.sceneId}-failed`,
          sceneId: imgJob.sceneId,
          type: 'video',
          requestId: '',
          status: 'failed',
          sourceImageUrl: imgJob.resultUrl,
        });
      }

      // Brief delay between submissions to avoid rate limits
      if (i < imageJobs.length - 1) {
        await delay(1500);
      }
    }

    return NextResponse.json({
      clipJobs,
      cameraDirections,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Clip generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
