'use client';

import { motion } from 'framer-motion';
import type { VideoScript, Scene, ContentStyle, VideoMode, KieModel, ClipResolution, DialogueLine } from '@/lib/types';
import { IMAGE_STYLE_OPTIONS, KIE_MODEL_OPTIONS } from '@/lib/types';
import { wordCount } from '@/lib/utils';
import { VoiceSelector } from './VoiceSelector';

interface ScriptEditorProps {
  script: VideoScript;
  onUpdate: (script: VideoScript) => void;
  onConfirm: () => void;
  isLoading?: boolean;
  contentStyle?: ContentStyle;
  videoMode?: VideoMode;
}

function ClipSettings({ script, onUpdate }: { script: VideoScript; onUpdate: (s: VideoScript) => void }) {
  const selectedModel = KIE_MODEL_OPTIONS.find((m) => m.value === script.clipModel) || KIE_MODEL_OPTIONS[0];
  const hasResolutions = selectedModel.resolutions.length > 0;
  const hasDurations = selectedModel.durations.length > 0;

  const handleModelChange = (model: KieModel) => {
    const modelOpt = KIE_MODEL_OPTIONS.find((m) => m.value === model)!;
    onUpdate({
      ...script,
      clipModel: model,
      // Reset resolution to first available or undefined
      clipResolution: modelOpt.resolutions[0] || undefined,
      clipDuration: modelOpt.defaultDuration,
    });
  };

  return (
    <div className="glass-panel p-4 mb-4">
      <label className="block text-xs text-warm-600 mb-3 font-medium">Video Clip Generation</label>

      {/* Model Selector */}
      <div className="mb-3">
        <label className="block text-[11px] text-warm-600 mb-1.5">AI Model</label>
        <div className="flex flex-wrap gap-1.5">
          {KIE_MODEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleModelChange(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                (script.clipModel || KIE_MODEL_OPTIONS[0].value) === opt.value
                  ? 'bg-accent text-white border-accent shadow-sm shadow-accent/20'
                  : 'bg-white/40 text-warm-600 border-warm-200/40 hover:text-warm-800 hover:border-warm-300/60'
              }`}
            >
              {opt.label}
              {opt.soundSupported && script.audioMode && script.audioMode !== 'narration' && (
                <span className="ml-1 text-[10px] text-emerald-500">Sound</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Resolution Selector — only shown if the selected model supports it */}
      {hasResolutions && (
        <div className="mb-3">
          <label className="block text-[11px] text-warm-600 mb-1.5">Clip Resolution</label>
          <div className="flex gap-1.5">
            {selectedModel.resolutions.map((res) => (
              <button
                key={res}
                type="button"
                onClick={() => onUpdate({ ...script, clipResolution: res })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  (script.clipResolution || selectedModel.resolutions[0]) === res
                    ? 'bg-warm-700 text-white border-warm-700'
                    : 'bg-white/40 text-warm-600 border-warm-200/40 hover:text-warm-800 hover:border-warm-300/60'
                }`}
              >
                {res}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Duration Selector — only shown if model has configurable durations */}
      {hasDurations && (
        <div>
          <label className="block text-[11px] text-warm-600 mb-1.5">Clip Duration</label>
          <div className="flex gap-1.5">
            {selectedModel.durations.map((dur) => (
              <button
                key={dur}
                type="button"
                onClick={() => onUpdate({ ...script, clipDuration: dur })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  (script.clipDuration || selectedModel.defaultDuration) === dur
                    ? 'bg-warm-700 text-white border-warm-700'
                    : 'bg-white/40 text-warm-600 border-warm-200/40 hover:text-warm-800 hover:border-warm-300/60'
                }`}
              >
                {dur}s
              </button>
            ))}
          </div>
        </div>
      )}

      {!hasResolutions && !hasDurations && (
        <p className="text-[11px] text-warm-600">This model uses default resolution and duration.</p>
      )}
    </div>
  );
}

export function ScriptEditor({ script, onUpdate, onConfirm, isLoading, contentStyle = 'business', videoMode = 'clips' }: ScriptEditorProps) {
  const updateScene = (index: number, field: keyof Scene, value: string | number) => {
    const scenes = script.scenes.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    );

    if (field === 'narration') {
      scenes[index] = {
        ...scenes[index],
        wordCount: wordCount(String(value)),
      };
      const fullNarration = scenes.map((s) => s.narration).join(' ');
      onUpdate({ ...script, scenes, fullNarration });
    } else {
      onUpdate({ ...script, scenes });
    }
  };

  const handleVoiceSelect = (voiceId: string, lang: string) => {
    onUpdate({ ...script, voiceId, voiceLang: lang });
  };

  const sceneTypeLabel = (type: Scene['type']) => {
    if (contentStyle === 'story') {
      switch (type) {
        case 'hook': return 'Opening';
        case 'key_point': return 'Scene';
        case 'cta': return 'Conclusion';
      }
    }
    switch (type) {
      case 'hook': return 'Hook';
      case 'key_point': return 'Key Point';
      case 'cta': return 'Call to Action';
    }
  };

  const sceneTypeColor = (type: Scene['type']) => {
    switch (type) {
      case 'hook': return 'bg-purple-500/10 text-purple-600 border-purple-300/40';
      case 'key_point': return 'bg-accent/10 text-accent-dark border-accent/30';
      case 'cta': return 'bg-emerald-500/10 text-emerald-600 border-emerald-300/40';
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-warm-800">
          {contentStyle === 'story' ? 'Story Script' : 'Video Script'}
        </h2>
        <span className="glass-badge text-xs">
          {Math.round(script.totalDurationSeconds)}s total &middot; {script.scenes.length} scenes
          {script.audioMode && script.audioMode !== 'narration' && (
            <> &middot; {script.audioMode === 'dialogue' ? 'Dialogue' : 'Narration + Dialogue'}</>
          )}
        </span>
      </div>

      {/* Voice Selector — hidden in dialogue-only mode (no narration to voice) */}
      {script.audioMode !== 'dialogue' && (
        <div className="mb-4">
          <VoiceSelector
            selectedVoiceId={script.voiceId}
            onSelect={handleVoiceSelect}
          />
        </div>
      )}

      {/* Image Style Selector */}
      <div className="glass-panel p-4 mb-4">
        <label className="block text-xs text-warm-600 mb-2 font-medium">Image Style</label>
        <div className="space-y-2">
          {(['Realistic', '2D', '3D', 'Artistic'] as const).map((group) => (
            <div key={group} className="flex items-center gap-2">
              <span className="text-xs text-warm-600 w-14 shrink-0">{group}</span>
              <div className="flex flex-wrap gap-1.5">
                {IMAGE_STYLE_OPTIONS.filter((o) => o.group === group).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onUpdate({ ...script, imageStyle: opt.value })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      (script.imageStyle || 'realistic') === opt.value
                        ? 'bg-accent text-white border-accent shadow-sm shadow-accent/20'
                        : 'bg-white/40 text-warm-600 border-warm-200/40 hover:text-warm-800 hover:border-warm-300/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Image Instructions */}
      <div className="glass-panel p-4 mb-4">
        <label className="block text-xs text-warm-600 mb-2 font-medium">Image Instructions (optional)</label>
        <textarea
          value={script.imageInstruction || ''}
          onChange={(e) => onUpdate({ ...script, imageInstruction: e.target.value })}
          rows={2}
          placeholder="e.g., Use dark moody tones, include nature elements, make it look like a retro film..."
          className="glass-input w-full resize-none"
        />
        <p className="mt-1 text-xs text-warm-600">Applied to all generated images</p>
      </div>

      {/* Video Clip Settings — hidden in images-only mode */}
      {videoMode === 'clips' && <ClipSettings script={script} onUpdate={onUpdate} />}

      <div className="space-y-3">
        {script.scenes.map((scene, i) => (
          <motion.div
            key={scene.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${sceneTypeColor(scene.type)}`}>
                {sceneTypeLabel(scene.type)}
              </span>
              <span className="text-xs text-warm-600">{Math.round(scene.durationSeconds)}s</span>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-xs text-warm-600 mb-1">Text Overlay</label>
                <input
                  type="text"
                  value={scene.textOverlay}
                  onChange={(e) => updateScene(i, 'textOverlay', e.target.value)}
                  className="glass-input w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-warm-600 mb-1">Narration</label>
                <textarea
                  value={scene.narration}
                  onChange={(e) => updateScene(i, 'narration', e.target.value)}
                  rows={2}
                  className="glass-input w-full text-sm resize-none"
                />
              </div>
              {/* Dialogue lines (shown when dialogue exists) */}
              {scene.dialogue && scene.dialogue.length > 0 && (
                <div>
                  <label className="block text-xs text-warm-600 mb-1">Dialogue</label>
                  <div className="space-y-1.5">
                    {scene.dialogue.map((line: DialogueLine, lineIdx: number) => (
                      <div key={lineIdx} className="flex gap-2 items-start">
                        <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded shrink-0">
                          {line.speaker}
                        </span>
                        <input
                          type="text"
                          value={line.text}
                          onChange={(e) => {
                            const newDialogue = [...(scene.dialogue || [])];
                            newDialogue[lineIdx] = { ...newDialogue[lineIdx], text: e.target.value };
                            const scenes = script.scenes.map((s, si) =>
                              si === i ? { ...s, dialogue: newDialogue } : s
                            );
                            onUpdate({ ...script, scenes });
                          }}
                          className="glass-input flex-1 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs text-warm-600 mb-1">B-Roll Image Prompt</label>
                <textarea
                  value={scene.brollPrompt}
                  onChange={(e) => updateScene(i, 'brollPrompt', e.target.value)}
                  rows={2}
                  className="glass-input w-full text-sm resize-none"
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <button
        onClick={onConfirm}
        disabled={isLoading}
        className="glass-btn w-full mt-4 py-3.5 px-6 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Submitting jobs...
          </span>
        ) : (
          videoMode === 'clips' ? 'Generate Assets (Images, Clips + Voiceover)' : 'Generate Assets (Images + Voiceover)'
        )}
      </button>
    </div>
  );
}
