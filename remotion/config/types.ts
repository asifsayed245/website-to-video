export type VideoFormat = 'reel' | 'linkedin' | 'square';

export interface DialogueLineData {
  speaker: string;
  text: string;
}

export interface SceneData {
  id: string;
  type: 'hook' | 'key_point' | 'cta';
  durationSeconds: number;
  narration: string;
  textOverlay: string;
  visualMotion: 'ken_burns_right' | 'ken_burns_left' | 'zoom_in' | 'zoom_out' | 'static';
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
  videoUrls?: string[];
  audioUrl?: string;
  dialogue?: DialogueLineData[];
}

export interface BrandConfig {
  colors: {
    primary: string;
    accent: string;
    bg: string;
    surface?: string;
    text: string;
    textMuted?: string;
    overlay: string;
  };
  fonts: {
    primary: string;
  };
  typography: {
    title: number;
    subtitle: number;
    body: number;
  };
}

export type AudioMode = 'narration' | 'dialogue' | 'both';

export interface VideoCompositionProps {
  format: VideoFormat;
  scenes: SceneData[];
  brand: BrandConfig;
  audioUrl?: string;
  dialogueAudioUrls?: Record<string, string>;
  audioMode?: AudioMode;
}
