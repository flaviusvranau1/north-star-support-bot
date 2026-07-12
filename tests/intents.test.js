'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const intents = require('../js/intents.js');

function expectIntent(text, expectedId) {
  const result = intents.detectIntent(text);
  assert.ok(result, `expected "${text}" to be recognized, got null`);
  assert.equal(
    result.id,
    expectedId,
    `expected "${text}" -> ${expectedId}, got ${result.id}`
  );
}

test('order tracking — phrasing variations', () => {
  const phrasings = [
    'Where is my order?',
    'Track my package',
    "Where's my stuff?",
    'I want to check my order status',
    'Has my order shipped yet?',
    'wheres my parcel',
    'When will my order arrive?',
    'Can you track order 111 for me?',
  ];
  for (const p of phrasings) expectIntent(p, 'track_order');
});

test('returns — phrasing variations', () => {
  const phrasings = [
    'I want to return my order',
    'How do refunds work?',
    'Can I exchange this for a different size?',
    "What's your return policy?",
    'I need to send this back',
    'I want my money back',
    'The jacket I got is the wrong size',
  ];
  for (const p of phrasings) expectIntent(p, 'returns');
});

test('recommendations — phrasing variations', () => {
  const phrasings = [
    'Can you recommend something?',
    'What should I buy for a camping trip?',
    "I'm looking for a gift for my dad",
    'Suggest some gear for me',
    'Help me find a good tent',
    'I need a new jacket',
    'What do you sell?',
  ];
  for (const p of phrasings) expectIntent(p, 'recommendations');
});

test('human handoff — phrasing variations', () => {
  const phrasings = [
    'I want to talk to a human',
    'Can I speak to someone?',
    'live agent please',
    'Get me a representative',
    'I need a real person',
    'Talk to a live agent',
    'connect me with customer service please',
  ];
  for (const p of phrasings) expectIntent(p, 'human_handoff');
});

test('shipping info — phrasing variations', () => {
  const phrasings = [
    'How long does shipping take?',
    'What are your shipping options?',
    'shipping info',
    'Do you offer expedited delivery?',
    'How fast do you ship?',
  ];
  for (const p of phrasings) expectIntent(p, 'shipping_info');
});

test('small-talk intents', () => {
  expectIntent('hello', 'greeting');
  expectIntent('hey there', 'greeting');
  expectIntent('thanks!', 'thanks');
  expectIntent('thank you so much', 'thanks');
  expectIntent('no thanks, that is all', 'goodbye');
  expectIntent('bye', 'goodbye');
  expectIntent('main menu', 'menu');
  expectIntent('start over', 'menu');
});

test('quick-reply values map to the right intents', () => {
  expectIntent('track my order', 'track_order');
  expectIntent('returns and exchanges', 'returns');
  expectIntent('gear recommendations', 'recommendations');
  expectIntent('shipping info', 'shipping_info');
  expectIntent('talk to a human', 'human_handoff');
  expectIntent('talk to a live agent', 'human_handoff');
});

test('conflict resolution between overlapping intents', () => {
  // "return" must beat the weak "my order" tracking signal
  expectIntent('I want to return my order', 'returns');
  // tracking must beat greeting when both appear
  expectIntent('hi, where is my order?', 'track_order');
  // "shipped" (tracking) must not trigger shipping_info
  expectIntent('has my order shipped', 'track_order');
  // product noun must lose to an explicit return
  expectIntent('I want to return my tent', 'returns');
  // "where is my <product>" reads as tracking, not recommendation
  expectIntent('where is my tent', 'track_order');
});

test('gibberish and empty input are not recognized', () => {
  assert.equal(intents.detectIntent('asdf qwerty zzz'), null);
  assert.equal(intents.detectIntent(''), null);
  assert.equal(intents.detectIntent('   '), null);
  assert.equal(intents.detectIntent('the weather is nice'), null);
});

test('order number extraction', () => {
  assert.equal(intents.extractOrderNumber('111'), '111');
  assert.equal(intents.extractOrderNumber('#111'), '111');
  assert.equal(intents.extractOrderNumber('order 222'), '222');
  assert.equal(intents.extractOrderNumber("it's #333!"), '333');
  assert.equal(intents.extractOrderNumber('my order number is 999'), '999');
  assert.equal(intents.extractOrderNumber('no number here'), null);
});

test('yes / issue detection for the delivered-order follow-up', () => {
  assert.ok(intents.isYes('yes, all good!'));
  assert.ok(intents.isYes('yep, perfect'));
  assert.ok(!intents.isYes('no, the tent is damaged'));
  assert.ok(intents.hasIssue('the box arrived crushed'));
  assert.ok(intents.hasIssue('something is missing'));
  assert.ok(!intents.hasIssue('everything is fine'));
});

test('recommendation slot matching', () => {
  assert.equal(intents.matchActivity('mostly hiking trips'), 'hiking');
  assert.equal(intents.matchActivity('we go camping a lot'), 'camping');
  assert.equal(intents.matchActivity('snowboarding in january'), 'winter');
  assert.equal(intents.matchActivity('it rains all the time here'), 'rain');
  assert.equal(intents.matchActivity('scuba diving'), null);

  assert.equal(intents.matchType('clothes please'), 'apparel');
  assert.equal(intents.matchType('mostly equipment'), 'gear');
  assert.equal(intents.matchType('no idea'), null);
});
