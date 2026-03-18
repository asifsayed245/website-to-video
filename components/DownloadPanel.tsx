'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { PLATFORMS, type AssetJob, type VideoFormat, type RenderFormat } from '@/lib/types';

interface DownloadPanelProps {
  jobs: AssetJob[];
  clipJobs?: AssetJob[];
  onRender: (format: RenderFormat) => void;
  rendering: boolean;
  renderFiles?: string[];
}

const FORMAT_BUTTONS = (Object.keys(PLATFORMS) as VideoFormat[]).map((key) => ({
  key,
  label: PLATFORMS[key].name,
  dims: `${PLATFORMS[key].width}x${PLATFORMS[key].height}`,
}));

function getVideoUrl(file: string): string {
  const basename = file.split('/').pop() || file;
  return `/api/video?file=${encodeURIComponent(basename)}`;
}

function getVideoLabel(file: string): string {
  for (const key of Object.keys(PLATFORMS) as VideoFormat[]) {
    if (file.includes(key)) return PLATFORMS[key].name;
  }
  return file;
}

export function DownloadPanel({ jobs, clipJobs = [], onRender, rendering, renderFiles = [] }: DownloadPanelProps) {
  const { completedImages, completedAudio, completedClips, failedJobs } = useMemo(() => ({
    completedImages: jobs.filter((j) => j.type === 'image' && j.status === 'done'),
    completedAudio: jobs.filter((j) => j.type === 'audio' && j.status === 'done'),
    completedClips: clipJobs.filter((j) => j.type === 'video' && j.status === 'done'),
    failedJobs: [...jobs, ...clipJobs].filter((j) => j.status === 'failed'),
  }), [jobs, clipJobs]);
  const hasAssets = completedImages.length > 0 || completedAudio.length > 0;
  const [showAssets, setShowAssets] = useState(false);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  const videoFiles = renderFiles.filter((f) => f.endsWith('.mp4'));
  const previewFile = activeVideo || (videoFiles.length > 0 ? videoFiles[0] : null);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h2 className="text-lg font-bold text-warm-800 mb-4">Export</h2>

      <div className="space-y-3">
        {/* Rendering progress */}
        {rendering && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-5 border-accent/30"
          >
            <div className="flex items-center gap-3 mb-3">
              <svg className="animate-spin h-5 w-5 text-accent" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-warm-800">Rendering Videos...</h3>
                <p className="text-xs text-warm-600">This may take a few minutes.</p>
              </div>
            </div>
            <div className="w-full h-2 bg-warm-200/50 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-accent to-amber-500 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </motion.div>
        )}

        {/* Video preview player */}
        {previewFile && !rendering && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-5 border-emerald-400/30"
          >
            <h3 className="text-sm font-semibold text-emerald-600 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Video Preview
            </h3>

            {videoFiles.length > 1 && (
              <div className="flex gap-2 mb-3">
                {videoFiles.map((file) => {
                  const label = getVideoLabel(file);
                  return (
                    <button
                      key={file}
                      onClick={() => setActiveVideo(file)}
                      className={`px-3 py-1 rounded-lg text-xs transition ${
                        previewFile === file
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-400/30'
                          : 'bg-white/30 text-warm-600 hover:text-warm-700 border border-warm-200/40'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="rounded-xl overflow-hidden bg-warm-900 flex items-center justify-center">
              <video
                key={previewFile}
                controls
                className="max-h-[500px] w-auto mx-auto"
                src={getVideoUrl(previewFile)}
              >
                Your browser does not support video playback.
              </video>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-warm-600">{previewFile}</span>
              <a
                href={getVideoUrl(previewFile)}
                download={previewFile.split('/').pop()}
                className="text-xs text-accent hover:text-accent-dark flex items-center gap-1 font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download MP4
              </a>
            </div>
          </motion.div>
        )}

        {/* Render buttons */}
        {!rendering && (
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-warm-800 mb-1">
              {renderFiles.length > 0 ? 'Re-render Videos' : 'Render Videos'}
            </h3>
            <p className="text-xs text-warm-600 mb-4">
              {hasAssets
                ? 'Render platform-optimized MP4 videos from your generated assets.'
                : 'No assets available. Start over and generate assets first.'}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {FORMAT_BUTTONS.map((fmt) => (
                <button
                  key={fmt.key}
                  onClick={() => onRender(fmt.key)}
                  disabled={!hasAssets}
                  className="flex items-center justify-between glass-panel px-4 py-3 text-sm text-warm-600 hover:text-warm-800 hover:border-accent/30 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="font-medium">{fmt.label}</span>
                  <span className="text-xs text-warm-600">{fmt.dims}</span>
                </button>
              ))}
              <button
                onClick={() => onRender('all')}
                disabled={!hasAssets}
                className="glass-btn flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Render All Formats
              </button>
            </div>
          </div>
        )}

        {/* Asset summary */}
        <div className="glass-panel p-4">
          <button
            onClick={() => setShowAssets(!showAssets)}
            className="w-full flex items-center justify-between text-sm"
          >
            <span className="text-warm-700 font-semibold">Generated Assets</span>
            <span className="text-xs text-warm-600">
              {completedImages.length} images, {completedAudio.length} audio
              {completedClips.length > 0 && `, ${completedClips.length} clips`}
              {failedJobs.length > 0 && (
                <span className="text-red-500"> ({failedJobs.length} failed)</span>
              )}
              <span className="ml-2">{showAssets ? '\u25B2' : '\u25BC'}</span>
            </span>
          </button>

          {showAssets && (
            <div className="mt-3 space-y-3">
              {completedImages.length > 0 && (
                <div>
                  <h4 className="text-xs text-warm-600 mb-2 font-medium">Images</h4>
                  <div className="grid grid-cols-5 gap-2">
                    {completedImages.map((job) => (
                      <a
                        key={job.id}
                        href={job.resultUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-video rounded-lg overflow-hidden border border-warm-200/40 hover:border-accent/50 transition"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={job.resultUrl} alt={job.sceneId} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {completedClips.length > 0 && (
                <div>
                  <h4 className="text-xs text-warm-600 mb-2 font-medium">Video Clips</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {completedClips.map((job) => (
                      <div key={job.id} className="aspect-video rounded-lg overflow-hidden border border-warm-200/40">
                        <video
                          src={job.resultUrl}
                          className="w-full h-full object-cover"
                          muted
                          loop
                          autoPlay
                          playsInline
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {completedAudio.length > 0 && (
                <div>
                  <h4 className="text-xs text-warm-600 mb-2 font-medium">Audio</h4>
                  <div className="space-y-1.5">
                    {completedAudio.map((job) => (
                      <div key={job.id} className="flex items-center gap-3 bg-white/30 rounded-lg px-3 py-2">
                        <span className="text-xs text-warm-600 w-16 shrink-0">{job.sceneId}</span>
                        <audio controls className="flex-1 h-8" src={job.resultUrl} />
                        <a
                          href={job.resultUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-accent hover:text-accent-dark font-medium"
                        >
                          Download
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {completedImages.length === 0 && completedAudio.length === 0 && (
                <p className="text-xs text-warm-600">
                  No assets were generated successfully. Try &quot;Start Over&quot; and generate again.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
