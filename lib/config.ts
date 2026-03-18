import type { VoiceOption } from './types';

export const defaultConfig = {
  brand: {
    colors: {
      primary: '#D97706',
      accent: '#F59E0B',
      bg: '#F5F0EB',
      surface: '#FFFFFF',
      text: '#4A3B2E',
      textMuted: '#9C7C64',
      overlay: 'rgba(45,35,27,0.7)',
    },
    fonts: {
      primary: 'Inter, system-ui, sans-serif',
    },
    typography: {
      reel: { title: 56, subtitle: 32, body: 24 },
      linkedin: { title: 64, subtitle: 36, body: 28 },
      square: { title: 48, subtitle: 28, body: 22 },
    },
  },
  voice: {
    provider: 'deapi' as const,
    voiceId: 'hf_alpha',
    speed: 1.0,
    lang: 'hi',
    speechRate: { hi: 2.8, 'en-us': 2.8, 'en-gb': 2.8 } as Record<string, number>,
  },
  image: {
    provider: 'gemini' as const,
    model: 'gemini-3.1-flash-image-preview',
    aspectRatio: '16:9',
    width: 1536,
    height: 1024,
    styleSuffix: ', professional, cinematic lighting, high quality, 4k',
  },
  video: {
    provider: 'kie' as const,
    model: 'kling-2.6/image-to-video' as const,
    defaultResolution: '720p' as const,
    defaultDuration: '5',
    pollIntervalMs: 15000,
    maxPollAttempts: 40,
  },
  timing: {
    fps: 30,
    hookDuration: 5,
    keyPointDuration: 8,
    ctaDuration: 5,
    maxKeyPoints: 10,
    paddingSeconds: 0.5,
  },
};

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: 'hf_alpha', name: 'Alpha', lang: 'hi', langLabel: 'Hindi', gender: 'female' },
  { id: 'hf_beta', name: 'Beta', lang: 'hi', langLabel: 'Hindi', gender: 'female' },
  { id: 'hm_omega', name: 'Omega', lang: 'hi', langLabel: 'Hindi', gender: 'male' },
  { id: 'hm_psi', name: 'Psi', lang: 'hi', langLabel: 'Hindi', gender: 'male' },
  { id: 'af_heart', name: 'Heart', lang: 'en-us', langLabel: 'English (US)', gender: 'female' },
  { id: 'af_bella', name: 'Bella', lang: 'en-us', langLabel: 'English (US)', gender: 'female' },
  { id: 'af_nicole', name: 'Nicole', lang: 'en-us', langLabel: 'English (US)', gender: 'female' },
  { id: 'af_sarah', name: 'Sarah', lang: 'en-us', langLabel: 'English (US)', gender: 'female' },
  { id: 'af_sky', name: 'Sky', lang: 'en-us', langLabel: 'English (US)', gender: 'female' },
  { id: 'am_adam', name: 'Adam', lang: 'en-us', langLabel: 'English (US)', gender: 'male' },
  { id: 'am_michael', name: 'Michael', lang: 'en-us', langLabel: 'English (US)', gender: 'male' },
  { id: 'bf_emma', name: 'Emma', lang: 'en-gb', langLabel: 'English (UK)', gender: 'female' },
  { id: 'bf_isabella', name: 'Isabella', lang: 'en-gb', langLabel: 'English (UK)', gender: 'female' },
  { id: 'bm_george', name: 'George', lang: 'en-gb', langLabel: 'English (UK)', gender: 'male' },
  { id: 'bm_daniel', name: 'Daniel', lang: 'en-gb', langLabel: 'English (UK)', gender: 'male' },
];

export type AppConfig = typeof defaultConfig;
