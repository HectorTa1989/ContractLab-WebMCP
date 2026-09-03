# ContractLab demo kit

Everything needed to publish the ContractLab launch: two rendered videos, subtitle tracks,
a Medium article, LinkedIn copy, and the pipeline that regenerates all of it.

## Deliverables

| File | What it is |
| --- | --- |
| `ContractLab-demo-1080p.mp4` | Full product demo. 1920×1080, 2:44, narrated, loudness-normalised to −16 LUFS |
| `captions/` | `.srt` and `.vtt` tracks for both videos |
| `ContractLab-linkedin-clip.mp4` | Vertical cut for the LinkedIn feed. 1080×1350, 1:02 |
| `medium-post.md` | Long-form article, image references resolve against `images/` |
| `linkedin-post.md` | Two post drafts, a first comment, and posting notes |
| `narration-script.md` | Scene-by-scene transcript with on-screen captions |
| `images/` | 2400px screenshots used by the article, plus cover frames |

## How the video is made

Nothing in the video is a mockup. Every frame is a real screenshot of the running app,
captured by driving it with Playwright, then composited in Remotion with a synthetic
cursor that lands on the button positions recorded during that same capture.

```
npm run dev                      ← the app, on 127.0.0.1:5174
        │
        ▼
demo/capture/capture.mjs         Playwright drives the real app
        ├─ demo/video/public/shots/*.png    44 shots at 3200×1800
        └─ demo/capture/manifest.json       button coordinates + focus regions
        │
        ▼
demo/capture/detect-changes.mjs  diffs each before/after pair
        └─ demo/capture/changes.json        boxes around what the press changed
        │
        ▼
demo/script/scenes.mjs           the storyboard: shot order, narration, highlights
        │
        ▼
demo/script/build-audio.mjs      edge-tts → demo/video/public/audio/*.mp3
        └─ demo/video/src/timeline.json     exact frame counts from measured clip lengths
        │
        ▼
demo/video (Remotion)            ContractLabDemo 1920×1080 · ContractLabClip 1080×1350
        │
        ▼
ffmpeg loudnorm + faststart      → demo/*.mp4
```

Scene length is derived from the *measured* length of each narration clip rather than
guessed, so picture and voice can never drift.

### The capture browser gets a WebMCP host

Headless Chrome has no `document.modelContext`, so the capture installs a minimal
spec-shaped tool host (`MODEL_CONTEXT_HOST` in `capture/capture.mjs`): registration,
abort-signal teardown, discovery, invocation. Consequences worth knowing:

- The registry rail reports **the tools the page actually registered** — `Active · 12 tools`
  in design mode, `Active · 7 tools` in eval mode — rather than the `Preview` badge an
  unsupported browser gets. The counts in the video are measured, not typed in.
- The urgent-triage run in the video is driven by **real tool invocations** through that
  host, not by the in-app preview button. The guarded-close run uses the preview button,
  because the video needs a mouse press there.

This mirrors, but does not replace, the live Codex in-app-browser run recorded in
`../EVALS.md`. Don't cite the video as browser-agent selection evidence.

## Rebuilding

Requirements: Node 20+, Python 3 with `edge-tts` (`pip install edge-tts`), ffmpeg on PATH,
and Chrome installed for Playwright's `chrome` channel.

```bash
# 1. the app has to be running
npm run dev:server &
npx vite --host 127.0.0.1 --port 5174 --strictPort &

# 2. re-capture the screenshots and button coordinates
node demo/capture/capture.mjs

# 3. work out what each press changed on screen
node demo/script/detect-changes.mjs

# 4. re-synthesise narration and recompile the timeline
#    (unchanged lines are served from demo/script/.voice-cache.json)
node demo/script/build-audio.mjs

# 5. render
cd demo/video
npx remotion render ContractLabDemo out/contractlab-demo.mp4 --codec=h264 --crf=18
npx remotion render ContractLabClip out/contractlab-linkedin.mp4 --codec=h264 --crf=19

# 6. normalise loudness and move into demo/
cd ..
ffmpeg -y -i video/out/contractlab-demo.mp4 -c:v copy \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:a aac -b:a 192k \
  -movflags +faststart ContractLab-demo-1080p.mp4

# 7. caption tracks (→ demo/captions/) and transcript
node demo/script/build-captions.mjs
```

`npx remotion studio` inside `demo/video` gives you a scrubbable preview while editing.

## Editing the story

- **Change the words** → edit `vo` in `demo/script/scenes.mjs`, re-run `build-audio.mjs`.
  Only the changed lines are re-synthesised; scene lengths recompute automatically.
- **Change the voice** → `voice` / `rate` at the top of `scenes.mjs`. Currently
  `en-US-AndrewMultilingualNeural` at `+14%`. `en-US-AvaMultilingualNeural` and
  `en-US-EmmaMultilingualNeural` are the natural-sounding alternatives;
  `python -m edge_tts --list-voices` shows the rest.
- **Change what a scene frames** → `focusOverride` on the scene, in screenshot CSS pixels
  against the 1600×900 viewport. Used for the registry-rail beats, whose captured rect is
  the full-width strip and would otherwise read as no zoom at all.
- **Change the LinkedIn cut** → `CLIP_ORDER` in `demo/video/src/Clip.tsx` (and the copy of
  it in `build-captions.mjs`). Scenes keep their original audio and length.
- **Captions are sidecar only**, and they live in `captions/` rather than beside the videos.
  A `.srt` with the same basename as an `.mp4` is auto-loaded by VLC and most desktop
  players, so keeping them apart means the video reviews clean and you opt in when you want
  a track. Nothing is burned into the picture either, so the app UI is never covered.
  - `.vtt` carries `::cue` styling (44% font, dark plate, `line:88%`) and is the one to use
    wherever the player honours it — HTML5 `<track>`, and platforms that render WebVTT.
  - `.srt` is the fallback. It has no styling of its own: the glyph size is the player's
    setting, so the file's only lever is keeping cues short. They are split on sentence
    boundaries, capped at two rows of ~34 characters, and timed by each fragment's share of
    the line. Tune with `MAX_LINE` / `MAX_ROWS` / `MIN_CUE_CHARS` in `build-captions.mjs`.
- **Add a beat** → capture it in `capture.mjs` with a `target` (for a click) or a `focus`
  (for a hold), then reference the shot id from `scenes.mjs`.
- **Highlight what a press changed** → `highlight` on the scene. `'auto'` boxes the regions
  `detect-changes.mjs` found by diffing the before and after captures; `'focus'` boxes the
  scene's focus rect, for a change too diffuse to cluster; omit it for no highlight.
  Full-page transitions (mode and version switches) deliberately have none — when the whole
  page changed, boxing part of it points at nothing. Detection thresholds live at the top of
  `detect-changes.mjs`; it reports the changed share and resulting boxes per scene, so a
  surprising result is visible in its output rather than only in the render.
