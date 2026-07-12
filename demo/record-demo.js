/*
 * Records the 2–3 minute demo video automatically.
 * Replays the full demo conversation (all 4 use cases + fallback) against a
 * running local server, with presenter captions rendered beside the chat.
 *
 * Not needed to run or review the bot — this is a video-production tool.
 *
 * Usage:
 *   node demo/serve.js                 # in one terminal (port 5250)
 *   node demo/record-demo.js           # needs playwright-core + Chrome
 * If playwright-core isn't installed here, point NODE_PATH at any
 * node_modules that has it, e.g.:
 *   NODE_PATH=../some-project/node_modules node demo/record-demo.js
 * Output: demo/recordings/north-star-demo.webm (+ .mp4 if ffmpeg is on PATH)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright-core');

const URL = process.env.DEMO_URL || 'http://localhost:5250';
const OUT_DIR = path.join(__dirname, 'recordings');
const SIZE = { width: 1280, height: 720 };

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: OUT_DIR, size: SIZE },
  });
  const page = await context.newPage();

  const idle = async () => {
    await page.waitForFunction(
      () => !document.querySelector('.send').disabled,
      null,
      { timeout: 20000 }
    );
    await page.waitForTimeout(850);
  };

  const send = async (text) => {
    await idle();
    await page.click('#input');
    await page.type('#input', text, { delay: 55 });
    await page.waitForTimeout(400);
    await page.keyboard.press('Enter');
    await idle();
  };

  const chip = async (label) => {
    await idle();
    await page.locator('.chip', { hasText: label }).first().click();
    await idle();
  };

  const caption = async (eyebrow, text) => {
    await page.evaluate(
      ({ e, t }) => {
        document.getElementById('cap-eyebrow').textContent = e;
        document.getElementById('cap-text').textContent = t;
      },
      { e: eyebrow, t: text }
    );
  };

  await page.goto(URL);
  await page.waitForSelector('.chip');

  // presenter panel on the empty space left of the chat card
  await page.addStyleTag({
    content: `
      #demo-panel { position: fixed; left: 42px; top: 50%; transform: translateY(-50%);
        width: 330px; z-index: 9999; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; }
      #cap-title { color: #f3c56b; font-size: 15px; font-weight: 700; letter-spacing: 2.5px;
        text-transform: uppercase; margin-bottom: 26px; }
      #cap-eyebrow { color: #f3c56b; font-size: 15px; font-weight: 800; letter-spacing: 1.6px;
        text-transform: uppercase; margin-bottom: 10px; min-height: 20px; }
      #cap-text { color: #ffffff; font-size: 23px; font-weight: 600; line-height: 1.4;
        min-height: 130px; }
      #cap-repo { position: fixed; left: 42px; bottom: 26px; color: rgba(255,255,255,.55);
        font: 500 13px -apple-system, 'Segoe UI', sans-serif; letter-spacing: .4px; }
    `,
  });
  await page.evaluate(() => {
    const panel = document.createElement('div');
    panel.id = 'demo-panel';
    panel.innerHTML =
      '<div id="cap-title">⭐ North Star Support Bot</div>' +
      '<div id="cap-eyebrow"></div><div id="cap-text"></div>';
    document.body.appendChild(panel);
    const repo = document.createElement('div');
    repo.id = 'cap-repo';
    repo.textContent = 'github.com/flaviusvranau1/north-star-support-bot';
    document.body.appendChild(repo);
  });

  // ---------- the demo ----------

  await caption(
    'Video demo',
    'Customer support bot for an outdoor gear store — rule-based, runs in the browser, no API keys.'
  );
  await page.waitForTimeout(6500);

  await caption('Use case 1 · Order tracking', 'Natural phrasing is understood — "Where’s my package?"');
  await send("Where's my package?");
  await send('111');
  await page.waitForTimeout(2800);

  await caption('Use case 1 · Order tracking', 'Order #222 — processing, ships within 24 hours.');
  await send('track order 222');
  await page.waitForTimeout(2600);

  await caption('Use case 1 · Order tracking', 'Order #333 — delivered, with a follow-up question.');
  await send('where is order 333');
  await page.waitForTimeout(900);
  await chip('All good');
  await page.waitForTimeout(2000);

  await caption('Use case 1 · Order tracking', 'Unknown order numbers are rejected gracefully.');
  await chip('Track my order');
  await send('999');
  await page.waitForTimeout(2000);
  await chip('Back to main menu');

  await caption('Use case 2 · Returns & exchanges', '30-day returns, unused items, original packaging — plus a returns link.');
  await send("What's your return policy?");
  await page.waitForTimeout(5200);

  await caption('Bonus · Shipping info', 'Standard 3–5 business days · expedited 1–2.');
  await send('How long does shipping take?');
  await page.waitForTimeout(2600);

  await caption('Use case 3 · Recommendations', 'One or two clarifying questions, then a product category.');
  await chip('Gear recommendations');
  await page.waitForTimeout(700);
  await chip('Hiking');
  await page.waitForTimeout(700);
  await chip('Apparel');
  await page.waitForTimeout(2800);

  await caption('Fallback', 'Unknown input gets a clear "didn’t understand" + options.');
  await send('flibberty gibbets');
  await page.waitForTimeout(2400);

  await caption('Fallback', 'A second miss offers escalation to a live agent.');
  await send('purple monkey dishwasher');
  await page.waitForTimeout(2800);

  await caption('Use case 4 · Human handoff', 'Clear transition to a simulated Live Agent — see the header.');
  await chip('Talk to a live agent');
  await page.waitForTimeout(2000);
  await send('My tent pole snapped on the first trip');
  await page.waitForTimeout(3000);

  await caption('Use case 4 · Human handoff', 'And the user can return to the main menu anytime.');
  await chip('Back to main menu');
  await page.waitForTimeout(3000);

  await caption('That’s the tour ⭐', 'All four use cases + fallback, on exact mock data. Thanks for watching!');
  await page.waitForTimeout(6000);

  // ---------- save ----------

  const video = page.video();
  await context.close();
  const rawPath = await video.path();
  await browser.close();

  const webm = path.join(OUT_DIR, 'north-star-demo.webm');
  fs.copyFileSync(rawPath, webm);
  fs.unlinkSync(rawPath);
  console.log('Saved', webm);

  try {
    const mp4 = path.join(OUT_DIR, 'north-star-demo.mp4');
    execFileSync('ffmpeg', ['-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', mp4], { stdio: 'ignore' });
    console.log('Saved', mp4);
  } catch {
    console.log('ffmpeg not found — .webm only');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
