// ── Content Style ──

export type ContentStyle = 'business' | 'story';

// ── Video Duration ──

export type VideoDuration = 30 | 60 | 120 | 300;

export const VIDEO_DURATION_OPTIONS: { value: VideoDuration; label: string }[] = [
  { value: 30, label: '30 sec' },
  { value: 60, label: '1 min' },
  { value: 120, label: '2 min' },
  { value: 300, label: '5 min' },
];

// ── Script Language ──

export type ScriptLanguage = 'english' | 'hindi' | 'hinglish';

export const SCRIPT_LANGUAGE_OPTIONS: { value: ScriptLanguage; label: string }[] = [
  { value: 'english', label: 'English' },
  { value: 'hindi', label: 'Hindi' },
  { value: 'hinglish', label: 'Hinglish' },
];

// ── Video Mode ──

export type VideoMode = 'images' | 'clips';

export const VIDEO_MODE_OPTIONS: { value: VideoMode; label: string; description: string }[] = [
  { value: 'clips', label: 'Animated Clips', description: 'AI-generated video clips with motion' },
  { value: 'images', label: 'Motion Images', description: 'AI images with Ken Burns motion effects' },
];

// ── Audio Mode ──

export type AudioMode = 'narration' | 'dialogue' | 'both';

export const AUDIO_MODE_OPTIONS: { value: AudioMode; label: string; description: string }[] = [
  { value: 'narration', label: 'Narration', description: 'Single voice narrates the video' },
  { value: 'dialogue', label: 'Dialogue', description: 'Characters speak their own lines' },
  { value: 'both', label: 'Both', description: 'Narration + character dialogue' },
];

// ── Dialogue ──

export interface DialogueLine {
  speaker: string;
  text: string;
  voiceId?: string;
  voiceLang?: string;
}

export interface CharacterVoiceMapping {
  name: string;
  voiceId: string;
  voiceLang: string;
}

export type ImageStyle =
  | 'realistic' | 'cinematic'
  | '2d-flat' | '2d-watercolor' | '2d-comic' | '2d-storybook'
  | '3d-pixar' | '3d-claymation' | '3d-lowpoly'
  | 'painterly' | 'anime';

export interface ImageStyleOption {
  value: ImageStyle;
  label: string;
  group: string;
}

export const IMAGE_STYLE_OPTIONS: ImageStyleOption[] = [
  { value: 'realistic', label: 'Photo Realistic', group: 'Realistic' },
  { value: 'cinematic', label: 'Cinematic', group: 'Realistic' },
  { value: '2d-flat', label: 'Flat / Vector', group: '2D' },
  { value: '2d-watercolor', label: 'Watercolor', group: '2D' },
  { value: '2d-comic', label: 'Comic / Pop Art', group: '2D' },
  { value: '2d-storybook', label: 'Storybook', group: '2D' },
  { value: '3d-pixar', label: 'Disney Pixar', group: '3D' },
  { value: '3d-claymation', label: 'Claymation', group: '3D' },
  { value: '3d-lowpoly', label: 'Low Poly', group: '3D' },
  { value: 'painterly', label: 'Oil Painting', group: 'Artistic' },
  { value: 'anime', label: 'Anime', group: 'Artistic' },
];

