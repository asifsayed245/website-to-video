import { NextResponse } from 'next/server';
import { submitAudioJob, pollJobStatus } from '@/lib/deapi';
import { delay } from '@/lib/utils';

export async function POST(req: Request) {
  try {
    const { voiceId, lang } = await req.json();

    if (!voiceId) {
      return NextResponse.json({ error: 'Missing voiceId' }, { status: 400 });
    }

    const sampleText = lang === 'hi'
      ? 'नमस्ते, यह एक आवाज़ का नमूना है। आइए देखें कि यह कैसी लगती है।'
      : 'Hello, this is a voice sample. Let me show you how this sounds for your video.';

    const requestId = await submitAudioJob(sampleText, voiceId, 1.0, lang || 'en-us');

    // Poll until done (max 30s)
    for (let i = 0; i < 15; i++) {
      await delay(2000);
      const status = await pollJobStatus(requestId);
      if (status.status === 'done' && status.resultUrl) {
        return NextResponse.json({ audioUrl: status.resultUrl });
      }
      if (status.status === 'failed') {
        return NextResponse.json({ error: status.error || 'Voice preview failed' }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Voice preview timed out' }, { status: 504 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Voice preview failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
