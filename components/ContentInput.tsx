'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ContentStyle, VideoDuration, ScriptLanguage, AudioMode, VideoMode } from '@/lib/types';
import { VIDEO_DURATION_OPTIONS, SCRIPT_LANGUAGE_OPTIONS, AUDIO_MODE_OPTIONS, VIDEO_MODE_OPTIONS } from '@/lib/types';

interface ContentInputProps {
  onSubmit: (data: URLData | TopicData | PDFData) => void;
  isLoading: boolean;
  videoMode: VideoMode;
  onVideoModeChange: (mode: VideoMode) => void;
}

export interface URLData {
  mode: 'url';
  url: string;
  contentStyle: ContentStyle;
  targetDuration: VideoDuration;
  scriptLanguage: ScriptLanguage;
  audioMode: AudioMode;
}

export interface TopicData {
  mode: 'topic';
  topic: string;
  keywords: string[];
  audience: string;
  tone: 'professional' | 'casual' | 'educational' | 'inspirational';
  cta: string;
  contentStyle: ContentStyle;
  targetDuration: VideoDuration;
  scriptLanguage: ScriptLanguage;
  audioMode: AudioMode;
}

export interface PDFData {
  mode: 'pdf';
  file: File;
  contentStyle: ContentStyle;
  targetDuration: VideoDuration;
  scriptLanguage: ScriptLanguage;
  audioMode: AudioMode;
}

