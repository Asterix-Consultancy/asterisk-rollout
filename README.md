# AsteriskRollout

Cinematic promo website for **Asterisk, the Risk Finder**. It's a single scroll journey through six 3D scenes: transaction monitoring on a real Earth, onboarding and document checks, screening, risk scoring, alerts and cases, and SAR filing. It ends on a call to action that opens a registration form and continues the enquiry on WhatsApp.

It has a light and a dark mode. It follows the visitor's system setting, and the sun/moon button in the header switches and remembers the choice.

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

**Open the app**, **Book a demo** and **Request access** all open the registration form. On submit it opens WhatsApp to `0754 193 490` with the visitor's details filled in. The number is `WHATSAPP` in `public/app.js`.

## Files

| File | What it is |
|---|---|
| `public/index.html` | Page structure, styles, chapter text |
| `public/app.js` | 3D scenes, camera path, scroll, chapter transitions, theme, registration form, audio |
| `public/textures/` | Earth day, night, water and cloud maps (NASA Blue Marble and Black Marble, public domain) |
| `server.mjs` | Tiny local static server (not used by Vercel) |
| `INSTAGRAM_PROMPT.md` | Claude Design prompt for on-brand Instagram posts |

## Editing tips

- **Chapter text** lives in the `.panel` blocks in `index.html`.
- **Camera stops** are the `K` array in `app.js` (one entry per station: camera position, look-at point and an optional sideways `shift` for desktop and phone).
- **Scroll length per chapter** is `#track section { height: … }` in `index.html`.
- **Smoothness:** `lerp` in the Lenis options (scroll inertia), the `3` in `state.p += …` (how quickly the camera catches up) and `maybeSnap` (settles onto the nearest chapter when scrolling stops).
- **Colours** for each theme are the CSS variables at the top of `index.html` and `PALETTES` in `app.js`.

All names, scores and report numbers in the scenes are fictional.
