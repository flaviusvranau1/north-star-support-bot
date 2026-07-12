# PROJECT_CONTEXT — North Star Support Bot

> Living development journal. Read this file first when picking up the
> project. Updating it is part of the definition of done for every task.

## 1. Project Overview

Customer support chatbot for **North Star Outfitters**, a (simulated) small
e-commerce business selling outdoor apparel and camping gear. Built as a
deliverable for the **Upwork Talent Accelerator** program (contract accepted
2026-07-12, submission SLA 24–48h).

Required use cases: order tracking (mock data), returns & exchanges,
product recommendations (1–2 clarifying questions), human handoff with a
simulated Live Agent state, plus intent recognition across phrasing
variations and a 2-strike fallback.

Hard constraint from the brief: evaluators must be able to test **without
API keys, accounts or setup steps** → the bot is fully client-side and
rule-based (no LLM, no backend).

## 2. Stack & Architecture

- Vanilla HTML/CSS/JS, **zero runtime dependencies, no build step** — works
  from `file://` or any static host (GitHub Pages).
- Classic scripts (not ES modules) so double-clicking `index.html` works;
  each `js/*.js` file also exports via CommonJS for Node's test runner.
- Layers:
  - `js/data.js` — all copy, mock orders, policies, recommendation matrix.
  - `js/intents.js` — pure intent engine: normalize → weighted word-boundary
    phrase scoring → best intent (threshold 2, priority tie-break).
  - `js/flows.js` — conversation state machine (no DOM).
  - `js/app.js` — DOM rendering: bubbles, quick replies, typing indicator.
- Tests: `node --test` (Node 22), no test framework dependency.
- Demo video: `demo/record-demo.js` (playwright-core, devDependency only).

## 3. Decisions & Rationale

- **2026-07-12 — Rule-based, client-side only.** An LLM bot would require an
  API key, which the brief explicitly disqualifies (§7.a.i). Deterministic
  keyword scoring is fully testable and reviewable.
- **2026-07-12 — Classic scripts over ES modules.** ES modules fail on
  `file://` (CORS); evaluators may just double-click index.html. The
  `module.exports` guard at the bottom of each file keeps Node tests happy.
- **2026-07-12 — Quick replies AND free text everywhere.** Chips make flows
  guided (evaluation criterion 6.b); free text proves intent recognition
  (criterion 6.d). Chip values are natural phrases routed through the same
  intent engine as typed input — one code path.

## 4. Step Journal (newest first)

- **2026-07-13 — Hardening pass (adversarial QA).** Independent QA agent
  wrote `tests/adversarial.test.js` (52 tests: hostile paraphrases, state
  hijacking, mock-data edges, input hygiene, live-agent stress, chip
  crawler). 5 failures found and fixed: (1) "send my boots back" → gap-
  tolerant `send/mail/ship … back` regexes (intent engine now accepts RegExp
  phrases); (2) "cancel" now escapes AWAITING_ORDER_NUMBER (weight 2→3), and
  "cancel … order" routes to the live agent; (3) empty input gets a state-
  aware reprompt instead of a state-mismatched global fallback; (4) "no
  problems!" idioms neutralized before the yes/issue check so they hit the
  happy path; (5) leaving the live agent now requires an explicit exit
  phrase (bare "back"/"menu"/"bye" work; "I head back home friday" doesn't
  eject). Also: recommendation slot memory ("help me pick a tent" won't
  re-ask apparel-vs-gear — with a guard so the "gear recommendations" chip
  doesn't pre-fill "gear"), contact/phone → handoff, OG meta tags,
  focus-visible rings, prefers-reduced-motion, mobile 375px verified.
  81/81 tests green; both headline fixes re-verified in the real UI.

- **2026-07-13 — Phases 3–4: docs, GitHub, video.** Evaluator README with
  requirements map + 60-second test drive. Public repo
  `flaviusvranau1/north-star-support-bot`, GitHub Pages enabled (main /).
  Demo video auto-recorded with playwright-core (system Chrome, headless,
  1280×720) driving the real UI over `demo/serve.js`; presenter captions
  injected beside the card; ffmpeg webm→mp4. First cut was 1:37 — retuned
  pacing + added shipping-info segment → 2:13 (brief wants 2–3 min). Video
  committed at demo/recordings/north-star-demo.mp4 and linked in README.
  `demo/VIDEO-SCRIPT.md` mirrors it for a manual voice-over re-record.

- **2026-07-13 — Phase 2: chat UI + browser E2E.** index.html/styles.css/
  app.js: bubbles, avatars (bot ★ pine / agent A amber), typing indicator
  with length-scaled delay, quick-reply chips (buttons + link chips), header
  status that flips to "Live Agent — Alex · simulated", restart button,
  demo hint bar, mobile breakpoint. `demo/serve.js` (zero-dep static server,
  port 5250) for previewing/recording. Bugs found & fixed during real
  browser testing: (1) Enter while the bot was "typing" swallowed the
  user's draft — submit now keeps the draft when busy; (2) "where is order
  333" (no "my") fell to fallback — added number+order-word rule in
  handleMainMenu. E2E verified in browser: all 4 use cases, shipping info,
  2-strike fallback, escalation, handoff and return to menu. 29/29 tests.
- **2026-07-12 — Phase 0: foundation.** git init, scaffold, `data.js`
  (orders #111/#222/#333 exactly per brief, return policy, shipping times,
  recommendation matrix), `intents.js` (9 intents, weighted phrases,
  yes/issue + activity/type slot matchers), 12 unit tests — all passing.
  Fixed during testing: plural coverage (refunds/rains), "send THIS back"
  phrasing beating the menu intent's "back".

## 5. Current Status

- **Done:** Phases 0–4 + adversarial hardening pass (81/81 tests).
- **Next:** Phase 5 — Upwork submission (Flavius reviews video, submits).

## 6. Known Issues & TODO

- [ ] Phase 5: Flavius reviews the video (optionally re-records with voice
      per demo/VIDEO-SCRIPT.md) and submits on Upwork
- [ ] Verify GitHub Pages URL renders after first build

## 7. How to Run

- Open `index.html` in any browser (no server needed), or serve statically.
- Tests: `node --test` from the repo root (Node ≥ 18).

## 8. Conventions

- Conventional Commits, English. Feature branches → merge `--no-ff` to main.
- All bot copy lives in `data.js` — never hardcode strings in the engine.
- Intent phrases are lowercase, matched after `normalize()` — when adding
  phrases, add a test with a natural-language variation.

## 9. Instructions for the Next AI / Developer

- The mock order logic (§3.c of the brief) is sacred: 111 → shipped/
  arriving tomorrow, 222 → processing/ships in 24h, 333 → delivered +
  follow-up, anything else → invalid. Don't "improve" it.
- Keep the zero-dependency constraint: nothing in `index.html` may fetch
  external resources (fonts, CDNs) — evaluators may be offline.
