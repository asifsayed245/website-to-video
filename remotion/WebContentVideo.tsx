import React from 'react';
import { AbsoluteFill, Series, Audio } from 'remotion';
import type { VideoCompositionProps } from './config/types';
import { HookSlide } from './components/HookSlide';
import { KeyPointSlide } from './components/KeyPointSlide';
import { CTASlide } from './components/CTASlide';
import { ProgressBar } from './components/ProgressBar';
import { Subtitles } from './components/Subtitles';

export const WebContentVideo: React.FC<VideoCompositionProps> = ({ format, scenes, brand, audioUrl, dialogueAudioUrls, audioMode }) => {
  let pointCounter = 0;

  // Determine if narration audio should play based on audioMode
  const showNarrationAudio = audioMode !== 'dialogue';
  const narrationVolume = audioMode === 'both' ? 0.7 : 1;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.colors.bg,
        fontFamily: brand.fonts.primary,
      }}
    >
      <ProgressBar format={format} accentColor={brand.colors.accent} />

      {/* Narration audio (for 'narration' and 'both' modes) */}
      {audioUrl && showNarrationAudio && <Audio src={audioUrl} volume={narrationVolume} />}

      {/* Dialogue audio tracks (for 'dialogue' and 'both' modes) */}
      {dialogueAudioUrls && Object.entries(dialogueAudioUrls).map(([charName, charAudioUrl]) => (
        <Audio key={`dialogue-${charName}`} src={charAudioUrl} volume={1} />
      ))}

      <Series>
        {scenes.map((scene) => {
          if (scene.type === 'key_point') pointCounter++;
          const currentPoint = pointCounter;

          // Build subtitle text: narration or dialogue
          const hasDialogue = scene.dialogue && scene.dialogue.length > 0;
          const subtitleText = hasDialogue && audioMode !== 'narration'
            ? scene.dialogue!.map((d) => `${d.speaker}: "${d.text}"`).join(' ')
            : scene.narration;

          return (
            <Series.Sequence key={scene.id} durationInFrames={Math.round(scene.durationSeconds * 30)}>
              {scene.type === 'hook' && (
                <HookSlide scene={scene} format={format} brand={brand} />
              )}
              {scene.type === 'key_point' && (
                <KeyPointSlide
                  scene={scene}
                  format={format}
                  brand={brand}
                  pointNumber={currentPoint}
                />
              )}
              {scene.type === 'cta' && (
                <CTASlide scene={scene} format={format} brand={brand} />
              )}

              {subtitleText && (
                <Subtitles narration={subtitleText} format={format} brand={brand} />
              )}
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
