import React from 'react';
import { AbsoluteFill, OffthreadVideo } from 'remotion';
import type { VideoFormat } from '../config/types';

interface BRollVideoProps {
  src: string;
  format: VideoFormat;
}

export const BRollVideo: React.FC<BRollVideoProps> = ({ src, format }) => {
  return (
    <AbsoluteFill>
      <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        <OffthreadVideo
          muted
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: format === 'reel' ? '50% 30%' : 'center',
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
