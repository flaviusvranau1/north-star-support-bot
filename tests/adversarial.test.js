'use strict';

/*
 * Adversarial QA suite for the North Star support bot.
 *
 * Ground rules used here:
 *  - Where the "right" behavior is debatable we do NOT assert exact wording;
 *    we assert "not the generic fallback" and/or state ∈ {expected set},
 *    with a `// DEBATABLE:` comment explaining the interpretation.
 *  - Failing tests are kept on purpose — they document real weaknesses.
 *
 * Run: node --test tests/adversarial.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const intents = require('../js/intents.js');
const flows = require('../js/flows.js');

// ---------------------------------------------------------------- helpers

const KNOWN_STATES = new Set([
  'MAIN_MENU',
  'AWAITING_ORDER_NUMBER',
  'ORDER_FOLLOWUP',
  'RECO_ACTIVITY',
  'RECO_TYPE',
  'LIVE_AGENT',
]);

// The two texts the engine uses for "I did not understand you".
const FALLBACK_RE = /didn't quite catch|still not catching/i;

const MENU_VALUES = [
  'track my order',
  'returns and exchanges',
  'gear recommendations',
  'shipping info',
  'talk to a human',
];

function allText(r) {
  return r.messages.map((m) => m.text).join('\n');
}

function chipValues(r) {
  return (r.quickReplies || []).filter((c) => c.value).map((c) => c.value);
}

function hasFullMenu(r) {
  const values = chipValues(r);
  return MENU_VALUES.every((v) => values.includes(v));
}

/** Fresh session, greeted, then driven through `inputs`. */
function drive(inputs) {
  const s = flows.createSession();
  let r = flows.greeting(s);
  for (const input of inputs) r = flows.respond(s, input);
  return { s, r };
}

function expectIntent(text, expectedId) {
  const result = intents.detectIntent(text);
  assert.ok(result, `expected "${text}" to be recognized, got null`);
  assert.equal(
    result.id,
    expectedId,
    `expected "${text}" -> ${expectedId}, got ${result.id}`
  );
}

/** Structural sanity for any response object. */
function assertShape(r, label) {
  assert.ok(r && typeof r === 'object', `${label}: no response object`);
  assert.ok(Array.isArray(r.messages), `${label}: messages not an array`);
  assert.ok(r.messages.length > 0, `${label}: empty messages`);
  for (const m of r.messages) {
    assert.equal(typeof m.text, 'string', `${label}: message text not a string`);
    assert.ok(m.text.trim().length > 0, `${label}: blank message text`);
    assert.ok(
      ['bot', 'agent', 'system'].includes(m.author),
      `${label}: unknown author "${m.author}"`
    );
  }
  assert.ok(KNOWN_STATES.has(r.state), `${label}: unknown state "${r.state}"`);
}

// ================================================================
// 1. Paraphrases a real customer would type
// ================================================================

test('paraphrase: "my package never arrived" is an order-tracking request', () => {
  expectIntent('my package never arrived', 'track_order');
  const { r } = drive(['my package never arrived']);
  assert.equal(r.state, 'AWAITING_ORDER_NUMBER');
});

test('paraphrase: "yo where my stuff at" is an order-tracking request', () => {
  expectIntent('yo where my stuff at', 'track_order');
});

test('paraphrase: "can u check order status" is an order-tracking request', () => {
  expectIntent('can u check order status', 'track_order');
});

test('paraphrase: "I wanna send my boots back" is a return request', () => {
  // A customer sending boots back wants a RETURN. The words "send" and
  // "back" are split by the object ("my boots"), which the phrase list
  // ("send back", "send it back", ...) does not cover.
  expectIntent('I wanna send my boots back', 'returns');
});

test('paraphrase: "need to swap this for a large" is a return/exchange request', () => {
  expectIntent('need to swap this for a large', 'returns');
});

test('paraphrase: "do u guys do refunds" is a return request', () => {
  expectIntent('do u guys do refunds', 'returns');
});

test('paraphrase: "help me pick a tent for the summer" is a recommendation request', () => {
  expectIntent('help me pick a tent for the summer', 'recommendations');
});

