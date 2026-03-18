import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VideoFormat } from '../config/types';

interface ProgressBarProps {
  format: VideoFormat;
  accentColor: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ format, accentColor }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progress = interpolate(frame, [0, durationInFrames], [0, 100]);

  const isTop = format === 'linkedin';

  return (
    <div
      style={{
        position: 'absolute',
        [isTop ? 'top' : 'bottom']: 0,
        left: 0,
        right: 0,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.15)',
        zIndex: 20,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          backgroundColor: accentColor,
          transition: 'width 0.1s linear',
        }}
      />
    </div>
  );
};
