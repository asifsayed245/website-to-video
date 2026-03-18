'use client';

import { useState, useRef, useMemo } from 'react';
import { VOICE_OPTIONS } from '@/lib/config';
import type { VoiceOption } from '@/lib/types';

interface VoiceSelectorProps {
  selectedVoiceId: string;
  onSelect: (voiceId: string, lang: string) => void;
}

export function VoiceSelector({ selectedVoiceId, onSelect }: VoiceSelectorProps) {
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<Record<string, string>>({});
  const [previewError, setPreviewError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const grouped = useMemo(() =>
    VOICE_OPTIONS.reduce<Record<string, VoiceOption[]>>((acc, v) => {
      if (!acc[v.langLabel]) acc[v.langLabel] = [];
      acc[v.langLabel].push(v);
      return acc;
    }, {}),
  []);

  const handlePreview = async (voice: VoiceOption) => {
    if (previewUrl[voice.id]) {
      if (audioRef.current) {
        audioRef.current.src = previewUrl[voice.id];
        audioRef.current.play();
      }
      return;
    }

    setPreviewLoading(voice.id);
    setPreviewError(null);

    try {
      const res = await fetch('/api/voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId: voice.id, lang: voice.lang }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Preview failed');
      }

      const data = await res.json().catch(() => null);
      if (!data?.audioUrl) throw new Error('No audio returned');
      const { audioUrl } = data;
      setPreviewUrl((prev) => ({ ...prev, [voice.id]: audioUrl }));

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewLoading(null);
    }
  };

  return (
    <div className="glass-panel p-4">
      <h3 className="text-sm font-semibold text-warm-800 mb-3">Voice Artist</h3>

      {previewError && (
        <p className="text-xs text-red-500 mb-2">{previewError}</p>
      )}

      <audio ref={audioRef} className="hidden" />

      <div className="space-y-3">
        {Object.entries(grouped).map(([langLabel, voices]) => (
          <div key={langLabel}>
            <p className="text-xs text-warm-600 mb-1.5">{langLabel}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {voices.map((voice) => (
                <div
                  key={voice.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all ${
                    selectedVoiceId === voice.id
                      ? 'border-accent/50 bg-accent/10 text-warm-800'
                      : 'border-warm-200/40 bg-white/30 text-warm-600 hover:text-warm-800 hover:border-warm-300/60'
                  }`}
                  onClick={() => onSelect(voice.id, voice.lang)}
                >
                  <span className="text-xs">
                    {voice.gender === 'female' ? '\u2640' : '\u2642'}
                  </span>
                  <span className="text-sm flex-1">{voice.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreview(voice);
                    }}
                    disabled={previewLoading === voice.id}
                    className="text-xs px-2 py-0.5 rounded-lg bg-white/50 border border-warm-200/40 hover:border-warm-300/60 text-warm-600 hover:text-warm-700 transition disabled:opacity-50"
                    title="Preview this voice"
                  >
                    {previewLoading === voice.id ? (
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : previewUrl[voice.id] ? (
                      '\u25B6'
                    ) : (
                      '\u25B6 Try'
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-warm-600 mt-3">
        Click &quot;\u25B6 Try&quot; to hear a sample. Click a voice to select it.
      </p>
    </div>
  );
}
