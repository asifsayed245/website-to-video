import React from 'react';
import { AbsoluteFill, Sequence, OffthreadVideo, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VideoFormat } from '../config/types';

interface MultiVideoProps {
  videos: string[];
  format: VideoFormat;
}

const CROSSFADE_FRAMES = 15;

/**
 * Renders one or more video clips with crossfade transitions.
 * Each clip is wrapped in its own Sequence so it plays from the start,
 * not from the overall scene frame position.
 */
export const MultiVideo: React.FC<MultiVideoProps> = ({ videos, format }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  if (videos.length === 0) return null;

  const objectPosition = format === 'reel' ? '50% 30%' : 'center';
  const framesPerVideo = Math.floor(durationInFrames / videos.length);

  return (
    <AbsoluteFill>
      <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
        {videos.map((src, idx) => {
          const slotStart = idx * framesPerVideo;
          // Last clip gets remaining frames
          const slotDuration = idx === videos.length - 1
            ? durationInFrames - slotStart
            : framesPerVideo;

          // Calculate opacity for crossfade
          const frameInSlot = frame - slotStart;

          // Only render clips that are currently visible or about to crossfade
          if (frameInSlot < -CROSSFADE_FRAMES || frameInSlot > slotDuration + CROSSFADE_FRAMES) {
            return null;
          }

          let opacity = 0;
          if (frameInSlot >= 0 && frameInSlot < slotDuration) {
            // This is the current clip
            if (idx < videos.length - 1 && frameInSlot > slotDuration - CROSSFADE_FRAMES) {
              // Fading out to next clip
              opacity = interpolate(
                frameInSlot,
                [slotDuration - CROSSFADE_FRAMES, slotDuration],
                [1, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              );
            } else {
              opacity = 1;
            }
          } else if (frameInSlot < 0 && idx > 0) {
            // This clip is about to start — fading in as previous fades out
            const prevFrameInSlot = frame - (idx - 1) * framesPerVideo;
            const prevSlotDuration = framesPerVideo;
            if (prevFrameInSlot > prevSlotDuration - CROSSFADE_FRAMES) {
              opacity = interpolate(
                prevFrameInSlot,
                [prevSlotDuration - CROSSFADE_FRAMES, prevSlotDuration],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              );
            }
          }

          if (opacity <= 0) return null;

          return (
            <Sequence key={`${src}-${idx}`} from={slotStart} durationInFrames={slotDuration + CROSSFADE_FRAMES}>
              <OffthreadVideo
                muted
                src={src}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition,
                  opacity,
                }}
              />
            </Sequence>
          );
        })}
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
