# Voxmio

Make music with your hands and your voice. A browser-first React + TypeScript MVP that continues the original Voxmio product direction.

## Run

Node 24 recommended (Node 22.18+ supported).

```sh
npm ci
npm run dev
npm test
npm run build
```

Open the localhost URL. Camera and microphone require HTTPS on a hosted site. Deploy the generated `dist` directory to any static HTTPS host. No API keys, server, or account are required. `npm ci` copies the pinned MediaPipe WASM runtime to `public/wasm` for deployment.

## Implemented

- Four C / Am / F / G hand zones with MediaPipe landmarks, mirrored overlay and stable-zone debounce. Keyboard 1–4 and touch pads work without device permissions; Space silences the instrument.
- Three synth sounds, chord duration/tempo and instrument volume controls.
- Separate mic-only and camera+mic setup, permission errors, device shutdown, mic meter, and camera tracking fallback.
- A single recording stream mixes synthesized music, microphone and optional vocal harmony. Camera video is included when enabled; otherwise recordings contain audio only.
- Optional pitch-shifted fifth vocal harmony, rendered into the recording. This is a DSP effect, **not AI-generated vocal arrangement**. Microphone and harmony are not monitored through speakers, preventing a feedback loop. Use headphones and listen to harmony on replay.
- MIME negotiation for WebM/MP4, playback, download, native file sharing where supported, and a three-minute take limit.
- IndexedDB take storage, reload recovery and deletion. Storage is local to this browser/origin, may be evicted by the browser, and is not a cloud backup. Download anything important.
- Responsive studio, labelled controls, live status and reduced-motion support.

## Architecture

`src/main.tsx`: session, permissions, UI and recording lifecycle.
`src/lib/audio.ts`: Web Audio mix and synthesis, Tone.js pitch shift. Generated music goes to speakers and the recorder; microphone and vocal harmony go only to the recorder.
`src/lib/tracking.ts`: lazy-loaded MediaPipe hand tracking; CPU inference capped around 15 FPS, only on new video frames. Model downloads from Google's model host on camera activation; audio/video frames remain local.
`src/lib/music.ts`: chord definitions, stable-zone gate and export helpers.
`src/lib/takes.ts`: IndexedDB transactions, resolved only after transaction completion.

## Scope and next steps

The product remains web-first. Social feeds, marketplaces, a full DAW and native apps are deferred. The free beta includes exports; Creator positioning is retained without a fake checkout or invented price.

AI vocal arrangements are still outstanding. Next: select and validate a licensed voice/harmony model, add an isolated vocal stem and asynchronous generation pipeline, then compare quality with the existing DSP baseline. Cloud accounts, payments and cloud project sync are not implemented.

Before public launch, test real singing and gestures on iPhone Safari, Android Chrome and laptop cameras, including noisy rooms and permission revocation. Synthetic browser tests cannot establish musical quality, physical camera accuracy or mobile latency. CPU tracking can cause UI jank on low-powered devices; a worker is the next optimization if profiling warrants it.

## Validation

`npm test` covers boundary mapping, zone stability/re-entry, tuning and container extensions. `npm run build` includes strict TypeScript checking. See `docs/BUILD_STATUS.md` for browser test evidence and known limits.