export const IMAGE_STYLE_SUFFIXES: Record<ImageStyle, string> = {
  realistic: ', photorealistic, professional photography, cinematic lighting, high quality, 4k',
  cinematic: ', cinematic film still, anamorphic lens, movie color grading, dramatic lighting, 35mm film grain, depth of field',
  '2d-flat': ', 2D digital illustration, flat design, clean vector art, vibrant colors, modern illustration style, bold outlines',
  '2d-watercolor': ', delicate watercolor painting, soft washes of color, wet-on-wet technique, artistic watercolor illustration, subtle paper texture',
  '2d-comic': ', comic book art style, bold ink outlines, halftone dots, pop art colors, dynamic comic panel composition, graphic novel illustration',
  '2d-storybook': ', children\'s storybook illustration, warm soft colors, whimsical art style, gentle watercolor and pencil, cozy picture book quality',
  '3d-pixar': ', Disney Pixar 3D animation style, subsurface scattering skin, expressive cartoon characters, vibrant saturated colors, smooth rounded shapes, studio CGI',
  '3d-claymation': ', claymation stop-motion style, clay texture, handmade feel, slightly imperfect surfaces, warm studio lighting, tactile 3D',
  '3d-lowpoly': ', low poly 3D render, geometric faceted surfaces, flat shading, minimalist 3D art, pastel colors, clean polygonal shapes',
  painterly: ', oil painting style, painterly brushstrokes, artistic, impressionist, rich textures, fine art, canvas texture',
  anime: ', anime art style, studio ghibli inspired, cel-shaded, vibrant anime colors, detailed anime illustration, Japanese animation',
};

// ── Input Types ──

export type InputMode = 'url' | 'topic';

export interface URLInput {
  mode: 'url';
  url: string;
}

export interface TopicInput {
  mode: 'topic';
  topic: string;
  keywords: string[];
  audience?: string;
  tone?: 'professional' | 'casual' | 'educational' | 'inspirational';
  cta?: string;
}

export type ContentInput = URLInput | TopicInput;

// ── Reference Images ──

export interface ReferenceImage {
  id: string;
  type: 'character' | 'environment';
  dataUrl: string;
  filename: string;
}

// ── Scraped / Researched Content ──

export interface StructuredContent {
  title: string;
  description: string;
  source: string;
  themes: string[];
  keyPoints: KeyPoint[];
  targetAudience: string;
  cta?: { text: string; url?: string };
  characterGuide?: string;
  environmentGuide?: string;
  /** Full raw text from uploaded PDF — passed to Gemini for complete content coverage. */
  rawText?: string;
  referenceImages?: ReferenceImage[];
}

export interface KeyPoint {
  heading: string;
  detail: string;
  emotionalTone: 'excitement' | 'trust' | 'confidence' | 'curiosity' | 'urgency';
  setting?: string;
  imagePrompt?: string;
  dialogue?: { speaker: string; text: string }[];
}

// ── Video Script ──

export interface VideoScript {
  scenes: Scene[];
  fullNarration: string;
  totalDurationSeconds: number;
  voiceId: string;
  voiceSpeed: number;
  voiceLang?: string;
  scriptLanguage?: ScriptLanguage;
  imageStyle?: ImageStyle;
  characterGuide?: string;
  environmentGuide?: string;
  imageInstruction?: string;
  clipModel?: KieModel;
  clipResolution?: ClipResolution;
  clipDuration?: string;
  audioMode?: AudioMode;
  characters?: CharacterVoiceMapping[];
  referenceImages?: ReferenceImage[];
}

export interface VoiceOption {
  id: string;
  name: string;
  lang: string;
  langLabel: string;
  gender: 'female' | 'male';
}

export interface Scene {
  id: string;
  type: 'hook' | 'key_point' | 'cta';
  durationSeconds: number;
  narration: string;
  wordCount: number;
  brollPrompt: string;
  textOverlay: string;
  visualMotion: 'ken_burns_right' | 'ken_burns_left' | 'zoom_in' | 'zoom_out' | 'static';
  dialogue?: DialogueLine[];
  shotDesign?: ShotDesign;
}

// ── Asset Generation ──

export interface AssetJob {
  id: string;
  sceneId: string;
  type: 'image' | 'audio' | 'video';
  requestId: string;
  status: 'processing' | 'done' | 'failed';
  resultUrl?: string;
  localPath?: string;
  sourceImageUrl?: string;
  cameraDirection?: string;
}

export interface AssetsManifest {
  images: Record<string, { url: string; localPath: string }>;
  audio: Record<string, { url: string; localPath: string }>;
  videos: Record<string, { url: string; localPath: string }>;
  allReady: boolean;
}

