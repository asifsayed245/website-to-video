import { NextResponse } from 'next/server';
import { pollJobStatus } from '@/lib/deapi';
import { pollTaskStatus } from '@/lib/kie';
import type { AssetJob } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const { jobs }: { jobs: AssetJob[] } = await req.json();

    if (!jobs || !Array.isArray(jobs)) {
      return NextResponse.json({ error: 'Jobs array required' }, { status: 400 });
    }

    const updated = await Promise.all(
      jobs.map(async (job) => {
        if (job.status === 'done' || job.status === 'failed') {
          return job;
        }

        try {
          if (job.type === 'video') {
            // Poll kie.ai for video clip jobs
            const result = await pollTaskStatus(job.requestId);
            if (result.status === 'failed') {
              console.error(`kie.ai clip failed for ${job.sceneId}: ${result.error || 'unknown reason'}`);
            }
            return {
              ...job,
              status: result.status,
              resultUrl: result.resultUrls?.[0] || job.resultUrl,
            };
          } else if (job.type === 'audio') {
            // Poll deAPI for audio jobs
            const result = await pollJobStatus(job.requestId);
            return {
              ...job,
              status: result.status,
              resultUrl: result.resultUrl || job.resultUrl,
            };
          }
          // Image jobs are synchronous — should never reach here
          return job;
        } catch (err) {
          console.error(`Status poll error for ${job.type} job ${job.sceneId}:`, err instanceof Error ? err.message : err);
          return { ...job, status: 'failed' as const };
        }
      })
    );

    const allDone = updated.every((j) => j.status === 'done' || j.status === 'failed');
    return NextResponse.json({ jobs: updated, allDone });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Status check failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
