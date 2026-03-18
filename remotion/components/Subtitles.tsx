import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { VideoFormat, BrandConfig } from '../config/types';
import { splitWords } from '../../lib/utils';

interface SubtitlesProps {
  narration: string;
  format: VideoFormat;
  brand: BrandConfig;
}

const WORDS_PER_CHUNK = 3;

export const Subtitles: React.FC<SubtitlesProps> = ({ narration, format, brand }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const words = splitWords(narration);
  if (words.length === 0) return null;

  // Group words into chunks of WORDS_PER_CHUNK
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += WORDS_PER_CHUNK) {
    chunks.push(words.slice(i, i + WORDS_PER_CHUNK).join(' '));
  }

  // Weight each chunk by character count (longer phrases take more time to speak)
  const charCounts = chunks.map((c) => c.length);
  const totalChars = charCounts.reduce((sum, n) => sum + n, 0);

  // Build cumulative frame boundaries per chunk
  const chunkStartFrames: number[] = [];
  const chunkDurations: number[] = [];
  let cumFrames = 0;
  for (let i = 0; i < chunks.length; i++) {
    chunkStartFrames.push(cumFrames);
    const dur = Math.round((charCounts[i] / totalChars) * durationInFrames);
    chunkDurations.push(dur);
    cumFrames += dur;
  }
  // Absorb rounding in last chunk
  if (chunks.length > 0) {
    chunkDurations[chunks.length - 1] += durationInFrames - cumFrames;
  }

  // Find which chunk the current frame falls in
  let currentChunkIndex = chunks.length - 1;
  for (let i = 0; i < chunks.length; i++) {
    if (frame < chunkStartFrames[i] + chunkDurations[i]) {
      currentChunkIndex = i;
      break;
    }
  }
  const currentChunk = chunks[currentChunkIndex];
  const currentChunkDuration = chunkDurations[currentChunkIndex];

  // Fade in/out within each chunk
  const chunkLocalFrame = frame - chunkStartFrames[currentChunkIndex];
  const fadeIn = Math.min(chunkLocalFrame / 4, 1);
  const fadeOut = Math.min((currentChunkDuration - chunkLocalFrame) / 4, 1);
  const opacity = Math.min(fadeIn, fadeOut);

  // Format-specific sizing (50% larger for readability)
  const fontSize = format === 'linkedin' ? 54 : format === 'square' ? 45 : 42;
  const bottom = format === 'linkedin' ? '6%' : '8%';
  const padding = format === 'square' ? '6%' : '8%';

  return (
    <div
      style={{
        position: 'absolute',
        bottom,
        left: padding,
        right: padding,
        textAlign: 'center',
        zIndex: 15,
        opacity,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: '#ffffff',
          fontSize,
          fontWeight: 700,
          fontFamily: brand.fonts.primary,
          padding: '12px 28px',
          borderRadius: 8,
          lineHeight: 1.4,
          textShadow: '0 1px 4px rgba(0,0,0,0.5)',
        }}
      >
        {currentChunk}
      </span>
    </div>
  );
};
