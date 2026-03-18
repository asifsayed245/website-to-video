import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import type { VideoFormat, BrandConfig, SceneData } from '../config/types';
import { BRollImage } from './BRollImage';
import { BRollVideo } from './BRollVideo';
import { MultiImage } from './MultiImage';
import { MultiVideo } from './MultiVideo';
import { TextOverlay } from './TextOverlay';

interface HookSlideProps {
  scene: SceneData;
  format: VideoFormat;
  brand: BrandConfig;
}

export const HookSlide: React.FC<HookSlideProps> = ({ scene, format, brand }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lineSpring = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 12 } });
  const lineWidth = interpolate(lineSpring, [0, 1], [0, 60]);

  // Fallback chain: videoUrls → videoUrl → imageUrls → imageUrl
  const renderBackground = () => {
    if (scene.videoUrls && scene.videoUrls.length > 1) {
      return <MultiVideo videos={scene.videoUrls} format={format} />;
    }
    if (scene.videoUrl) {
      return <BRollVideo src={scene.videoUrl} format={format} />;
    }
    if (scene.imageUrls && scene.imageUrls.length > 1) {
      return <MultiImage images={scene.imageUrls} motion={scene.visualMotion} format={format} />;
    }
    if (scene.imageUrl) {
      return <BRollImage src={scene.imageUrl} motion={scene.visualMotion} format={format} />;
    }
    return null;
  };

  return (
    <AbsoluteFill>
      {renderBackground()}

      {/* Accent line above title */}
      <div
        style={{
          position: 'absolute',
          bottom: format === 'linkedin' ? '22%' : '28%',
          left: format === 'square' ? '5%' : '6%',
          width: lineWidth,
          height: 4,
          backgroundColor: brand.colors.accent,
          borderRadius: 2,
          zIndex: 10,
        }}
      />

      <TextOverlay text={scene.textOverlay} format={format} brand={brand} variant="title" />
    </AbsoluteFill>
  );
};
