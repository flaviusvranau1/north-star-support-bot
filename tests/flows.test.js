'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const flows = require('../js/flows.js');

function allText(response) {
  return response.messages.map((m) => m.text).join('\n');
}
function chipLabels(response) {
  return (response.quickReplies || []).map((c) => c.label).join(' | ');
}

test('greeting shows the main menu with all five options', () => {
  const s = flows.createSession();
  const r = flows.greeting(s);
  assert.match(allText(r), /North Star/);
  assert.equal(r.quickReplies.length, 5);
  assert.match(chipLabels(r), /Track my order/);
  assert.match(chipLabels(r), /Returns & exchanges/);
  assert.match(chipLabels(r), /Gear recommendations/);
  assert.match(chipLabels(r), /Shipping info/);
  assert.match(chipLabels(r), /Talk to a human/);
});

test('order tracking: asks for the number, then reports #111 shipped/arriving tomorrow', () => {
  const s = flows.createSession();
  let r = flows.respond(s, 'Where is my order?');
  assert.equal(r.state, 'AWAITING_ORDER_NUMBER');
  assert.match(allText(r), /order number/i);

  r = flows.respond(s, '111');
  assert.match(allText(r), /shipped/i);
  assert.match(allText(r), /tomorrow/i);
  assert.equal(r.state, 'MAIN_MENU'); // returned to main flow
  assert.match(allText(r), /anything else/i);
});

test('order tracking: #222 processing, ships within 24 hours', () => {
  const s = flows.createSession();
  flows.respond(s, 'track my package');
  const r = flows.respond(s, '#222');
  assert.match(allText(r), /processing/i);
  assert.match(allText(r), /24 hours/i);
  assert.equal(r.state, 'MAIN_MENU');
});

test('order tracking: #333 delivered triggers the follow-up question', () => {
  const s = flows.createSession();
  flows.respond(s, 'order status please');
  let r = flows.respond(s, 'order 333');
  assert.match(allText(r), /delivered/i);
  assert.match(allText(r), /good shape/i);
  assert.equal(r.state, 'ORDER_FOLLOWUP');

  r = flows.respond(s, 'yes, all good!');
  assert.match(allText(r), /glad/i);
  assert.equal(r.state, 'MAIN_MENU');
});

test('order tracking: #333 follow-up with an issue offers returns and live agent', () => {
  const s = flows.createSession();
  flows.respond(s, 'track my order');
  flows.respond(s, '333');
  const r = flows.respond(s, 'the tent pole arrived broken');
  assert.match(allText(r), /sorry/i);
  assert.match(chipLabels(r), /Returns & exchanges/);
  assert.match(chipLabels(r), /live agent/i);
});

