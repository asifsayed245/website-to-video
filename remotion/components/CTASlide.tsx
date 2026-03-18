import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import type { VideoFormat, BrandConfig, SceneData } from '../config/types';
import { BRollImage } from './BRollImage';
import { BRollVideo } from './BRollVideo';
import { MultiImage } from './MultiImage';
import { MultiVideo } from './MultiVideo';

interface CTASlideProps {
  scene: SceneData;
  format: VideoFormat;
  brand: BrandConfig;
}

export const CTASlide: React.FC<CTASlideProps> = ({ scene, format, brand }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = spring({ frame, fps, config: { damping: 20 } });
  const buttonSpring = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const lines = scene.textOverlay.split('\n');
  const mainText = lines[0];
  const subText = lines[1] || '';

  const titleSize = brand.typography.title;

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

      {/* Bottom gradient for text readability */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '50%',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
        }}
      />

      {/* CTA content centered */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10%',
          opacity: interpolate(fadeIn, [0, 1], [0, 1]),
          zIndex: 10,
        }}
      >
        <div
          style={{
            fontSize: titleSize,
            fontWeight: 800,
            color: brand.colors.text,
            fontFamily: brand.fonts.primary,
            textAlign: 'center',
            lineHeight: 1.2,
            textShadow: '0 2px 12px rgba(0,0,0,0.5)',
            marginBottom: 24,
          }}
        >
          {mainText}
        </div>

        {subText && (
          <div
            style={{
              fontSize: titleSize * 0.45,
              fontWeight: 600,
              color: brand.colors.text,
              fontFamily: brand.fonts.primary,
              backgroundColor: brand.colors.primary,
              padding: '12px 32px',
              borderRadius: 8,
              transform: `scale(${interpolate(buttonSpring, [0, 1], [0.8, 1])})`,
              opacity: interpolate(buttonSpring, [0, 1], [0, 1]),
              boxShadow: `0 4px 20px ${brand.colors.primary}44`,
            }}
          >
            {subText}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
