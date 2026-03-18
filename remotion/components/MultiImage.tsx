import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VideoFormat } from '../config/types';

interface MultiImageProps {
  images: string[];
  motion: 'ken_burns_right' | 'ken_burns_left' | 'zoom_in' | 'zoom_out' | 'static';
  format: VideoFormat;
}

const CROSSFADE_FRAMES = 15; // 0.5s crossfade at 30fps

/**
 * Renders one or more images with crossfade transitions.
 * Single image: behaves exactly like BRollImage.
 * Multiple images: divides scene duration equally, crossfading between them.
 */
export const MultiImage: React.FC<MultiImageProps> = ({ images, motion, format }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  if (images.length === 0) return null;

  const objectPosition = format === 'reel' ? '50% 30%' : 'center';

  // How many frames each image gets
  const framesPerImage = Math.floor(durationInFrames / images.length);

  // Determine which image(s) to show and their opacities
  const currentIndex = Math.min(
    Math.floor(frame / framesPerImage),
    images.length - 1
  );
  const frameInSlot = frame - currentIndex * framesPerImage;

  // Motion for the current image
  const getMotionStyle = (idx: number) => {
    const localDuration = framesPerImage;
    const localFrame = frame - idx * framesPerImage;
    const clampedFrame = Math.max(0, Math.min(localFrame, localDuration));

    let scale = 1;
    let translateX = 0;

    // Alternate motion direction for each image
    const motions = ['ken_burns_right', 'ken_burns_left', 'zoom_in', 'zoom_out', 'static'] as const;
    const effectiveMotion = images.length === 1 ? motion : motions[idx % motions.length];

    switch (effectiveMotion) {
      case 'ken_burns_right':
        scale = interpolate(clampedFrame, [0, localDuration], [1.05, 1.15]);
        translateX = interpolate(clampedFrame, [0, localDuration], [-2, 2]);
        break;
      case 'ken_burns_left':
        scale = interpolate(clampedFrame, [0, localDuration], [1.15, 1.05]);
        translateX = interpolate(clampedFrame, [0, localDuration], [2, -2]);
        break;
      case 'zoom_in':
        scale = interpolate(clampedFrame, [0, localDuration], [1, 1.15]);
        break;
      case 'zoom_out':
        scale = interpolate(clampedFrame, [0, localDuration], [1.15, 1]);
        break;
      default:
        scale = 1.05;
        break;
    }

    return { scale, translateX };
  };

  return (
    <AbsoluteFill>
      <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
        {images.map((src, idx) => {
          // Only render current image and next (for crossfade)
          if (idx < currentIndex - 1 || idx > currentIndex + 1) return null;

          let opacity = 0;
          if (idx === currentIndex) {
            // Current image: fade out near the end (if there's a next image)
            if (idx < images.length - 1 && frameInSlot > framesPerImage - CROSSFADE_FRAMES) {
              opacity = interpolate(
                frameInSlot,
                [framesPerImage - CROSSFADE_FRAMES, framesPerImage],
                [1, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              );
            } else {
              opacity = 1;
            }
          } else if (idx === currentIndex + 1) {
            // Next image: fade in during crossfade
            if (frameInSlot > framesPerImage - CROSSFADE_FRAMES) {
              opacity = interpolate(
                frameInSlot,
                [framesPerImage - CROSSFADE_FRAMES, framesPerImage],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              );
            }
          }

          if (opacity <= 0) return null;

          const { scale, translateX } = getMotionStyle(idx);

          return (
            <Img
              key={`${src}-${idx}`}
              src={src}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition,
                transform: `scale(${scale}) translateX(${translateX}%)`,
                opacity,
              }}
            />
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
