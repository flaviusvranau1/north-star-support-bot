# Demo video script — North Star Support Bot

Target length: **2–3 minutes.** The auto-recorded version
(`demo/recordings/north-star-demo.mp4`, 2:13) follows exactly this script;
use this document if you want to re-record it manually with narration.

Setup: open the live demo (or `index.html`) in a clean browser window,
start screen recording, then follow the steps. Narration lines are
suggestions — keep them casual.

| # | Time | Do | Say (narration) |
|---|------|----|------------------|
| 1 | 0:00 | Show the loaded chat (greeting + 5 menu chips) | "This is North Star Support Bot — a rule-based support chatbot for an outdoor gear store. It runs fully in the browser: no API keys, no accounts." |
| 2 | 0:10 | Type **"Where's my package?"** | "Use case one: order tracking. Note I'm not using a menu — free text with natural phrasing works." |
| 3 | 0:20 | Type **111** | "Order 111 — shipped, arriving tomorrow, exactly per the mock data." |
| 4 | 0:32 | Type **track order 222** | "222 is processing and ships within 24 hours — and the bot adds the standard shipping times." |
| 5 | 0:45 | Type **where is order 333**, then click **👍 All good** | "333 was delivered, so the bot asks a caring follow-up." |
| 6 | 1:00 | Click **📦 Track my order**, type **999**, then **⬅ Back to main menu** | "Any other number is invalid — with a polite retry." |
| 7 | 1:12 | Type **What's your return policy?** | "Use case two: returns. Thirty-day returns, items unused, original packaging — plus a link to the returns portal." |
| 8 | 1:28 | Type **How long does shipping take?** | "Shipping info: standard three to five business days, expedited one to two." |
| 9 | 1:38 | Click **🏕️ Gear recommendations** → **🥾 Hiking** → **🧥 Apparel** | "Use case three: recommendations. Two quick clarifying questions, then a product category." |
| 10 | 1:55 | Type **flibberty gibbets** | "Fallback: when the bot doesn't understand, it says so clearly and shows the options." |
| 11 | 2:05 | Type **purple monkey dishwasher** | "A second miss offers to escalate to a human." |
| 12 | 2:12 | Click **💬 Talk to a live agent** | "Use case four: human handoff. Clear transition — see the header change to Live Agent." |
| 13 | 2:22 | Type **My tent pole snapped on the first trip** | "The simulated agent replies…" |
| 14 | 2:35 | Click **⬅ Back to main menu** | "…and the user can come back to the bot at any time. That's all four use cases plus fallback. Thanks for watching!" |

## Re-generating the automatic video

```bash
node demo/serve.js                 # terminal 1
node demo/record-demo.js           # terminal 2 (needs playwright-core + Chrome)
```