// ── Kie.ai Video Models ──

export type KieModel =
  | 'kling-2.6/image-to-video'
  | 'kling-3.0/video'
  | 'hailuo/02-image-to-video-pro'
  | 'wan/2-6-flash-image-to-video'
  | 'bytedance/seedance-1.5-pro'
  | 'sora-2-pro-image-to-video';

export type ClipResolution = '720p' | '1080p';

export interface KieModelOption {
  value: KieModel;
  label: string;
  resolutions: ClipResolution[];
  durations: string[];
  defaultDuration: string;
  soundSupported: boolean;
}

export const KIE_MODEL_OPTIONS: KieModelOption[] = [
  {
    value: 'kling-2.6/image-to-video',
    label: 'Kling 2.6',
    resolutions: ['720p', '1080p'],
    durations: ['5', '10'],
    defaultDuration: '5',
    soundSupported: true,
  },
  {
    value: 'kling-3.0/video',
    label: 'Kling 3.0',
    resolutions: ['720p', '1080p'],
    durations: ['5', '10'],
    defaultDuration: '5',
    soundSupported: true,
  },
  {
    value: 'hailuo/02-image-to-video-pro',
    label: 'Hailuo Pro',
    resolutions: [],
    durations: [],
    defaultDuration: '5',
    soundSupported: false,
  },
  {
    value: 'wan/2-6-flash-image-to-video',
    label: 'Wan 2.6 Flash',
    resolutions: ['720p', '1080p'],
    durations: ['5', '10', '15'],
    defaultDuration: '5',
    soundSupported: true,
  },
  {
    value: 'bytedance/seedance-1.5-pro',
    label: 'Seedance 1.5 Pro',
    resolutions: ['720p', '1080p'],
    durations: ['4', '8', '12'],
    defaultDuration: '4',
    soundSupported: true,
  },
  {
    value: 'sora-2-pro-image-to-video',
    label: 'Sora 2 Pro',
    resolutions: [],
    durations: [],
    defaultDuration: '5',
    soundSupported: false,
  },
];

// ── Shot Design (Cinematography) ──

export type ShotSize = 'extreme_wide' | 'wide' | 'full' | 'medium' | 'medium_closeup' | 'closeup' | 'extreme_closeup';
export type CameraAngle = 'eye_level' | 'low_angle' | 'high_angle' | 'dutch' | 'birds_eye' | 'over_shoulder';

export interface ShotDesign {
  size: ShotSize;
  angle: CameraAngle;
  promptFragment: string;
}

// ── Camera Direction ──

export interface CameraDirection {
  sceneId: string;
  movement: string;
  promptFragment: string;
  rationale: string;
}

// ── Video Formats ──

export type VideoFormat = 'reel' | 'linkedin' | 'square';
export type RenderFormat = VideoFormat | 'all';

export interface PlatformSpec {
  name: string;
  width: number;
  height: number;
  aspect: string;
  maxDuration: number;
}

export const PLATFORMS: Record<VideoFormat, PlatformSpec> = {
  reel: { name: 'Instagram Reel', width: 1080, height: 1920, aspect: '9:16', maxDuration: 60 },
  linkedin: { name: 'LinkedIn Video', width: 1920, height: 1080, aspect: '16:9', maxDuration: 90 },
  square: { name: 'Instagram Post', width: 1080, height: 1080, aspect: '1:1', maxDuration: 30 },
};

// ── Pipeline State ──

export type PipelineStep = 'input' | 'script' | 'generating' | 'generating_clips' | 'preview' | 'done';

export interface PipelineState {
  step: PipelineStep;
  content?: StructuredContent;
  script?: VideoScript;
  assets?: AssetsManifest;
  jobs?: AssetJob[];
  clipJobs?: AssetJob[];
  cameraDirections?: CameraDirection[];
  error?: string;
}