test('paraphrase: "get me customer service" is a human-handoff request', () => {
  expectIntent('get me customer service', 'human_handoff');
  const { r } = drive(['get me customer service']);
  assert.equal(r.state, 'LIVE_AGENT');
});

// ================================================================
// 2. Mixed / conflicting intents — assert a DEFENSIBLE branch
// ================================================================

test('conflict: "I don\'t want to return anything, just track my order" → tracking', () => {
  // The negated "return" must lose to the explicit tracking request.
  const { r } = drive(["I don't want to return anything, just track my order"]);
  assert.equal(r.state, 'AWAITING_ORDER_NUMBER');
  assert.doesNotMatch(allText(r), /30-day/);
});

test('conflict: "track my return" picks a defensible branch', () => {
  // DEBATABLE: could be tracking a return shipment or starting a return.
  // Documented behavior: tie at score 3 → track_order wins by priority
  // order, so the bot asks for an order number. Either branch is fine;
  // the fallback is not.
  const { r } = drive(['track my return']);
  assert.doesNotMatch(allText(r), FALLBACK_RE);
  assert.ok(
    ['AWAITING_ORDER_NUMBER', 'MAIN_MENU'].includes(r.state),
    `unexpected state ${r.state}`
  );
});

test('conflict: "I want a refund for order 222" resolves to the returns flow', () => {
  // DEBATABLE: the user names an order, but the *ask* is a refund.
  // Documented behavior: returns intent wins (refund=3, no tracking
  // phrase matches), so the bot shows the return policy and the order
  // number is ignored. Defensible; must not be the fallback.
  const { r } = drive(['I want a refund for order 222']);
  assert.doesNotMatch(allText(r), FALLBACK_RE);
  assert.match(allText(r), /return|30-day/i);
});

test('conflict: "where is my refund" gets a real answer, not the fallback', () => {
  // DEBATABLE: refund-status is neither pure tracking nor pure returns.
  // Documented behavior: tie at 3 → track_order wins → asks for an order
  // number. Sensible enough.
  const { r } = drive(['where is my refund']);
  assert.doesNotMatch(allText(r), FALLBACK_RE);
  assert.ok(
    ['AWAITING_ORDER_NUMBER', 'MAIN_MENU'].includes(r.state),
    `unexpected state ${r.state}`
  );
});

// ================================================================
// 3. State hijacking — global intents from every state
// ================================================================

test('hijack: human request while being asked about activity (RECO_ACTIVITY)', () => {
  const { r } = drive(['gear recommendations', 'I need to speak to someone']);
  assert.equal(r.state, 'LIVE_AGENT');
});

test('hijack: human request while being asked apparel-or-gear (RECO_TYPE)', () => {
  const { r } = drive([
    'gear recommendations',
    'camping',
    'just get me a real person',
  ]);
  assert.equal(r.state, 'LIVE_AGENT');
});

test('hijack: "main menu" while awaiting an order number', () => {
  const { r } = drive(['track my order', 'main menu']);
  assert.equal(r.state, 'MAIN_MENU');
  assert.ok(hasFullMenu(r), 'expected the five main-menu chips');
});

test('hijack: returns request inside ORDER_FOLLOWUP', () => {
  const { r } = drive(['track my order', '333', 'actually I want to return it']);
  assert.match(allText(r), /30-day/);
  assert.equal(r.state, 'MAIN_MENU');
});

test('hijack: shipping question while being asked about activity', () => {
  const { r } = drive([
    'gear recommendations',
    'wait, how long does shipping take?',
  ]);
  assert.match(allText(r), /3–5 business days/);
});

test('hijack: "never mind" while awaiting an order number escapes the flow', () => {
  const { r } = drive(['track my order', 'never mind']);
  assert.equal(r.state, 'MAIN_MENU');
});

test('hijack: "cancel" while awaiting an order number should abort to the menu', () => {
  // DEBATABLE: "cancel" is an unambiguous abort. The escape hatch in
  // AWAITING_ORDER_NUMBER requires intent score >= 3 but "cancel" only
  // scores 2 (menu), so the bot nags for a number instead of letting go.
  const { r } = drive(['track my order', 'cancel']);
  assert.equal(r.state, 'MAIN_MENU');
});

