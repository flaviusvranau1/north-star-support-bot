# ⭐ North Star Support Bot

A customer support chatbot for **North Star Outfitters** — a (simulated) small
e-commerce business selling outdoor apparel and camping gear in North America.

**▶ Live demo (nothing to install):** https://flaviusvranau1.github.io/north-star-support-bot/

Built for the Upwork Talent Accelerator program. Friendly, outdoorsy, concise —
and fully rule-based: **no API keys, no accounts, no build step, no external
services**. Everything runs in the browser.

---

## Quick start for evaluators

| Option | How |
|---|---|
| **Online** | Open the [live demo](https://flaviusvranau1.github.io/north-star-support-bot/) |
| **Local, zero setup** | Clone/download the repo and double-click `index.html` |
| **Local server (optional)** | `node demo/serve.js` → http://localhost:5250 |

### 60-second test drive

1. **Order tracking** — click *📦 Track my order* (or type "Where's my package?").
   Try **#111** (shipped, arriving tomorrow), **#222** (processing, ships in
   24 hours), **#333** (delivered → asks a follow-up), and any other number
   (invalid, with retry + agent offer after 2 misses).
2. **Returns & exchanges** — type "How do returns work?" → 30-day / unused /
   original-packaging policy + a *Start a return* link.
3. **Recommendations** — type "Recommend something for me" → 1–2 clarifying
   questions (adventure type, apparel vs. gear) → a product category. Power
   move: "recommend a jacket for winter trips" skips questions it can already
   answer.
4. **Human handoff** — type "talk to a human" (or fail twice on purpose).
   The header flips to **Live Agent — Alex**, a simulated agent takes over,
   and *⬅ Back to main menu* returns you to the bot at any time.
5. **Fallback** — type gibberish once (polite re-prompt with options), twice
   (escalation offer to a live agent).

---

## Requirements coverage (submission checklist)

| Brief requirement | Where |
|---|---|
| Order tracking with exact mock data (§3.c) | `js/data.js` → `orders`; flows in `js/flows.js` |
| #111 shipped/arriving tomorrow · #222 processing/24h · #333 delivered + follow-up · other → invalid | verified by `tests/flows.test.js` |
| Return policy: 30-day, unused, original packaging (§3.d.i) | `js/data.js` → `returnPolicy` + returns link chip |
| Shipping: standard 3–5, expedited 1–2 business days (§3.d.ii) | `js/data.js` → `shipping`; also woven into order #222's reply |
| Recommendations with 1–2 clarifying questions (§2.a.iii) | activity → type → category matrix |
| Human handoff + simulated Live Agent state (§3.e) | `LIVE_AGENT` state; clear transition messages; return to menu anytime |
| Fallback: "didn't understand" + options, then escalation (§3.e.ii) | 2-strike fallback in `js/flows.js` |
| Intent variations ("Where is my order?" vs "Track my package") (§3.a) | weighted-phrase engine in `js/intents.js`, unit-tested |
| Return to main flow after every resolution (§3.b.ii) | every flow ends with "Anything else…?" + main menu |
| Reviewable with no API keys / accounts / setup (§7.a) | static HTML/CSS/JS, zero dependencies |

---

## How it works

```
index.html
├── js/data.js     ← every string, mock order, policy & recommendation (single source of truth)
├── js/intents.js  ← intent engine: normalize → weighted word-boundary phrase scoring → best intent
├── js/flows.js    ← conversation state machine (MAIN_MENU, AWAITING_ORDER_NUMBER,
│                    ORDER_FOLLOWUP, RECO_ACTIVITY, RECO_TYPE, LIVE_AGENT)
└── js/app.js      ← rendering: bubbles, typing indicator, quick replies, header status
```

Design notes:

- **Chips and free text share one code path.** Every quick-reply chip sends a
  natural phrase through the same intent engine as typed input — guided flows
  and free-form intent recognition can't drift apart.
- **Global intents work from any state.** Asking for a human mid-flow, or
  saying "main menu", always works.
- **Deterministic by design.** A rules engine (not an LLM) means the mock
  order logic is followed *exactly* and the bot is testable offline.

## Automated tests

```bash
node --test        # Node ≥ 18, no dependencies
```

29 tests: intent recognition across phrasing variations (5–8 per intent),
conflict resolution between overlapping intents, order-number extraction,
the exact mock-order behaviors, fallback strikes, handoff and return-to-menu.

## Video demo

**▶ [demo/recordings/north-star-demo.mp4](demo/recordings/north-star-demo.mp4)**
(2:13) — all four use cases + a fallback scenario, following
[demo/VIDEO-SCRIPT.md](demo/VIDEO-SCRIPT.md).

## Project layout extras

- `PROJECT_CONTEXT.md` — development journal (decisions, phases, verification)
- `demo/VIDEO-SCRIPT.md` — shot-by-shot script of the demo video
- `demo/record-demo.js` — Playwright script that replays the demo conversation
  (used to record the video; not needed to run the bot)

---

*Demo project — orders, the returns portal link and the live agent are simulated.*
