import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import type { VideoFormat, BrandConfig, SceneData } from '../config/types';
import { BRollImage } from './BRollImage';
import { BRollVideo } from './BRollVideo';
import { MultiImage } from './MultiImage';
import { MultiVideo } from './MultiVideo';
import { TextOverlay } from './TextOverlay';

interface KeyPointSlideProps {
  scene: SceneData;
  format: VideoFormat;
  brand: BrandConfig;
  pointNumber: number;
}

export const KeyPointSlide: React.FC<KeyPointSlideProps> = ({
  scene,
  format,
  brand,
  pointNumber,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const badgeSpring = spring({ frame, fps, config: { damping: 10, stiffness: 120 } });
  const badgeScale = interpolate(badgeSpring, [0, 1], [0, 1]);

  const badgeSize = format === 'linkedin' ? 48 : 40;
  const badgePosition = format === 'linkedin' ? '22%' : '28%';

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

      {/* Point number badge */}
      <div
        style={{
          position: 'absolute',
          bottom: badgePosition,
          left: format === 'square' ? '5%' : '6%',
          width: badgeSize,
          height: badgeSize,
          borderRadius: '50%',
          backgroundColor: brand.colors.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: badgeSize * 0.5,
          fontWeight: 800,
          color: '#fff',
          fontFamily: brand.fonts.primary,
          transform: `scale(${badgeScale})`,
          zIndex: 10,
          boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
        }}
      >
        {pointNumber}
      </div>

      <TextOverlay text={scene.textOverlay} format={format} brand={brand} variant="title" />
    </AbsoluteFill>
  );
};
