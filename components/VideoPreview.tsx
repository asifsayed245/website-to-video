'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { PLATFORMS, type VideoScript, type AssetJob, type VideoFormat } from '@/lib/types';

interface VideoPreviewProps {
  script: VideoScript;
  jobs: AssetJob[];
  clipJobs?: AssetJob[];
}

const formats = (Object.keys(PLATFORMS) as VideoFormat[]).map((key) => {
  const p = PLATFORMS[key];
  return { key, label: p.name, aspect: p.aspect, dims: `${p.width}x${p.height}` };
});

export function VideoPreview({ script, jobs, clipJobs = [] }: VideoPreviewProps) {
  const [activeFormat, setActiveFormat] = useState<VideoFormat>('reel');

  const imageJobs = jobs.filter((j) => j.type === 'image' && j.status === 'done');
  const videoClipJobs = clipJobs.filter((j) => j.type === 'video' && j.status === 'done');
  const currentFormat = formats.find((f) => f.key === activeFormat)!;

  const scenesWithAssets = script.scenes.map((scene) => {
    const imageJob = imageJobs.find((j) => j.sceneId === scene.id);
    const clipJob = videoClipJobs.find((j) => j.sceneId === scene.id);
    return { ...scene, imageUrl: imageJob?.resultUrl, videoUrl: clipJob?.resultUrl };
  });

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-warm-800">Preview</h2>
        <span className="glass-badge text-xs">{currentFormat.dims}</span>
      </div>

      {/* Format selector */}
      <div className="flex gap-2 mb-4">
        {formats.map((fmt) => (
          <button
            key={fmt.key}
            onClick={() => setActiveFormat(fmt.key)}
            className={`relative px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeFormat === fmt.key
                ? 'text-white'
                : 'text-warm-600 hover:text-warm-700 bg-white/30'
            }`}
          >
            {activeFormat === fmt.key && (
              <motion.div
                layoutId="format-bg"
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent to-amber-500"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{fmt.label}</span>
          </button>
        ))}
      </div>

      {/* Storyboard preview */}
      <div className="glass-card overflow-auto max-h-[600px]">
        <div className="grid grid-cols-2 gap-0.5 bg-warm-200/30">
          {scenesWithAssets.map((scene) => (
            <div
              key={scene.id}
              className="relative overflow-hidden bg-warm-100/50"
              style={{ aspectRatio: currentFormat.aspect }}
            >
              {scene.videoUrl ? (
                <video
                  src={scene.videoUrl}
                  className="absolute inset-0 w-full h-full object-cover opacity-70"
                  muted
                  loop
                  autoPlay
                  playsInline
                />
              ) : scene.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={scene.imageUrl}
                  alt={scene.textOverlay}
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-2 left-3 right-3">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] text-accent font-semibold uppercase tracking-wide">
                    {scene.type.replace('_', ' ')} &middot; {Math.round(scene.durationSeconds * 10) / 10}s
                  </span>
                  {scene.videoUrl && (
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                      clip
                    </span>
                  )}
                </div>
                <p className="text-xs text-white font-medium leading-tight">
                  {scene.textOverlay}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-warm-600 text-center">
        {scenesWithAssets.length} scenes &middot;{' '}
        {videoClipJobs.length > 0 && `${videoClipJobs.length} video clips &middot; `}
        Scroll down to render the final video.
      </p>
    </div>
  );
}
