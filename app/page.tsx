'use client';

import { useState, useEffect, useRef, Component, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import type {
  PipelineStep,
  StructuredContent,
  VideoScript,
  AssetJob,
  CameraDirection,
  RenderFormat,
  ContentStyle,
  VideoDuration,
  AudioMode,
  VideoMode,
} from '@/lib/types';
import { calculateSceneDurations } from '@/lib/audio-timing';
import { ContentInput, type URLData, type TopicData, type PDFData } from '@/components/ContentInput';
import { ScriptEditor } from '@/components/ScriptEditor';
import { AssetGallery } from '@/components/AssetGallery';

/** Fetch with AbortController timeout. Returns a descriptive error on failure. */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 120_000,
  label = 'Request',
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s. Please try again.`);
    }
    // "Failed to fetch" → friendlier message
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'Failed to fetch') {
      throw new Error(`${label} failed — server may be busy or not responding. Please try again.`);
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}
import { VideoPreview } from '@/components/VideoPreview';
import { DownloadPanel } from '@/components/DownloadPanel';
import { ProgressTracker } from '@/components/ProgressTracker';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 m-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <h3 className="font-bold mb-2">Render Error</h3>
          <pre className="text-xs whitespace-pre-wrap">{this.state.error.message}</pre>
          <pre className="text-xs whitespace-pre-wrap mt-2 text-red-500">{this.state.error.stack}</pre>
          <button onClick={() => this.setState({ error: null })} className="mt-3 px-4 py-2 bg-red-100 rounded-lg text-sm">
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Home() {
  const [step, setStep] = useState<PipelineStep>('input');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<StructuredContent | null>(null);
  const [script, setScript] = useState<VideoScript | null>(null);
  const [jobs, setJobs] = useState<AssetJob[]>([]);
  const [polling, setPolling] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderFiles, setRenderFiles] = useState<string[]>([]);
  const [contentStyle, setContentStyle] = useState<ContentStyle>('business');
  const [targetDuration, setTargetDuration] = useState<VideoDuration>(60);
  const [videoMode, setVideoMode] = useState<VideoMode>('clips');
  const [audioMode, setAudioMode] = useState<AudioMode>('narration');

  const [isRegenerating, setIsRegenerating] = useState(false);

  // New state for clip generation
  const [clipJobs, setClipJobs] = useState<AssetJob[]>([]);
  const [clipPolling, setClipPolling] = useState(false);
  const [cameraDirections, setCameraDirections] = useState<CameraDirection[]>([]);

  // Refs for polling (avoid stale closures)
  const jobsRef = useRef<AssetJob[]>([]);
  const pollingRef = useRef(false);
  const scriptRef = useRef<VideoScript | null>(null);
  const clipJobsRef = useRef<AssetJob[]>([]);
  const clipPollingRef = useRef(false);

  useEffect(() => { jobsRef.current = jobs; }, [jobs]);
  useEffect(() => { pollingRef.current = polling; }, [polling]);
  useEffect(() => { scriptRef.current = script; }, [script]);
  useEffect(() => { clipJobsRef.current = clipJobs; }, [clipJobs]);
  useEffect(() => { clipPollingRef.current = clipPolling; }, [clipPolling]);

  const handleVideoModeChange = (mode: VideoMode) => {
    setVideoMode(mode);
    if (mode === 'images') {
      setAudioMode('narration');
    }
  };

  // Step 1: Handle content input
  const handleContentSubmit = async (data: URLData | TopicData | PDFData) => {
    setIsLoading(true);
    setError(null);

    const style = data.contentStyle || 'business';
    const duration = data.targetDuration || 60;
    const lang = data.scriptLanguage || 'english';
    const aMode = data.audioMode || 'narration';
    setContentStyle(style);
    setTargetDuration(duration);

    const refImages = 'referenceImages' in data ? data.referenceImages : undefined;

    try {
      let contentRes: Response;

      if (data.mode === 'pdf') {
        const formData = new FormData();
        formData.append('file', data.file);
        formData.append('contentStyle', style);
        formData.append('targetDuration', String(duration));
        formData.append('scriptLanguage', lang);
        formData.append('audioMode', aMode);
        if (refImages?.length) {
          formData.append('referenceImages', JSON.stringify(refImages));
        }

        contentRes = await fetchWithTimeout('/api/parse-pdf', {
          method: 'POST',
          body: formData,
        }, 120_000, 'PDF processing');
      } else {
        const endpoint = data.mode === 'url' ? '/api/scrape' : '/api/research';
        const body = data.mode === 'url'
          ? { url: data.url, targetDuration: duration, contentStyle: style, scriptLanguage: lang, audioMode: aMode, referenceImages: refImages }
          : data;

        contentRes = await fetchWithTimeout(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }, 120_000, 'Content research');
      }

      if (!contentRes.ok) {
        const err = await contentRes.json().catch(() => ({}));
        throw new Error((err as Record<string, string>).error || 'Failed to process content');
      }

      const contentData: StructuredContent = await contentRes.json();
      // Attach reference images to content so they flow through to script
      if (refImages?.length) contentData.referenceImages = refImages;
      setContent(contentData);

      const scriptRes = await fetchWithTimeout('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: contentData, contentStyle: style, targetDuration: duration, scriptLanguage: lang, audioMode: aMode }),
      }, 30_000, 'Script generation');

      if (!scriptRes.ok) {
        const err = await scriptRes.json().catch(() => ({}));
        throw new Error((err as Record<string, string>).error || 'Failed to generate script');
      }

      const scriptData: VideoScript = await scriptRes.json();
      // Carry reference images onto the script for image generation
      if (refImages?.length) scriptData.referenceImages = refImages;
      setScript(scriptData);
      setStep('script');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Generate assets from script
  const handleGenerateAssets = async () => {
    if (!script) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetchWithTimeout('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...script, targetDuration }),
      }, 300_000, 'Asset generation');

      let data: Record<string, unknown>;
      try {
        data = await res.json();
      } catch {
        throw new Error('Server returned an empty response. Please try again.');
      }

      if (!res.ok) {
        setError((data.error as string) || 'Some jobs failed');
        if (data.jobs) {
          setJobs(data.jobs as AssetJob[]);
          setStep('generating');
        }
        return;
      }

      const newJobs = data.jobs as AssetJob[];
      setJobs(newJobs);

      const errs = data.errors as string[] | undefined;
      if (errs?.length) {
        setError(`${errs.length} jobs failed during submission. Others are processing.`);
      }

      const hasProcessing = newJobs.some((j) => j.status === 'processing');
      if (hasProcessing) {
        setStep('generating');
        setPolling(true);
      } else {
        // All instant — go to clip generation
        await startClipGeneration(newJobs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Generate video clips from images
  const startClipGeneration = async (currentJobs?: AssetJob[]) => {
    // Skip clip generation entirely in images-only mode
    if (videoMode === 'images') {
      setStep('preview');
      return;
    }

    const finalJobs = currentJobs || jobs;
    const currentScript = scriptRef.current || script;

    if (!currentScript) {
      setStep('preview');
      return;
    }

    // Check if we have image jobs to convert
    const doneImageJobs = finalJobs.filter((j) => j.type === 'image' && j.status === 'done');
    if (doneImageJobs.length === 0) {
      setStep('preview');
      return;
    }

    setStep('generating_clips');
    setError(null);

    try {
      const res = await fetchWithTimeout('/api/generate-clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: currentScript,
          jobs: finalJobs,
          clipModel: currentScript.clipModel,
          clipResolution: currentScript.clipResolution,
          clipDuration: currentScript.clipDuration,
          audioMode: currentScript.audioMode,
        }),
      }, 120_000, 'Clip generation');

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errorMsg = (err as Record<string, string>).error || 'Clip generation failed';
        // Non-fatal: skip to preview with static images
        console.error('Clip generation failed:', errorMsg);
        setError(`Clip generation skipped: ${errorMsg}. Using static images.`);
        setStep('preview');
        return;
      }

      const data = await res.json();
      const newClipJobs = data.clipJobs as AssetJob[];
      const directions = data.cameraDirections as CameraDirection[];
      const clipErrors = data.errors as string[] | undefined;

      setClipJobs(newClipJobs);
      setCameraDirections(directions);

      // Show clip submission errors if any
      if (clipErrors?.length) {
        console.error('Clip generation errors:', clipErrors);
        const failCount = newClipJobs.filter((j) => j.status === 'failed').length;
        if (failCount === newClipJobs.length) {
          setError(`All ${failCount} clip submissions failed: ${clipErrors[0]}. Using static images.`);
          setStep('preview');
          return;
        } else {
          setError(`${failCount} clip(s) failed. Remaining clips are processing.`);
        }
      }

      const hasProcessing = newClipJobs.some((j) => j.status === 'processing');
      if (hasProcessing) {
        setClipPolling(true);
      } else {
        setStep('preview');
      }
    } catch (err) {
      console.error('Clip generation error:', err);
      setError('Clip generation failed. Using static images.');
      setStep('preview');
    }
  };

  const handleSkipClips = () => {
    setClipPolling(false);
    setStep('preview');
  };

  // Poll for asset completion (images + audio)
  useEffect(() => {
    if (!polling) return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled || !pollingRef.current || jobsRef.current.length === 0) return;

      try {
        const res = await fetch('/api/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobs: jobsRef.current }),
        });

        if (!res.ok || cancelled) return;

        const { jobs: updated, allDone } = await res.json();
        if (cancelled) return;

        setJobs(updated);

        if (allDone) {
          setPolling(false);

          // Get actual audio duration
          const currentScript = scriptRef.current;
          const audioJob = updated.find((j: AssetJob) => j.type === 'audio' && j.status === 'done');

          if (currentScript && audioJob?.resultUrl) {
            try {
              const durRes = await fetch('/api/audio-duration', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: audioJob.resultUrl }),
              });

              if (durRes.ok) {
                const { duration: actualDuration } = await durRes.json();
                const updatedScenes = calculateSceneDurations(
                  currentScript.scenes,
                  actualDuration
                );
                setScript({
                  ...currentScript,
                  scenes: updatedScenes,
                  totalDurationSeconds: updatedScenes.reduce((s, sc) => s + sc.durationSeconds, 0),
                });
              }
            } catch {
              // Keep estimated durations
            }
          }

          // After assets are done, start clip generation
          await startClipGeneration(updated);
        }
      } catch {
        // Silently retry on next poll
      }
    };

    const initialTimeout = setTimeout(poll, 5000);
    const interval = setInterval(poll, 10000);

    return () => {
      cancelled = true;
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling]);

  // Poll for clip completion (video clips from kie.ai)
  useEffect(() => {
    if (!clipPolling) return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled || !clipPollingRef.current || clipJobsRef.current.length === 0) return;

      try {
        const res = await fetch('/api/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobs: clipJobsRef.current }),
        });

        if (!res.ok || cancelled) return;

        const { jobs: updated, allDone } = await res.json();
        if (cancelled) return;

        setClipJobs(updated);

        if (allDone) {
          setClipPolling(false);
          setStep('preview');
        }
      } catch {
        // Silently retry
      }
    };

    const initialTimeout = setTimeout(poll, 30000); // First poll after 30s (clips take ~2-3 min)
    const interval = setInterval(poll, 20000); // Then every 20s

    return () => {
      cancelled = true;
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [clipPolling]);

  // Render videos
  const handleRender = async (format: RenderFormat) => {
    setRendering(true);
    setError(null);
    setRenderFiles([]);

    try {
      const res = await fetchWithTimeout('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          scenes: script?.scenes || [],
          jobs: [...jobs, ...clipJobs],
          audioMode: script?.audioMode || 'narration',
        }),
      }, 300_000, 'Video render');

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Render failed');
      }

      const data = await res.json();
      if (data.files) {
        setRenderFiles(data.files);
        setStep('done');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Render failed');
    } finally {
      setRendering(false);
    }
  };

  // Regenerate a single image
  const handleRegenerateImage = async (job: AssetJob, description: string) => {
    if (!script) return;
    setIsRegenerating(true);
    try {
      const scene = script.scenes.find((s) => s.id === job.sceneId);

      // Gather neighboring frame URLs for visual consistency context
      const imageJobs = jobs.filter((j) => j.type === 'image' && j.status === 'done' && j.resultUrl);
      const jobIndex = imageJobs.findIndex((j) => j.id === job.id);
      const prevImageUrl = jobIndex > 0 ? imageJobs[jobIndex - 1].resultUrl : undefined;
      const nextImageUrl = jobIndex < imageJobs.length - 1 ? imageJobs[jobIndex + 1].resultUrl : undefined;

      const res = await fetchWithTimeout('/api/regenerate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          sceneId: job.sceneId,
          originalPrompt: scene?.brollPrompt || '',
          changeDescription: description,
          imageStyle: script.imageStyle,
          imageInstruction: script.imageInstruction,
          referenceImages: script.referenceImages,
          currentImageUrl: job.resultUrl,
          neighborImageUrls: [prevImageUrl, nextImageUrl].filter(Boolean),
        }),
      }, 120_000, 'Image regeneration');

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>).error || 'Regeneration failed');
      }

      const data = await res.json();
      // Update the job in state with the new resultUrl
      setJobs((prev) =>
        prev.map((j) => j.id === job.id ? { ...j, resultUrl: data.resultUrl } : j)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image regeneration failed');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Reorder image jobs (drag-and-drop)
  const handleJobsReorder = (reorderedImageJobs: AssetJob[]) => {
    // Replace image jobs while preserving audio jobs
    setJobs((prev) => {
      const nonImageJobs = prev.filter((j) => j.type !== 'image');
      return [...reorderedImageJobs, ...nonImageJobs];
    });
  };

  // Reset
  const handleReset = () => {
    setStep('input');
    setContent(null);
    setScript(null);
    setJobs([]);
    setClipJobs([]);
    setCameraDirections([]);
    setError(null);
    setPolling(false);
    setClipPolling(false);
    setRendering(false);
    setIsRegenerating(false);
    setRenderFiles([]);
    setContentStyle('business');
    setTargetDuration(60);
    setVideoMode('clips');
    setAudioMode('narration');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-warm-100 via-warm-200 to-warm-300">
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-lg bg-white/50 border-b border-warm-200/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gradient">Website to Video</h1>
            <p className="text-xs text-warm-600">AI Video Content Generator</p>
          </div>
          {step !== 'input' && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleReset}
              className="glass-btn-secondary text-sm px-4 py-2"
            >
              Start Over
            </motion.button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <ErrorBoundary>
        <ProgressTracker currentStep={step} videoMode={videoMode} />

        {/* Error display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-2xl text-red-600 text-sm max-w-2xl mx-auto">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 underline hover:text-red-500 font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Step 1: Content Input */}
        {step === 'input' && (
          <div className="mt-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-warm-800 mb-2">
                Create AI Video Content
              </h2>
              <p className="text-warm-600">
                Paste a URL, enter a topic, or upload a PDF to generate videos with AI clips
              </p>
            </div>
            <div className="glass-card p-6 max-w-2xl mx-auto">
              <ContentInput onSubmit={handleContentSubmit} isLoading={isLoading} videoMode={videoMode} onVideoModeChange={handleVideoModeChange} />
            </div>
          </div>
        )}

        {/* Step 2: Script Editor */}
        {step === 'script' && script && (
          <ScriptEditor
            script={script}
            onUpdate={setScript}
            onConfirm={handleGenerateAssets}
            isLoading={isLoading}
            contentStyle={contentStyle}
            videoMode={videoMode}
          />
        )}

        {/* Step 3: Asset Generation */}
        {step === 'generating' && (
          <AssetGallery
            jobs={jobs}
            onRegenerateImage={handleRegenerateImage}
            isRegenerating={isRegenerating}
            onJobsReorder={handleJobsReorder}
          />
        )}

        {/* Step 3.5: Clip Generation */}
        {step === 'generating_clips' && (
          <AssetGallery
            jobs={jobs}
            clipJobs={clipJobs}
            cameraDirections={cameraDirections}
            isClipStage
            onSkipClips={handleSkipClips}
          />
        )}

        {/* Step 4 & 5: Preview + Download */}
        {(step === 'preview' || step === 'done') && script && (
          <div className="space-y-6">
            <VideoPreview script={script} jobs={jobs} clipJobs={clipJobs} />
            <DownloadPanel
              jobs={jobs}
              clipJobs={clipJobs}
              onRender={handleRender}
              rendering={rendering}
              renderFiles={renderFiles}
              onRegenerateImage={handleRegenerateImage}
              isRegenerating={isRegenerating}
              onJobsReorder={handleJobsReorder}
            />
          </div>
        )}
        </ErrorBoundary>
      </div>
    </main>
  );
}
