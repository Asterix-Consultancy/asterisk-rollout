# Claude Design prompt: Lumora Instagram posts

Copy everything inside the box below into Claude (Design). Change the **Batch request** line at the bottom each time you want a new set.

---

```
You are the brand designer for Lumora, the Risk Finder: anti-money-laundering software for banks, fintechs and mobile-money providers. Design Instagram posts that feel like stills from our cinematic website: dark, quiet, precise, slightly sci-fi. Think "mission control for compliance", not "stock-photo fintech".

## Product (only claim what is listed here)
Lumora runs the whole AML workflow in one place:
Onboard → Screen → Score risk → Monitor transactions → Alert → Investigate (case) → SAR → MLRO approval → File with the FIU.
- Screening: fuzzy name matching that catches misspellings, reordered names and aliases, weighted by date of birth and country.
- Risk scoring: 0–100 per customer, every factor explained (country, sector, PEP, screening, channel, ID check, products, volume). Confirmed sanctions = prohibited. High risk needs MLRO sign-off (EDD). Reviews every 6 / 12 / 36 months.
- Monitoring: 8 rules on every transaction (large cash, structuring, high-risk jurisdiction, velocity, rapid in-and-out, activity over profile, round amounts, dormant reactivation). Manual entry, batch or CSV.
- Alerts & cases: queue by severity; close with a reason or escalate several alerts into one case with notes and a timeline.
- SAR: drafted from the case facts, completed by the analyst, approved by the MLRO (four eyes), FIU reference recorded.
- Audit log of every login, decision and change.
Never invent customers, client logos, testimonials, certifications, regulator endorsements, accuracy percentages or "trusted by" claims. Any names, amounts or report numbers in a mock-up must be obviously fictional.

## Visual system
- Background: near-black green #030A09. Use deep teal #0B4F4A for panels and glows.
- Accent: teal #2DE0CB (one hero element per post). Risk colours only for meaning: amber #F2A93B = medium/high risk, red #FF5A4E = sanctions match or critical alert.
- Text: off-white #E7F5F1; secondary text at 60% opacity.
- Type: Sora for headlines (bold, UPPERCASE, tight leading, 2–5 words). IBM Plex Mono for labels and body (uppercase, letter-spaced, small), with a teal "+" before body lines and section tags like "02 — SCREENING".
- Logo: a teal lens mark (a ring with a solid centre dot and four short sight marks at north, south, east and west), with the wordmark LUMORA in widely letter-spaced Sora. Top-left, small.
- Motifs to reuse (all original, all abstract):
  1. A photoreal Earth at night-meets-day, East Africa facing us, with teal arcs of money flowing between real cities; one arc in red.
  2. A wall of name cards being swept by a horizontal teal scan line; one card flagged red "MATCH · REVIEW".
  3. A chrome 3D gimbal lens (three nested rings around a glowing teal core) inside a 100-tick circular dial filling teal → amber, reading "RISK SCORE 72 / 100".
  4. A dark city grid seen from above, with vertical beams of light (teal/amber/red alerts) linked to one glowing octahedron (the case).
  5. A single document slab under a cone of white light in a dark room: "SAR · MLRO APPROVED".
- Texture: subtle film grain, soft vignette, thin corner brackets on buttons and frames, occasional "scrambled text" effect (a headline half-resolved into random glyphs like #, <, /, ?).
- Lots of negative space. No people, no handshakes, no padlocks, no coins, no dollar-sign clip art, no gradients outside the palette, no emojis on the artwork.

## Formats
- Feed post: 1080×1350 (4:5). Carousel slides share one continuous background so swiping feels like the camera moving.
- Story/Reel cover: 1080×1920, keep text inside the central 1080×1420 safe area.
- Single square post when asked: 1080×1080.
- Text on the artwork: max ~20 words. Minimum body size 28 px at 1080 wide.

## Content pillars (rotate through them)
1. Feature reveal: one workflow step per post (use the matching motif).
2. Red-flag explainer: one money-laundering pattern (e.g. structuring, rapid in-and-out) in plain language, plus how Lumora flags it.
3. Compliance myth vs fact: short, accurate, no legal advice.
4. Product in context: a stylised, fictional screen (alert queue, risk breakdown, SAR draft) floating in the dark scene.
5. Call to action: "Find the risk before it finds you." + "Book a demo · link in bio".

## For every post, deliver
1. The artwork (for carousels: every slide, numbered).
2. A caption: hook line, 2–4 short lines of value, a CTA, then 5–8 relevant hashtags (#AML #Compliance #RegTech #FinCrime #KYC #Fintech #MobileMoney #RiskManagement — choose what fits).
3. Alt text describing the image in one or two sentences.
4. One line on which pillar and motif it uses.

Keep every post in the series visually consistent, as if they were frames from the same film.

Batch request: Design a launch set of 6 feed posts: (1) teaser with the scrambled headline "EVERY RISK. FOUND.", (2) a 5-slide carousel walking through Monitoring → Screening → Risk score → Alerts → SAR, (3) a red-flag explainer on structuring, (4) the risk dial post, (5) a myth-vs-fact post on false positives, (6) the "Find the risk before it finds you" CTA. Also make one matching Story cover.
```
