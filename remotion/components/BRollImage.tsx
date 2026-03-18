import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VideoFormat } from '../config/types';

interface BRollImageProps {
  src: string;
  motion: 'ken_burns_right' | 'ken_burns_left' | 'zoom_in' | 'zoom_out' | 'static';
  format: VideoFormat;
}

export const BRollImage: React.FC<BRollImageProps> = ({ src, motion, format }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Calculate motion transforms
  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  const progress = frame / durationInFrames;

  switch (motion) {
    case 'ken_burns_right':
      scale = interpolate(frame, [0, durationInFrames], [1.05, 1.15]);
      translateX = interpolate(frame, [0, durationInFrames], [-2, 2]);
      break;
    case 'ken_burns_left':
      scale = interpolate(frame, [0, durationInFrames], [1.15, 1.05]);
      translateX = interpolate(frame, [0, durationInFrames], [2, -2]);
      break;
    case 'zoom_in':
      scale = interpolate(frame, [0, durationInFrames], [1, 1.15]);
      break;
    case 'zoom_out':
      scale = interpolate(frame, [0, durationInFrames], [1.15, 1]);
      break;
    case 'static':
    default:
      scale = 1.05;
      break;
  }

  // Format-specific object position
  const objectPosition = format === 'reel' ? '50% 30%' : 'center';

  return (
    <AbsoluteFill>
      <div
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition,
            transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
          }}
        />
      </div>
      {/* Gradient overlay for text readability */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: format === 'linkedin' ? '40%' : '50%',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
        }}
      />
    </AbsoluteFill>
  );
};
