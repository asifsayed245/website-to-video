import React from 'react';
import { Composition } from 'remotion';
import { WebContentVideo } from './WebContentVideo';
import type { BrandConfig, VideoCompositionProps } from './config/types';
import type { SceneData } from './config/types';

// Default placeholder data for Remotion Studio preview
const defaultBrand: BrandConfig = {
  colors: {
    primary: '#3B82F6',
    accent: '#10B981',
    bg: '#0a0a0a',
    text: '#ffffff',
    overlay: 'rgba(0,0,0,0.7)',
  },
  fonts: { primary: 'Inter, system-ui, sans-serif' },
  typography: { title: 48, subtitle: 28, body: 22 },
};

const defaultScenes: SceneData[] = [
  {
    id: 'hook',
    type: 'hook',
    durationSeconds: 5,
    narration: 'Discover the future of content creation.',
    textOverlay: 'Content That Converts',
    visualMotion: 'zoom_in',
  },
  {
    id: 'point_1',
    type: 'key_point',
    durationSeconds: 8,
    narration: 'AI generates stunning visuals automatically.',
    textOverlay: 'AI-Powered Visuals',
    visualMotion: 'ken_burns_right',
  },
  {
    id: 'point_2',
    type: 'key_point',
    durationSeconds: 8,
    narration: 'Professional voiceover in any language.',
    textOverlay: 'Multi-Language Voice',
    visualMotion: 'ken_burns_left',
  },
  {
    id: 'point_3',
    type: 'key_point',
    durationSeconds: 7,
    narration: 'Export to every platform in one click.',
    textOverlay: 'Multi-Platform Export',
    visualMotion: 'zoom_out',
  },
  {
    id: 'cta',
    type: 'cta',
    durationSeconds: 5,
    narration: 'Start creating today.',
    textOverlay: 'Get Started\nwebsite-to-social.com',
    visualMotion: 'static',
  },
];

const defaultProps: Omit<VideoCompositionProps, 'format'> = {
  scenes: defaultScenes,
  brand: defaultBrand,
  audioUrl: undefined,
};

const FPS = 30;
const defaultFrames = defaultScenes.reduce((sum, s) => sum + s.durationSeconds * FPS, 0);

// Shared calculateMetadata — computes duration from scene props + tail padding
const calcMetadata = async ({ props }: { props: Record<string, unknown> }) => {
  const p = props as unknown as VideoCompositionProps;
  const totalSeconds = p.scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
  // Add 3s padding so TTS audio isn't clipped at the end
  return { durationInFrames: Math.ceil((totalSeconds + 3) * FPS) };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Reel"
        component={WebContentVideo as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={defaultFrames}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ ...defaultProps, format: 'reel' as const }}
        calculateMetadata={calcMetadata}
      />
      <Composition
        id="LinkedIn"
        component={WebContentVideo as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={defaultFrames}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{
          ...defaultProps,
          format: 'linkedin' as const,
          brand: {
            ...defaultBrand,
            typography: { title: 64, subtitle: 36, body: 28 },
          },
        }}
        calculateMetadata={calcMetadata}
      />
      <Composition
        id="Square"
        component={WebContentVideo as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={defaultFrames}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{ ...defaultProps, format: 'square' as const }}
        calculateMetadata={calcMetadata}
      />
    </>
  );
};