export function ContentInput({ onSubmit, isLoading, videoMode, onVideoModeChange }: ContentInputProps) {
  const [contentStyle, setContentStyle] = useState<ContentStyle>('business');
  const [targetDuration, setTargetDuration] = useState<VideoDuration>(60);
  const [scriptLanguage, setScriptLanguage] = useState<ScriptLanguage>('english');
  const [audioMode, setAudioMode] = useState<AudioMode>('narration');
  const [activeTab, setActiveTab] = useState<'url' | 'topic' | 'pdf'>('url');

  const [url, setUrl] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [topic, setTopic] = useState('');
  const [keywordsText, setKeywordsText] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState<TopicData['tone']>('professional');
  const [cta, setCta] = useState('');

  const isStory = contentStyle === 'story';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'url') {
      if (!url.trim()) return;
      onSubmit({ mode: 'url', url: url.trim(), contentStyle, targetDuration, scriptLanguage, audioMode });
    } else if (activeTab === 'pdf') {
      if (!pdfFile) return;
      onSubmit({ mode: 'pdf', file: pdfFile, contentStyle, targetDuration, scriptLanguage, audioMode });
    } else {
      if (!topic.trim()) return;
      if (!isStory && !keywordsText.trim()) return;
      onSubmit({
        mode: 'topic',
        topic: topic.trim(),
        keywords: keywordsText.split(',').map((k) => k.trim()).filter(Boolean),
        audience,
        tone,
        cta,
        contentStyle,
        targetDuration,
        scriptLanguage,
        audioMode,
      });
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Content Style Toggle */}
      <div className="glass-panel p-1 flex mb-4">
        {(['business', 'story'] as const).map((style) => (
          <button
            key={style}
            type="button"
            onClick={() => {
              setContentStyle(style);
              if (style === 'business') setAudioMode('narration');
            }}
            className={`relative flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              contentStyle === style
                ? 'text-white'
                : 'text-warm-600 hover:text-warm-700'
            }`}
          >
            {contentStyle === style && (
              <motion.div
                layoutId="style-bg"
                className={`absolute inset-0 rounded-lg ${
                  style === 'business'
                    ? 'bg-gradient-to-r from-accent to-amber-500'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500'
                }`}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">
              {style === 'business' ? 'Business / Informational' : 'Story / Narrative'}
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-warm-600 mb-4 text-center">
        {isStory
          ? 'Generate a short cinematic story video with narrative scenes'
          : 'Generate an informational video with key points and a CTA'}
      </p>

      {/* Duration Selector */}
      <div className="mb-5">
        <label className="block text-xs text-warm-600 mb-2 text-center font-medium">Video Duration</label>
        <div className="glass-panel p-1 flex gap-1">
          {VIDEO_DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTargetDuration(opt.value)}
              className={`relative flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                targetDuration === opt.value
                  ? 'text-white'
                  : 'text-warm-600 hover:text-warm-700'
              }`}
            >
              {targetDuration === opt.value && (
                <motion.div
                  layoutId="duration-bg"
                  className="absolute inset-0 rounded-lg bg-gradient-to-r from-accent to-amber-500"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Script Language Selector */}
      <div className="mb-5">
        <label className="block text-xs text-warm-600 mb-2 text-center font-medium">Script Language</label>
        <div className="glass-panel p-1 flex gap-1">
          {SCRIPT_LANGUAGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setScriptLanguage(opt.value)}
              className={`relative flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                scriptLanguage === opt.value
                  ? 'text-white'
                  : 'text-warm-600 hover:text-warm-700'
              }`}
            >
              {scriptLanguage === opt.value && (
                <motion.div
                  layoutId="lang-bg"
                  className="absolute inset-0 rounded-lg bg-gradient-to-r from-accent to-amber-500"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Audio Mode Selector */}
      <div className="mb-5">
        <label className="block text-xs text-warm-600 mb-2 text-center font-medium">Audio Mode</label>
        <div className="glass-panel p-1 flex gap-1">
          {AUDIO_MODE_OPTIONS
            .filter((opt) => opt.value === 'narration' || (isStory && videoMode === 'clips'))
            .map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAudioMode(opt.value)}
                className={`relative flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  audioMode === opt.value
                    ? 'text-white'
                    : 'text-warm-600 hover:text-warm-700'
                }`}
              >
                {audioMode === opt.value && (
                  <motion.div
                    layoutId="audio-bg"
                    className="absolute inset-0 rounded-lg bg-gradient-to-r from-accent to-amber-500"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{opt.label}</span>
              </button>
            ))}
        </div>
        <p className="text-xs text-warm-600 mt-1 text-center">
          {audioMode === 'narration' && 'Single voice narrates the video'}
          {audioMode === 'dialogue' && 'Characters speak their own lines with lip-sync'}
          {audioMode === 'both' && 'Narration + character dialogue combined'}
        </p>
      </div>

      {/* Video Mode Selector */}
      <div className="mb-5">
        <label className="block text-xs text-warm-600 mb-2 text-center font-medium">Video Mode</label>
        <div className="glass-panel p-1 flex gap-1">
          {VIDEO_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onVideoModeChange(opt.value)}
              className={`relative flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                videoMode === opt.value
                  ? 'text-white'
                  : 'text-warm-600 hover:text-warm-700'
              }`}
            >
              {videoMode === opt.value && (
                <motion.div
                  layoutId="vmode-bg"
                  className="absolute inset-0 rounded-lg bg-gradient-to-r from-accent to-amber-500"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{opt.label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-warm-600 mt-1 text-center">
          {videoMode === 'clips'
            ? 'AI-generated video clips with character motion'
            : 'AI images with Ken Burns motion effects'}
        </p>
      </div>

      {/* Input Mode Tabs */}
      <div className="glass-panel p-1 flex gap-1 mb-6">
        {(['url', 'topic', 'pdf'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`relative flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'text-white'
                : 'text-warm-600 hover:text-warm-700'
            }`}
          >
            {activeTab === tab && (
              <motion.div
                layoutId="tab-bg"
                className="absolute inset-0 rounded-lg bg-warm-700"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">
              {tab === 'url' ? 'From URL' : tab === 'topic' ? 'From Topic' : 'From PDF'}
            </span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'url' ? (
            <motion.div
              key="url"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <label className="block text-sm font-medium text-warm-700 mb-2">
                Website URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="glass-input w-full"
                required
              />
              <p className="mt-2 text-xs text-warm-600">
                {isStory
                  ? "We'll extract content and craft a narrative story video"
                  : "We'll extract content and turn it into a video with AI clips"}
              </p>
            </motion.div>
          ) : activeTab === 'pdf' ? (
            <motion.div
              key="pdf"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <label className="block text-sm font-medium text-warm-700 mb-2">Upload PDF</label>
              <label className="flex flex-col items-center justify-center w-full py-8 glass-panel border-2 border-dashed border-warm-300/50 cursor-pointer hover:border-accent/50 transition-colors">
                {pdfFile ? (
                  <div className="flex items-center gap-3 text-warm-700">
                    <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium">{pdfFile.name}</p>
                      <p className="text-xs text-warm-600">{(pdfFile.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setPdfFile(null); }}
                      className="ml-2 text-warm-600 hover:text-red-500 transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-warm-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm text-warm-600">Click to upload or drag and drop</p>
                    <p className="text-xs text-warm-600 mt-1">PDF up to 10MB</p>
                  </>
                )}
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 10 * 1024 * 1024) {
                        alert('File too large. Maximum size is 10MB.');
                        return;
                      }
                      setPdfFile(file);
                    }
                  }}
                />
              </label>
            </motion.div>
          ) : (
            <motion.div
              key="topic"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-warm-700 mb-2">Topic</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={isStory ? 'e.g., A Lost Astronaut, The Last Library' : 'e.g., AI in Healthcare'}
                  className="glass-input w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-warm-700 mb-2">
                  {isStory ? 'Story Themes (optional)' : 'Keywords'}
                </label>
                <input
                  type="text"
                  value={keywordsText}
                  onChange={(e) => setKeywordsText(e.target.value)}
                  placeholder={isStory ? 'adventure, mystery, hope' : 'diagnosis, patient care, efficiency'}
                  className="glass-input w-full"
                  required={!isStory}
                />
              </div>

              {!isStory && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-warm-700 mb-2">Target Audience</label>
                      <input
                        type="text"
                        value={audience}
                        onChange={(e) => setAudience(e.target.value)}
                        placeholder="e.g., Healthcare pros"
                        className="glass-input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-warm-700 mb-2">Tone</label>
                      <select
                        value={tone}
                        onChange={(e) => setTone(e.target.value as TopicData['tone'])}
                        className="glass-input w-full"
                      >
                        <option value="professional">Professional</option>
                        <option value="casual">Casual</option>
                        <option value="educational">Educational</option>
                        <option value="inspirational">Inspirational</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-warm-700 mb-2">Call to Action (optional)</label>
                    <input
                      type="text"
                      value={cta}
                      onChange={(e) => setCta(e.target.value)}
                      placeholder="e.g., Visit our website to learn more"
                      className="glass-input w-full"
                    />
                  </div>
                </>
              )}

              {isStory && (
                <div>
                  <label className="block text-sm font-medium text-warm-700 mb-2">Target Audience (optional)</label>
                  <input
                    type="text"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="e.g., Young adults, children"
                    className="glass-input w-full"
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={isLoading}
          className="glass-btn w-full py-3.5 px-6 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing...
            </span>
          ) : (
            isStory ? 'Generate Story Video' : 'Generate Video Content'
          )}
        </button>
      </form>
    </div>
  );
}
