import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

function nodeStreamToWeb(stream: fs.ReadStream): ReadableStream {
  return new ReadableStream({
    start(controller) {
      let closed = false;
      stream.on('data', (chunk) => { if (!closed) controller.enqueue(chunk); });
      stream.on('end', () => { if (!closed) { closed = true; controller.close(); } });
      stream.on('error', (err) => { if (!closed) { closed = true; controller.error(err); } });
    },
    cancel() { stream.destroy(); },
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get('file');

  if (!file) {
    return NextResponse.json({ error: 'Missing file parameter' }, { status: 400 });
  }

  // Sanitize: only allow filenames within the output/ directory
  const basename = path.basename(file);
  if (basename !== file || file.includes('..')) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), 'output', basename);

  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const fileSize = stat.size;
  const rangeHeader = req.headers.get('range');

  // Support HTTP Range requests for video seeking
  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const stream = fs.createReadStream(filePath, { start, end });
      const readable = nodeStreamToWeb(stream);

      return new NextResponse(readable, {
        status: 206,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Content-Length': chunkSize.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-cache',
        },
      });
    }
  }

  // Full file response with streaming
  const stream = fs.createReadStream(filePath);
  const readable = nodeStreamToWeb(stream);

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': fileSize.toString(),
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `inline; filename="${basename}"`,
      'Cache-Control': 'no-cache',
    },
  });
}
