import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import type { VideoFormat, BrandConfig } from '../config/types';

interface TextOverlayProps {
  text: string;
  format: VideoFormat;
  brand: BrandConfig;
  variant?: 'title' | 'subtitle';
}

export const TextOverlay: React.FC<TextOverlayProps> = ({
  text,
  format,
  brand,
  variant = 'title',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring animation for text entrance
  const springValue = spring({ frame, fps, config: { damping: 15, stiffness: 100 } });

  const translateY = interpolate(springValue, [0, 1], [30, 0]);
  const opacity = interpolate(springValue, [0, 1], [0, 1]);

  const fontSize = variant === 'title' ? brand.typography.title : brand.typography.subtitle;

  // Format-specific positioning
  const bottomPosition = format === 'linkedin' ? '12%' : '15%';
  const padding = format === 'square' ? '5%' : '6%';

  // Handle multiline text (split by \n)
  const lines = text.split('\n');

  return (
    <div
      style={{
        position: 'absolute',
        bottom: bottomPosition,
        left: padding,
        right: padding,
        transform: `translateY(${translateY}px)`,
        opacity,
        zIndex: 10,
      }}
    >
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            fontSize: i === 0 ? fontSize : fontSize * 0.65,
            fontWeight: i === 0 ? 800 : 400,
            color: i === 0 ? brand.colors.text : brand.colors.accent,
            fontFamily: brand.fonts.primary,
            lineHeight: 1.2,
            textShadow: '0 2px 8px rgba(0,0,0,0.6)',
            marginBottom: i < lines.length - 1 ? 8 : 0,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
};