// ================================================================
// 4. Mock-data edge cases (exact-match order numbers)
// ================================================================

test('data: "0111" is NOT order #111 (exact match, leading zero preserved)', () => {
  assert.equal(intents.extractOrderNumber('0111'), '0111');
  const { r } = drive(['track my order', '0111']);
  assert.match(allText(r), /can't find/i);
  assert.equal(r.state, 'AWAITING_ORDER_NUMBER');
});

test('data: "#  222" with extra spaces still resolves to order 222', () => {
  assert.equal(intents.extractOrderNumber('#  222'), '222');
  const { r } = drive(['track my order', '#  222']);
  assert.match(allText(r), /processing/i);
  assert.match(allText(r), /24 hours/i);
});

test('data: "order 111 and 222" — first number wins (documented)', () => {
  // DEBATABLE: two orders in one message. Documented behavior: the
  // extractor takes the FIRST number, so the bot reports #111 (shipped)
  // and silently ignores 222. Acceptable; fallback would not be.
  const { r } = drive(['order 111 and 222']);
  assert.doesNotMatch(allText(r), FALLBACK_RE);
  assert.match(allText(r), /shipped/i);
});

test('data: a 10-digit number is invalid', () => {
  const { r } = drive(['track my order', '9999999999']);
  assert.match(allText(r), /can't find/i);
  assert.equal(r.state, 'AWAITING_ORDER_NUMBER');
});

test('data: "111111" is invalid (no prefix/substring matching)', () => {
  const { r } = drive(['track my order', '111111']);
  assert.match(allText(r), /can't find/i);
});

test('data: bare "333" typed at the main menu goes straight to delivered + follow-up', () => {
  const { r } = drive(['333']);
  assert.match(allText(r), /delivered/i);
  assert.equal(r.state, 'ORDER_FOLLOWUP');
});

// ================================================================
// 5. Input hygiene
// ================================================================

test('hygiene: empty string and whitespace-only input do not crash', () => {
  let { s, r } = drive([]);
  r = flows.respond(s, '');
  assertShape(r, 'empty string');

  ({ s } = drive([]));
  r = flows.respond(s, '   \t  ');
  assertShape(r, 'whitespace only');
});

test('hygiene: null / undefined input does not crash', () => {
  const { s } = drive([]);
  assertShape(flows.respond(s, null), 'null input');
  const { s: s2 } = drive([]);
  assertShape(flows.respond(s2, undefined), 'undefined input');
});

test('hygiene: emoji-only input falls back gracefully', () => {
  const { s } = drive([]);
  const r = flows.respond(s, '📦🏕️');
  assertShape(r, 'emoji only');
  // With zero recognizable signal, the fallback IS the right answer.
  assert.match(allText(r), FALLBACK_RE);
});

test('hygiene: 500 characters of gibberish do not crash and hit the fallback', () => {
  const gibberish = 'xq zv jk wm '.repeat(42).slice(0, 500);
  const { s } = drive([]);
  const r = flows.respond(s, gibberish);
  assertShape(r, '500-char gibberish');
  assert.match(allText(r), FALLBACK_RE);
});

test('hygiene: ALL CAPS WITH PUNCTUATION still routes correctly', () => {
  const { r } = drive(['WHERE IS MY ORDER?!?!?!']);
  assert.equal(r.state, 'AWAITING_ORDER_NUMBER');
});

test('hygiene: curly apostrophe (U+2019) is normalized', () => {
  const { r } = drive(['where’s my order']);
  assert.equal(r.state, 'AWAITING_ORDER_NUMBER');
});

test('hygiene: HTML in the input is neutralized and intent still detected', () => {
  const { r } = drive(['<b>track</b> my order <script>alert(1)</script>']);
  assert.equal(r.state, 'AWAITING_ORDER_NUMBER');
  for (const m of r.messages) {
    assert.equal(typeof m.text, 'string');
  }
});

test('hygiene: whitespace while awaiting an order number gets an on-topic reprompt', () => {
  // DEBATABLE: respond() short-circuits empty input to the generic
  // main-menu fallback BEFORE the state switch, so the user who pressed
  // Enter on an empty box mid-flow is told "here's what I can help with"
  // with main-menu chips while the state silently stays
  // AWAITING_ORDER_NUMBER. Expected: the state handler's own reprompt.
  const { s } = drive(['track my order']);
  const r = flows.respond(s, '   ');
  assert.equal(r.state, 'AWAITING_ORDER_NUMBER');
  assert.doesNotMatch(allText(r), FALLBACK_RE);
});

// ================================================================
// 6. Fallback mechanics
// ================================================================

test('fallback: escalation fires at exactly the 2nd consecutive miss', () => {
  const { s } = drive([]);
  const r1 = flows.respond(s, 'florp glarb');
  assert.match(allText(r1), /didn't quite catch/i);
  assert.ok(
    !chipValues(r1).includes('talk to a live agent'),
    'strike 1 must NOT offer the escalation chip yet'
  );

  const r2 = flows.respond(s, 'wibble zorp');
  assert.match(allText(r2), /still not catching/i);
  assert.ok(
    chipValues(r2).includes('talk to a live agent'),
    'strike 2 must offer the escalation chip'
  );

  const r3 = flows.respond(s, 'talk to a live agent');
  assert.equal(r3.state, 'LIVE_AGENT');
});

test('fallback: strikes reset after ANY successful intent (thanks)', () => {
  const { s } = drive([]);
  flows.respond(s, 'florp glarb'); // strike 1
  flows.respond(s, 'thanks!'); // success — resets
  const r = flows.respond(s, 'florp glarb');
  assert.match(allText(r), /didn't quite catch/i); // strike 1 again
  assert.doesNotMatch(allText(r), /still not catching/i);
});

test('fallback inside AWAITING_ORDER_NUMBER: 2nd non-number offers the agent', () => {
  const { s } = drive(['track my order']);
  const r1 = flows.respond(s, 'hmm let me look for it');
  assert.match(allText(r1), /just need the number/i);
  assert.ok(!chipValues(r1).includes('talk to a live agent'));

  const r2 = flows.respond(s, 'i really cannot see it anywhere');
  assert.ok(
    chipValues(r2).includes('talk to a live agent'),
    '2nd miss should offer a live agent'
  );
  assert.equal(r2.state, 'AWAITING_ORDER_NUMBER');

  const r3 = flows.respond(s, 'talk to a live agent');
  assert.equal(r3.state, 'LIVE_AGENT');
});

test('fallback inside RECO_ACTIVITY: 2nd miss escalates, chip enters LIVE_AGENT', () => {
  const { s } = drive(['gear recommendations']);
  const r1 = flows.respond(s, 'florp glarb');
  assert.equal(r1.state, 'RECO_ACTIVITY');
  assert.doesNotMatch(allText(r1), /still not catching/i);

  const r2 = flows.respond(s, 'wibble zorp');
  assert.ok(chipValues(r2).includes('talk to a live agent'));

  const r3 = flows.respond(s, 'talk to a live agent');
  assert.equal(r3.state, 'LIVE_AGENT');
});

test('fallback inside RECO_TYPE: 2nd miss escalates', () => {
  const { s } = drive(['gear recommendations', 'camping']);
  assert.equal(s.state, 'RECO_TYPE');
  flows.respond(s, 'florp glarb');
  const r = flows.respond(s, 'wibble zorp');
  assert.ok(chipValues(r).includes('talk to a live agent'));
});

// ================================================================
// 7. ORDER_FOLLOWUP nuance (delivered order #333)
// ================================================================

test('followup: mixed signal "everything was fine but one strap is missing" → issue path', () => {
  const { r } = drive([
    'track my order',
    '333',
    'everything was fine but one strap is missing',
  ]);
  assert.match(allText(r), /sorry/i);
  assert.ok(chipValues(r).includes('returns and exchanges'));
});

test('followup: "all good thanks!" → happy path', () => {
  const { r } = drive(['track my order', '333', 'all good thanks!']);
  assert.match(allText(r), /glad/i);
  assert.equal(r.state, 'MAIN_MENU');
});

test('followup: "no problems at all!" is a positive answer, not an issue', () => {
  // YES_RE explicitly lists "no problems?" as a positive signal, but
  // ISSUE_RE contains \bno\b, and isYes() vetoes on any ISSUE_RE hit —
  // so the phrase the engine itself declares positive lands on the
  // "Oh no, sorry about that!" issue path.
  const { r } = drive(['track my order', '333', 'no problems at all!']);
  assert.match(allText(r), /glad/i);
  assert.doesNotMatch(allText(r), /sorry/i);
});

test('followup: "everything arrived in good shape" → happy path', () => {
  const { r } = drive([
    'track my order',
    '333',
    'everything arrived in good shape',
  ]);
  assert.match(allText(r), /glad/i);
});

test('followup: "yes but actually can I return it" — documented behavior', () => {
  // DEBATABLE: the "yes" wins, so the bot celebrates and DROPS the
  // return request. Defensible only because the full menu (incl.
  // returns) is offered right after; documenting rather than failing.
  const { r } = drive([
    'track my order',
    '333',
    'yes but actually can I return it',
  ]);
  assert.doesNotMatch(allText(r), FALLBACK_RE);
  assert.equal(r.state, 'MAIN_MENU');
  assert.ok(hasFullMenu(r), 'user must be able to reach returns from here');
});

// ================================================================
// 8. Live agent behavior
// ================================================================

test('live agent: 7 consecutive messages rotate replies without crashing', () => {
  const { s } = drive(['talk to a human']);
  for (let i = 0; i < 7; i++) {
    const r = flows.respond(s, `message number ${'x'.repeat(i + 1)}`);
    assertShape(r, `agent message ${i + 1}`);
    assert.equal(r.state, 'LIVE_AGENT');
    assert.equal(r.messages[0].author, 'agent');
    assert.ok(
      chipValues(r).includes('main menu'),
      'every agent reply must offer a way back'
    );
  }
});

test('live agent: "bye", "back" and "menu" all exit to MAIN_MENU', () => {
  for (const exitWord of ['bye', 'back', 'menu']) {
    const { s } = drive(['talk to a human']);
    const r = flows.respond(s, exitWord);
    assert.equal(r.state, 'MAIN_MENU', `"${exitWord}" should exit the agent chat`);
    assert.ok(hasFullMenu(r), `"${exitWord}" should reshow the menu`);
  }
});

test('live agent: session is not corrupted after exit (bot flows work again)', () => {
  const { s } = drive(['talk to a human', 'my zipper split', 'main menu']);
  let r = flows.respond(s, 'track my order');
  assert.equal(r.state, 'AWAITING_ORDER_NUMBER');
  r = flows.respond(s, '111');
  assert.match(allText(r), /shipped/i);
  assert.equal(r.state, 'MAIN_MENU');
});

test('live agent: chatting about "heading back home" must not eject the user', () => {
  // DEBATABLE: exit only needs a menu/goodbye intent at score >= 2, and
  // "back"(2) + "home"(2) = 4 → the user telling the agent about travel
  // plans gets silently dumped back to the bot mid-conversation.
  const { s } = drive(['talk to a human']);
  const r = flows.respond(s, 'my flight lands and I head back home friday');
  assert.equal(r.state, 'LIVE_AGENT');
});

// ================================================================
// 9. THE CRAWLER INVARIANT — every quick-reply chip must work
// ================================================================

/**
 * BFS over chip values. Sessions mutate, so every node re-drives its full
 * input path on a fresh session (deterministic engine → identical replay).
 * Asserts, for every chip-reached node: no crash, non-empty plain-string
 * messages, a known state, at least one way onward, and NEVER the
 * "didn't catch" fallback (a chip the bot itself offered must always be
 * understood).
 */
function crawlFrom(seedInputs, { maxDepth = 4, maxNodes = 300 } = {}) {
  const violations = [];
  const seen = new Set();
  const queue = [{ path: seedInputs.slice(), depth: 0 }];
  let checked = 0;

  function playPath(path) {
    const s = flows.createSession();
    let r = flows.greeting(s);
    for (const input of path) r = flows.respond(s, input);
    return r;
  }

  while (queue.length > 0 && checked < maxNodes) {
    const { path, depth } = queue.shift();
    let r;
    try {
      r = playPath(path);
    } catch (err) {
      violations.push(`CRASH on [${path.join(' > ')}]: ${err.message}`);
      continue;
    }
    checked += 1;

    const label = path.length ? path.join(' > ') : '<greeting>';
    const values = chipValues(r);
    const isChipNode = path.length > seedInputs.length;

    if (!Array.isArray(r.messages) || r.messages.length === 0) {
      violations.push(`empty messages at [${label}]`);
    } else if (
      r.messages.some((m) => typeof m.text !== 'string' || !m.text.trim())
    ) {
      violations.push(`non-string/blank message at [${label}]`);
    }
    if (!KNOWN_STATES.has(r.state)) {
      violations.push(`unknown state "${r.state}" at [${label}]`);
    }
    if (values.length === 0 && !(r.quickReplies || []).some((c) => c.url)) {
      violations.push(`dead end (no chips at all) at [${label}]`);
    }
    if (isChipNode && FALLBACK_RE.test(allText(r))) {
      violations.push(
        `chip "${path[path.length - 1]}" from [${path
          .slice(0, -1)
          .join(' > ')}] produced the fallback`
      );
    }

    if (depth >= maxDepth) continue;
    const key =
      r.state + '|' + values.join(',') + '|' + (path[path.length - 1] || '');
    if (seen.has(key)) continue;
    seen.add(key);
    for (const v of values) queue.push({ path: path.concat(v), depth: depth + 1 });
  }

  return { violations, checked };
}

test('CRAWLER: every chip reachable from greeting() always works (depth 4)', () => {
  const { violations, checked } = crawlFrom([], { maxDepth: 4, maxNodes: 300 });
  assert.ok(checked >= 20, `crawler only visited ${checked} nodes — too few`);
  assert.deepEqual(violations, []);
});

test('CRAWLER: chips reachable from the delivered-order follow-up all work', () => {
  const { violations } = crawlFrom(['track my order', '333'], { maxDepth: 3 });
  assert.deepEqual(violations, []);
});

test('CRAWLER: escalation chips after two strikes at the menu all work', () => {
  // Seed path itself is a double miss (fallback expected there); every
  // chip offered on the escalation card must still work.
  const { violations } = crawlFrom(['florp glarb', 'wibble zorp'], {
    maxDepth: 3,
  });
  assert.deepEqual(violations, []);
});

test('CRAWLER: escalation chips after two invalid order numbers all work', () => {
  const { violations } = crawlFrom(['track my order', '999', '4242'], {
    maxDepth: 3,
  });
  assert.deepEqual(violations, []);
});

// ================================================================
// 10. Return-to-main-flow invariant after every happy path
// ================================================================

test('invariant: all five happy paths end with the full menu or a way onward', () => {
  // 1. Order tracking (#111)
  let { r } = drive(['track my order', '111']);
  assert.ok(hasFullMenu(r), 'after tracking: full menu expected');
  assert.equal(r.state, 'MAIN_MENU');

  // 2. Returns
  ({ r } = drive(['returns and exchanges']));
  assert.ok(hasFullMenu(r), 'after returns: full menu expected');
  assert.ok(
    r.quickReplies.some((c) => c.url && /returns/.test(c.url)),
    'returns flow must include the portal link'
  );

  // 3. Recommendations
  ({ r } = drive(['gear recommendations', 'camping', 'gear']));
  assert.ok(hasFullMenu(r), 'after recommendation: full menu expected');
  assert.equal(r.state, 'MAIN_MENU');

  // 4. Shipping info
  ({ r } = drive(['shipping info']));
  assert.ok(hasFullMenu(r), 'after shipping: full menu expected');
  assert.equal(r.state, 'MAIN_MENU');

  // 5. Human handoff — way onward is the back chip, then the full menu.
  const handoff = drive(['talk to a human']);
  assert.ok(
    chipValues(handoff.r).includes('main menu'),
    'agent state must offer a way back'
  );
  const back = flows.respond(handoff.s, 'main menu');
  assert.ok(hasFullMenu(back), 'after leaving the agent: full menu expected');
  assert.equal(back.state, 'MAIN_MENU');
});
