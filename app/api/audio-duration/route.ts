import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Audio URL required' }, { status: 400 });
    }

    // Use ffprobe to get actual audio duration (ffmpeg/ffprobe is required by Remotion)
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${url}"`,
      { timeout: 30000 }
    );

    const duration = parseFloat(stdout.trim());
    if (isNaN(duration)) {
      return NextResponse.json({ error: 'Could not parse duration' }, { status: 500 });
    }

    return NextResponse.json({ duration });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get audio duration';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
