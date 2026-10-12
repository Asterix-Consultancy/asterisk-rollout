# AsteriskRollout

Cinematic promo website for **Asterisk, the Risk Finder**. It's a single scroll journey through five 3D scenes: transaction monitoring, screening, risk scoring, alerts and cases, and SAR filing. It ends on a call to action.

Plain static site, no build step: HTML, CSS and JavaScript with [Three.js](https://threejs.org) r128, [GSAP](https://gsap.com) + ScrollTrigger and [Lenis](https://lenis.darkroom.engineering) smooth scrolling, all loaded from CDNs. The ambient sound is synthesized in the browser, so there are no audio files.

## Run locally

Needs Node 18+.

```bash
npm run dev
```

Then open http://localhost:5180.

## Deploy on Vercel

1. Import this repository in Vercel.
2. Leave the framework preset as **Other**. `vercel.json` already sets the output directory to `public/`, and the build command does nothing.
3. Deploy.

Before going live, edit `public/index.html` and change:
- **Open the app**: `http://localhost:3100` → the deployed Asterisk app URL
- **Book a demo**: `hello@example.com` → a real address

## Files

| File | What it is |
|---|---|
| `public/index.html` | Page structure, styles, chapter text |
| `public/app.js` | 3D scenes, camera path, scroll, text scramble, audio |
| `server.mjs` | Tiny local static server (not used by Vercel) |
| `INSTAGRAM_PROMPT.md` | Claude Design prompt for on-brand Instagram posts |

## Editing tips

- **Chapter text** lives in the `.panel` blocks in `index.html`.
- **Camera stops** are the `K` array in `app.js` (one entry per station: camera position and look-at point).
- **Scroll length per chapter** is `#track section { height: … }` in `index.html`.
- **Smoothness:** `lerp` in the Lenis options (scroll inertia) and the `3.4` in `state.p += …` (how quickly the camera catches up).

All names, scores and report numbers in the scenes are fictional.
