# Website-to-Video — Product Requirements Document

> AI-powered platform that transforms any content (URLs, topics, PDFs) into professional social media videos with narration, cinematography, and multi-format export.

---

## Table of Contents

1. [Overview](#overview)
2. [Pipeline Flow](#pipeline-flow)
3. [Input Modes](#input-modes)
4. [Configuration Options](#configuration-options)
5. [Content Processing](#content-processing)
6. [Script Generation](#script-generation)
7. [Asset Generation](#asset-generation)
8. [Video Clip Generation](#video-clip-generation)
9. [Rendering & Export](#rendering--export)
10. [AI Models & Services](#ai-models--services)
11. [Cinematography System](#cinematography-system)
12. [Remotion Video Composition](#remotion-video-composition)
13. [Architecture](#architecture)
14. [Environment Variables](#environment-variables)

---

## Overview

A Next.js 14 + Remotion 4 application that converts content into short-form videos for social media. Users provide a URL, topic, or PDF — the system scrapes/researches content, generates a timed script, creates AI images and optional video clips, composes everything with narration audio, and exports to multiple platform formats.

**Tech Stack**: Next.js 14, React 18, Remotion 4, Tailwind CSS, Framer Motion, TypeScript

---

## Pipeline Flow

```
1. CONTENT       2. SCRIPT        3. ASSETS         4. CLIPS          5. PREVIEW       6. EXPORT
   Input            Generate         Images+Audio      Video Clips       Storyboard       Render
   URL/Topic/PDF    Scenes+Timing    Gemini+deAPI      kie.ai            Review+Edit      Remotion→MP4
```

**Pipeline Steps** (type `PipelineStep`):
`input` → `script` → `generating` → `generating_clips` → `preview` → `done`

### Detailed Flow

1. **Input**: User provides URL, topic, or PDF with configuration (duration, language, style, audio mode)
2. **Content Parsing**: Scrape website (Cheerio) / Research topic (Gemini) / Parse PDF (pdf-parse + Gemini Vision fallback)
3. **Enrichment**: Gemini expands thin content to match target duration word budget
4. **Script Generation**: Create scenes with narration, timing, shot design, and cross-scene continuity
5. **Image Generation**: Gemini generates images per scene (intelligent pacing based on content density)
6. **Audio Generation**: deAPI (Kokoro) generates TTS narration + optional character dialogue
7. **Clip Generation** (optional): kie.ai converts images to video clips with camera movements
8. **Preview**: User reviews storyboard, edits script if needed
9. **Render**: Remotion composes scenes + audio + images/clips into MP4
10. **Download**: User downloads videos in selected format(s)

---

## Input Modes

### URL Scraping
- **Route**: `POST /api/scrape`
- **Lib**: `lib/scraper.ts` (Cheerio-based HTML parsing)
- Extracts: title (og:title → title → h1), description, headings, paragraphs, CTA links
- Detects target audience from content keywords
- Falls back to Gemini enrichment for thin content

### Topic Research
- **Route**: `POST /api/research`
- **Lib**: `lib/topic-researcher.ts` → `lib/gemini.ts`
- **Business mode**: `researchWithGemini()` — keyword-driven research with structured key points
- **Story mode**: `researchStoryWithGemini()` — narrative arc with character guide and environment guide
- Falls back to template-based generation if Gemini unavailable

### PDF Upload
- **Route**: `POST /api/parse-pdf`
- **Lib**: `lib/pdf-parser.ts`
- Max file size: 10 MB
- Text extraction via `pdf-parse/lib/pdf-parse.js` (dynamic import to avoid test-file side effect)
- Fallback chain: text extraction → Gemini Vision (for image-based PDFs) → Gemini enrichment
- Preserves `rawText` (up to 16,000 chars) on StructuredContent for complete coverage during enrichment
- Extracts headings (up to 10), paragraphs, title, description

---

## Configuration Options

| Option | Type | Values | Default |
|--------|------|--------|---------|
| Content Style | `ContentStyle` | `business`, `story` | `business` |
| Duration | `VideoDuration` | `30`, `60`, `120`, `300` seconds | `60` |
| Language | `ScriptLanguage` | `english`, `hindi`, `hinglish` | `english` |
| Audio Mode | `AudioMode` | `narration`, `dialogue`, `both` | `narration` |
| Video Mode | `VideoMode` | `clips`, `images` | `clips` |
| Image Style | `ImageStyle` | 11 styles (see below) | `realistic` |
| Clip Model | `KieModel` | 6 models (see below) | `kling-2.6` |

### Image Styles
`realistic`, `cinematic`, `2d-flat`, `2d-watercolor`, `2d-comic`, `2d-storybook`, `3d-pixar`, `3d-claymation`, `3d-lowpoly`, `painterly`, `anime`

Each style has a prompt suffix appended to image generation prompts (defined in `lib/config.ts` → `IMAGE_STYLE_OPTIONS`).

### Video Clip Models
| Model | Resolutions | Durations | Sound |
|-------|-------------|-----------|-------|
| Kling 2.6 | 720p, 1080p | 5s, 10s | Yes |
| Kling 3.0 | 720p, 1080p | 5s, 10s | Yes |
| Hailuo Pro | — | — | No |
| Wan 2.6 Flash | 720p, 1080p | 5s, 10s, 15s | No |
| Seedance 1.5 Pro | 720p, 1080p | 4s, 8s, 12s | Yes |
| Sora 2 Pro | — | — | No |

Defined in `lib/config.ts` → `KIE_MODEL_OPTIONS`.

---

## Content Processing

### Core Data Type: `StructuredContent`
```
title, description, source, themes[]
keyPoints: KeyPoint[] — heading, detail, emotionalTone, setting?, imagePrompt?, dialogue?
targetAudience, cta?, characterGuide?, environmentGuide?, rawText?
```

### Gemini Enrichment (`lib/gemini.ts`)
- **Business mode** (`enrichScrapedContent`): Expands thin content into word-budgeted key points
- **Story mode** (`enrichAsStory`): Transforms content into cinematic narrative beats with character/environment guides
- Word budget: `targetDuration × speechRate × speed` (e.g., 2min at 2.8 WPS = ~336 words)
- Dynamic beat count: base count + extra beats for content-heavy sources (PDF rawText)
- Per-beat word range: flexible ±15/+20 words — Gemini writes natural complete sentences
- When `rawText` is available (PDF uploads), ONLY the full text is sent to Gemini (not truncated keyPoints)
- Prompt enforces: complete story coverage, no mid-sentence cuts, moral/lesson inclusion

### Speech Rate Config
```
hi:    2.8 words/second
en-us: 2.8 words/second
en-gb: 2.8 words/second
```

---

## Script Generation

**Route**: `POST /api/analyze`
**Lib**: `lib/script-generator.ts`

### Business Script
1. **Hook scene**: Opening punch line about the topic
2. **Key point scenes**: Each point becomes a scene (word-budgeted, at least 2)
3. **CTA scene**: Call-to-action with source URL

### Story Script
1. **Opening scene**: Narrative hook (type `hook`)
2. **Story beats**: All keyPoints from Gemini become scenes (type `key_point`) — never truncated
3. **Ending scene**: Resolution/moral (type `cta`)
- Supports dialogue per scene when `audioMode` is `dialogue` or `both`
- Character voice mapping for multi-character stories

### Scene Structure
```
id, type (hook|key_point|cta)
durationSeconds — proportional to word count
narration — spoken text
textOverlay — short heading
brollPrompt — image generation prompt with shot design + cross-scene context
visualMotion — ken_burns_right|ken_burns_left|zoom_in|zoom_out|static
shotDesign — size, angle, promptFragment (lens, composition, DoF)
dialogue? — [{speaker, text}]
```

### Audio Timing (`lib/audio-timing.ts`)
- `estimateAudioDuration()`: word count ÷ (speechRate × speed) × 1.03 buffer
- `calculateSceneDurations()`: distributes total duration across scenes proportionally by word count, rounded to frame boundaries (30fps)

---

## Asset Generation

**Route**: `POST /api/generate`
**Polling**: `POST /api/status`

### Image Generation (`lib/gemini-image.ts`)
- Model: `gemini-3.1-flash-image-preview`
- Aspect ratio: 16:9 (1536×1024)
- Saves to `/public/generated/img-{sceneId}-{index}-{timestamp}.png`
- Retry with exponential backoff (3s, 6s, 9s) for rate limits and 500 errors

### Intelligent Image Pacing (`planSceneImageCount` in `app/api/generate/route.ts`)
Determines how many images each scene needs based on:
- **Action patterns**: Fast cuts (~3.5s per image) for chase, fight, battle scenes
- **Tension patterns**: Moderate pacing (~4s) for danger, crisis scenes
- **Intimate patterns**: Lingering shots (~7s) for emotional, whisper scenes
- **Sentence density**: More sentences → more images
- **Scene type**: Hooks get ×0.9 modifier, CTAs get ×1.1
- **Clips mode floor**: Ensures enough images to cover scene duration with clip lengths

### Audio Generation (`lib/deapi.ts`)
- Provider: deAPI (Kokoro model)
- Single TTS job for full narration text
- Parameters: voice, speed (1.0), lang, format (mp3), sample_rate (24000)
- Character dialogue audio: separate jobs per character (sceneId `char-{name}`)
- Polling with retry logic (3 attempts, 5s/10s/15s backoff for 429s)

### Audio Duration Refinement
- **Route**: `POST /api/audio-duration`
- Uses ffprobe to get actual TTS audio duration
- Recalculates scene durations from actual audio length (more accurate than word-count estimate)

---

## Video Clip Generation

**Route**: `POST /api/generate-clips`
**Lib**: `lib/kie.ts`

### Process
1. Filter completed image jobs
2. Plan camera directions from script (`lib/camera-director.ts`)
3. For each image: upload to public host → combine camera direction + brollPrompt → submit to kie.ai
4. 1.5s delay between submissions (rate limiting)
5. Poll via `/api/status` (30s initial, 20s interval)

### Camera Movements (12 types)
`slow_push_in`, `pull_back`, `track_left`, `track_right`, `orbit_right`, `orbit_left`, `crane_up`, `crane_down`, `subtle_float`, `static_depth`, `dolly_zoom`, `whip_pan`

Each has a prompt fragment (e.g., "Camera slowly pushes in toward the subject, creating intimacy and focus").

### Model-Specific Payloads
Each kie.ai model has different API parameter formats. `buildModelPayload()` adapts prompt/params per model:
- **Kling**: `prompt`, `image_urls`, `sound`, `duration`, `mode`
- **Wan**: `prompt`, `image_urls`, `audio`, `duration`, `resolution`
- **Seedance**: `prompt`, `input_urls`, `generate_audio`, `duration`, `resolution`
- **Hailuo**: `prompt`, `image_urls`, `prompt_optimizer`
- **Sora**: `prompt`, `image_urls`, `watermark_removal`

---

## Rendering & Export

**Route**: `POST /api/render`

### Process
1. **Cleanup**: Delete old generated files not referenced in current render props (prevents 800MB+ public dir bloat)
2. **Download**: Download all images, audio, video clips to `/public/generated/` with retry (2 attempts, 60s timeout)
3. **Build props**: Create Remotion composition props per format
4. **Render**: `npx remotion render` with `--concurrency=4` (parallel frame rendering)
5. **Output**: MP4 files to `/output/{format}-{width}x{height}-{timestamp}.mp4`

### Render Config
- Timeout: 30 minutes (1800s)
- Max buffer: 10 MB
- Concurrency: 4 CPU cores
- Debug props saved to `/output/debug-props-{format}.json`

### Audio Mode Handling in Render
- `narration`: Play TTS narration audio only
- `dialogue`: Play character dialogue audio only (clips have lip-sync)
- `both`: Play narration at 0.7 volume + character dialogue at 1.0 volume

### Video Download
- **Route**: `GET /api/video?file={path}` — serves rendered MP4 files from `/output/`

---

## AI Models & Services

| Service | Provider | Model | Purpose |
|---------|----------|-------|---------|
| Content Research | Google | Gemini 2.0 Flash | Topic research, content enrichment, story generation |
| Image Generation | Google | Gemini 3.1 Flash Image Preview | Scene images from prompts |
| PDF Vision | Google | Gemini 2.0 Flash | Extract content from image-based PDFs |
| Text-to-Speech | deAPI | Kokoro | Narration and character dialogue audio |
| Video Clips | kie.ai | 6 models (Kling, Hailuo, Wan, Seedance, Sora) | Image-to-video with camera motion |
| Video Composition | Remotion | Headless Chrome | Final video rendering with audio sync |

---

## Cinematography System

### Shot Design (`lib/cinema-director.ts`)
Applies filmmaking rules based on scene content and position:

**Shot Sizes** (7): `extreme_wide`, `wide`, `full`, `medium`, `medium_closeup`, `closeup`, `extreme_closeup`
**Camera Angles** (6): `eye_level`, `low_angle`, `high_angle`, `dutch`, `birds_eye`, `over_shoulder`

**Pattern Detection**: Analyzes narration text for:
- `INTIMATE_PATTERN`: whisper, secret, emotion → wide shots, lingering
- `ACTION_PATTERN`: run, fight, chase → tighter shots, fast cuts
- `TENSION_PATTERN`: danger, threat, crisis → dutch angles
- `POWER_PATTERN`: conquer, triumph → low angles
- `VULNERABLE_PATTERN`: fear, lost → high angles

**Lens Mapping**: Shot size → focal length + depth of field
- Extreme wide: 24mm, deep focus
- Medium: 50mm, moderate DoF
- Close-up: 85mm portrait, shallow DoF with bokeh
- Extreme close-up: 100mm macro, isolated subject

### Cross-Scene Continuity (`addCrossSceneContext` in script-generator.ts)
Prepends context to each scene's brollPrompt:
- Reference to previous scene's textOverlay
- Transition hint toward next scene
- "Maintain consistent lighting, color palette, and visual tone across scenes"

---

## Remotion Video Composition

### Compositions (`remotion/Root.tsx`)
| ID | Format | Resolution | Use Case |
|----|--------|-----------|----------|
| Reel | 9:16 | 1080×1920 | Instagram Reels, TikTok |
| LinkedIn | 16:9 | 1920×1080 | LinkedIn, YouTube |
| Square | 1:1 | 1080×1080 | Instagram Posts |

All at 30fps. Duration = sum of scene durations + 3s padding.

### Slide Components (`remotion/components/`)
- **HookSlide**: Opening hook with dramatic text
- **KeyPointSlide**: Key point with numbered indicator
- **CTASlide**: Call-to-action final slide
- **MultiImage**: Ken Burns pan/zoom with crossfades between multiple images per scene
- **MultiVideo**: Video clip playback replacing static images
- **TextOverlay**: Animated text with fade in/out
- **Subtitles**: Synchronized narration/dialogue text
- **ProgressBar**: Playback progress indicator

### Brand Configuration (`lib/config.ts`)
```
Colors: primary (#D97706), accent (#F59E0B), bg (#F5F0EB), text, overlay
Fonts: Inter, system-ui, sans-serif
Typography per format:
  reel:     title 42, subtitle 24, body 18
  linkedin: title 64, subtitle 36, body 28
  square:   title 48, subtitle 28, body 22
```

---

## Architecture

### File Structure
```
website-to-video/
├── app/
│   ├── page.tsx                 # Main orchestration UI
│   ├── layout.tsx               # Root layout
│   ├── globals.css              # Tailwind + custom styles
│   └── api/
│       ├── scrape/route.ts      # Website scraping
│       ├── research/route.ts    # Topic research
│       ├── parse-pdf/route.ts   # PDF parsing
│       ├── analyze/route.ts     # Script generation
│       ├── generate/route.ts    # Image + audio job submission
│       ├── generate-clips/route.ts  # Video clip submission
│       ├── status/route.ts      # Job polling
│       ├── audio-duration/route.ts  # ffprobe duration
│       ├── render/route.ts      # Remotion rendering
│       ├── video/route.ts       # Video file serving
│       └── voice-preview/route.ts   # Voice sample
├── components/
│   ├── ContentInput.tsx         # URL/topic/PDF input form
│   ├── ScriptEditor.tsx         # Script editing + voice/clip settings
│   ├── AssetGallery.tsx         # Asset generation progress
│   ├── VideoPreview.tsx         # Storyboard preview
│   ├── DownloadPanel.tsx        # Render + download UI
│   ├── VoiceSelector.tsx        # Voice picker (13 voices)
│   └── ProgressTracker.tsx      # 6-step pipeline visualization
├── lib/
│   ├── types.ts                 # All TypeScript types
│   ├── config.ts                # Default config, voices, styles, models
│   ├── gemini.ts                # Gemini content research + enrichment
│   ├── gemini-image.ts          # Gemini image generation
│   ├── script-generator.ts      # Business + story script generation
│   ├── camera-director.ts       # Camera movement planning
│   ├── cinema-director.ts       # Shot design (size, angle, lens)
│   ├── scraper.ts               # Cheerio website scraping
│   ├── deapi.ts                 # TTS audio API
│   ├── kie.ts                   # Video clip API
│   ├── topic-researcher.ts      # Research dispatcher
│   ├── pdf-parser.ts            # PDF text extraction
│   ├── audio-timing.ts          # Duration estimation + distribution
│   ├── image-upload.ts          # Image upload helper
│   └── utils.ts                 # wordCount, delay, etc.
├── remotion/
│   ├── index.ts                 # registerRoot entry point
│   ├── Root.tsx                 # 3 compositions (Reel, LinkedIn, Square)
│   ├── WebContentVideo.tsx      # Main video component
│   ├── config/types.ts          # Remotion prop types
│   └── components/              # HookSlide, KeyPointSlide, CTASlide,
│                                # MultiImage, MultiVideo, TextOverlay,
│                                # Subtitles, ProgressBar, BRollImage, BRollVideo
├── public/generated/            # Runtime-generated images, audio, clips
├── output/                      # Rendered MP4 videos + debug props
├── remotion.config.ts           # Remotion CLI config (JPEG, overwrite)
├── package.json
├── tailwind.config.js
└── .env.local
```

### Key Dependencies
- `next` 14 — Full-stack framework
- `remotion` 4 + `@remotion/cli` + `@remotion/player` — Video composition
- `@google/genai` — Gemini image generation
- `@google/generative-ai` — Gemini content research
- `cheerio` — HTML parsing
- `pdf-parse` — PDF text extraction
- `framer-motion` — UI animations

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini — content research + image generation |
| `DEAPI_API_KEY` | Yes | deAPI — text-to-speech (Kokoro) |
| `KIE_API_KEY` | For clips | kie.ai — video clip generation |
| `NEXT_PUBLIC_SITE_URL` | No | Public URL override for asset serving |

**System Requirements**: `ffmpeg` and `ffprobe` must be installed (used by Remotion and audio-duration route).

---

## Voice Options

### Hindi
| Voice ID | Name | Gender |
|----------|------|--------|
| hf_alpha | Alpha | Female |
| hf_beta | Beta | Female |
| hm_omega | Omega | Male |
| hm_psi | Psi | Male |

### English (US)
| Voice ID | Name | Gender |
|----------|------|--------|
| af_heart | Heart | Female |
| af_bella | Bella | Female |
| af_nicole | Nicole | Female |
| af_sarah | Sarah | Female |
| af_sky | Sky | Female |
| am_adam | Adam | Male |
| am_michael | Michael | Male |

### English (UK)
| Voice ID | Name | Gender |
|----------|------|--------|
| bf_emma | Emma | Female |
| bf_isabella | Isabella | Female |
| bm_george | George | Male |
| bm_daniel | Daniel | Male |

---

*Last updated: March 2026*