test('order tracking: any other number is invalid; second failure offers an agent', () => {
  const s = flows.createSession();
  flows.respond(s, 'track my order');
  let r = flows.respond(s, '999');
  assert.match(allText(r), /can't find/i);
  assert.equal(r.state, 'AWAITING_ORDER_NUMBER');

  r = flows.respond(s, '4242');
  assert.match(allText(r), /can't find/i);
  assert.match(chipLabels(r), /live agent/i);
});

test('order tracking: one-shot "where is order 222" answers directly', () => {
  const s = flows.createSession();
  const r = flows.respond(s, 'where is my order #222?');
  assert.match(allText(r), /processing/i);
  assert.match(allText(r), /24 hours/i);
});

test('order tracking: "order NNN" phrasing without a tracking verb still works', () => {
  let s = flows.createSession();
  let r = flows.respond(s, 'where is order 333');
  assert.match(allText(r), /delivered/i);
  assert.equal(r.state, 'ORDER_FOLLOWUP');

  // a bare number typed at the main menu is treated as an order number
  s = flows.createSession();
  r = flows.respond(s, '111');
  assert.match(allText(r), /shipped/i);

  // but a number buried in unrelated text is not
  s = flows.createSession();
  r = flows.respond(s, 'i have 2 dogs');
  assert.match(allText(r), /didn't quite catch/i);
});

test('returns: full policy + returns link, then back to main flow', () => {
  const s = flows.createSession();
  const r = flows.respond(s, "what's your return policy?");
  const text = allText(r);
  assert.match(text, /30-day/);
  assert.match(text, /unused/i);
  assert.match(text, /original packaging/i);
  const link = r.quickReplies.find((c) => c.url);
  assert.ok(link, 'expected a returns-portal link chip');
  assert.match(link.url, /returns/);
  assert.equal(r.state, 'MAIN_MENU');
  assert.match(text, /anything else/i);
});

test('shipping info: standard 3–5, expedited 1–2 business days', () => {
  const s = flows.createSession();
  const r = flows.respond(s, 'how long does shipping take?');
  const text = allText(r);
  assert.match(text, /Standard shipping: 3–5 business days/);
  assert.match(text, /Expedited shipping: 1–2 business days/);
  assert.equal(r.state, 'MAIN_MENU');
});

test('recommendations: two clarifying questions then a category', () => {
  const s = flows.createSession();
  let r = flows.respond(s, 'can you recommend something?');
  assert.equal(r.state, 'RECO_ACTIVITY');
  assert.match(allText(r), /adventure/i);

  r = flows.respond(s, 'camping');
  assert.equal(r.state, 'RECO_TYPE');
  assert.match(allText(r), /apparel.*gear|gear.*apparel/i);

  r = flows.respond(s, 'gear');
  assert.match(allText(r), /Camping Gear/);
  assert.equal(r.state, 'MAIN_MENU');
  assert.match(allText(r), /anything else/i);
});

test('recommendations: slot-filling skips already-answered questions', () => {
  const s = flows.createSession();
  const r = flows.respond(s, 'recommend a jacket for winter trips');
  assert.match(allText(r), /Winter Apparel/);
  assert.equal(r.state, 'MAIN_MENU');
});

test('human handoff: transition, simulated agent replies, return to menu', () => {
  const s = flows.createSession();
  let r = flows.respond(s, 'I want to talk to a human');
  assert.equal(r.state, 'LIVE_AGENT');
  assert.match(allText(r), /live agent/i);
  assert.ok(r.messages.some((m) => m.author === 'agent'));
  assert.ok(r.messages.some((m) => m.author === 'system'));

  r = flows.respond(s, 'my zipper broke after one hike');
  assert.equal(r.state, 'LIVE_AGENT');
  assert.equal(r.messages[0].author, 'agent');
  assert.match(chipLabels(r), /Back to main menu/);

  r = flows.respond(s, 'main menu');
  assert.equal(r.state, 'MAIN_MENU');
  assert.match(chipLabels(r), /Track my order/);
  assert.match(allText(r), /back with/i);
});

test('fallback: strike one reshows options, strike two offers escalation', () => {
  const s = flows.createSession();
  let r = flows.respond(s, 'blorp flim flam');
  assert.match(allText(r), /didn't quite catch/i);
  assert.match(chipLabels(r), /Track my order/);

  r = flows.respond(s, 'zzz gibberish again');
  assert.match(allText(r), /live agent/i);
  assert.match(chipLabels(r), /Talk to a live agent/);

  r = flows.respond(s, 'talk to a live agent');
  assert.equal(r.state, 'LIVE_AGENT');
});

test('fallback strikes reset after a successful intent', () => {
  const s = flows.createSession();
  flows.respond(s, 'blorp');
  flows.respond(s, 'shipping info'); // success resets strikes
  const r = flows.respond(s, 'blorp again');
  assert.match(allText(r), /didn't quite catch/i); // strike 1 again, not escalation
});

test('global override: asking for a human mid-flow works from any state', () => {
  const s = flows.createSession();
  flows.respond(s, 'track my order');
  assert.equal(s.state, 'AWAITING_ORDER_NUMBER');
  const r = flows.respond(s, 'actually, talk to a human please');
  assert.equal(r.state, 'LIVE_AGENT');
});

test('mid-flow escape: switching to returns while asked for an order number', () => {
  const s = flows.createSession();
  flows.respond(s, 'track my order');
  const r = flows.respond(s, 'never mind, how do returns work?');
  assert.match(allText(r), /30-day/);
});
