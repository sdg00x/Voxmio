# MVP build status

Recovered baseline: `adc6a9acbb1b4c573d715e20582cd756de673033` on `sdg00x/Voxmio`, plus the earlier `voxmio-mvp.zip` hand-tracking implementation.

The repository baseline had only camera/mic recording and manually triggered chords. Generated music was not connected to the recorder; synth instances were recreated per chord. This build replaces those gaps with one shared audio graph, mixed recording and hand tracking.

## Checks

- Strict TypeScript and Vite production build: passed.
- Node unit tests: 4 passed.
- Chromium browser integration: passed with synthetic microphone/camera input.
- Decoded an actual exported instrument take: 15,617 bytes, non-zero peak amplitude 0.1905; confirms music reaches the recorded stream.
- Save/reload persistence, mic + harmony recording, delete, camera recording with model-load failure, permission denial, mobile width and camera-panel fit: passed.
- No uncaught page errors during the browser flow.
- Desktop (1440px) and mobile (390px) screenshots visually reviewed; corrected a mobile camera clipping issue.
- Physical hand tracking accuracy, subjective harmony quality and Safari/Android compatibility remain unverified.

To repeat browser checks: `npx playwright install chromium`, start `npm run dev -- --host 127.0.0.1 --port 5173`, then `npm run test:browser`. GitHub Actions runs build, unit and browser tests on pushes and pull requests.

## Remaining product work

1. Real device and musical quality validation.
2. AI-generated harmony (current fifth is an explicitly labelled DSP preview).
3. Cloud projects/authentication and real paid-plan entitlements when monetization is ready.
4. Hosted release; this change does not publish a site.

No user recordings, credentials or secrets are included in the repository.
