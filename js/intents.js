/*
 * Intent engine — pure functions, no DOM, no state.
 * Strategy: normalize the utterance, then score weighted keyword/phrase
 * matches (word-boundary regexes) per intent. Highest score wins; ties are
 * broken by intent priority order. Score < 2 means "not understood" and the
 * conversation layer triggers its fallback.
 *
 * Loaded as a classic <script> in the browser (defines the NSIntents global)
 * and required directly by Node for the test suite.
 */

const NSIntents = (() => {
  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/\bwhere's\b/g, 'where is')
      .replace(/\bwheres\b/g, 'where is')
      .replace(/\bwhat's\b/g, 'what is')
      .replace(/\bwhats\b/g, 'what is')
      .replace(/\bi'm\b/g, 'i am')
      .replace(/\bim\b/g, 'i am')
      .replace(/\bthat's\b/g, 'that is')
      .replace(/n't\b/g, ' not')
      .replace(/[^a-z0-9#\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function phraseRegex(phrase) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('\\b' + escaped + '\\b');
  }

  // Order = tie-break priority (earlier wins on equal score).
  // A phrase may be a plain string (word-boundary matched) or a RegExp for
  // gap-tolerant patterns like "send ... back".
  const INTENTS = [
    {
      id: 'human_handoff',
      phrases: [
        ['live agent', 4], ['agent', 3], ['human', 3], ['real person', 4],
        ['representative', 3], ['operator', 3], ['speak to someone', 4],
        ['talk to someone', 4], ['speak with someone', 4],
        ['talk to a person', 4], ['customer service', 2], ['real human', 4],
        ['speak to a person', 4], ['person', 2], ['contact', 2],
        ['phone number', 3], ['call you', 3], ['email you', 3],
        ['reach you', 3],
        // order cancellation isn't a bot capability — route to a human
        [/\bcancel\b.*\border\b/, 5],
      ],
    },
    {
      id: 'track_order',
      phrases: [
        ['track', 3], ['tracking', 3], ['where is my', 3],
        ['where is my order', 4], ['where is my package', 4],
        ['where is my parcel', 4], ['order status', 3],
        ['status of my order', 4], ['my order', 2], ['my package', 2],
        ['my parcel', 2], ['package', 2], ['shipment', 2], ['shipped', 2],
        ['has my order shipped', 4], ['delivery status', 3],
        ['when will my order arrive', 4], ['my stuff', 2], ['order number', 3],
      ],
    },
    {
      id: 'returns',
      phrases: [
        ['return', 3], ['returns', 3], ['returning', 3], ['refund', 3],
        ['refunds', 3], ['refunded', 3], ['exchange', 3],
        ['exchanges', 3],
        // gap-tolerant: "send my boots back", "mail the tent back", …
        [/\bsend\b.*\bback\b/, 4], [/\bmail\b.*\bback\b/, 4],
        [/\bship\b.*\bback\b/, 4],
        ['money back', 3], ['return policy', 4], ['swap', 2],
        ['take back', 2], ['give back', 2], ['wrong item', 3],
        ['wrong size', 3], ['too small', 2], ['too big', 2],
        ['defective', 2], ['damaged', 2],
      ],
    },
    {
      id: 'recommendations',
      phrases: [
        ['recommend', 3], ['recommendation', 3], ['recommendations', 3],
        ['suggest', 3], ['suggestion', 3], ['looking for', 3],
        ['help me find', 3], ['help me pick', 3], ['help me choose', 3],
        ['what should i buy', 4], ['what should i get', 4], ['gift', 3],
        ['present for', 3], ['shopping for', 3], ['in the market for', 3],
        ['what do you sell', 3], ['new gear', 3],
        // weak product-noun signals
        ['jacket', 2], ['tent', 2], ['boots', 2], ['sleeping bag', 2],
        ['backpack', 2], ['gear', 2], ['apparel', 2], ['clothes', 2],
        ['clothing', 2], ['equipment', 2],
      ],
    },
    {
      id: 'shipping_info',
      phrases: [
        ['shipping', 3], ['shipping time', 4], ['shipping times', 4],
        ['shipping options', 4], ['shipping info', 4], ['delivery time', 3],
        ['how long does shipping', 4], ['how long does delivery', 4],
        ['how fast do you ship', 4], ['how long to ship', 4],
        ['expedited', 3], ['standard shipping', 4], ['deliver', 2],
        ['delivery', 2], ['ship', 2],
      ],
    },
    {
      id: 'menu',
      phrases: [
        ['menu', 3], ['main menu', 4], ['start over', 3], ['go back', 2],
        ['back', 2], ['home', 2], ['cancel', 3], ['never mind', 3],
        ['nevermind', 3], ['restart', 3], ['options', 2], ['help', 2],
      ],
    },
    {
      id: 'goodbye',
      phrases: [
        ['bye', 2], ['goodbye', 3], ['see you', 2], ['no thanks', 3],
        ['no thank you', 4], ['nothing else', 3], ['i am good', 3],
        ['i am done', 3], ['i am all set', 4], ['that is all', 3],
        ['thats all', 3], ['all set', 2],
      ],
    },
    {
      id: 'thanks',
      phrases: [
        ['thanks', 2], ['thank you', 3], ['thank u', 2], ['thx', 2],
        ['ty', 2], ['appreciate it', 3], ['cheers', 2],
      ],
    },
    {
      id: 'greeting',
      phrases: [
        ['hello', 2], ['hi', 2], ['hey', 2], ['good morning', 2],
        ['good afternoon', 2], ['good evening', 2], ['howdy', 2],
        ['greetings', 2], ['what is up', 2], ['yo', 2],
      ],
    },
  ];

  // Precompile regexes once.
  const COMPILED = INTENTS.map((intent) => ({
    id: intent.id,
    phrases: intent.phrases.map(([phrase, weight]) => ({
      re: phrase instanceof RegExp ? phrase : phraseRegex(phrase),
      weight,
    })),
  }));

  const THRESHOLD = 2;

  /**
   * @returns {{id: string, score: number} | null}
   */
  function detectIntent(text) {
    const input = normalize(text);
    if (!input) return null;

    let best = null;
    for (const intent of COMPILED) {
      let score = 0;
      for (const { re, weight } of intent.phrases) {
        if (re.test(input)) score += weight;
      }
      if (score >= THRESHOLD && (!best || score > best.score)) {
        best = { id: intent.id, score };
      }
    }
    return best;
  }

  /** Pull the first number out of "111", "#111", "order 111", "it's #222!". */
  function extractOrderNumber(text) {
    const input = normalize(text);
    const match = input.match(/#\s*(\d+)|\b(\d+)\b/);
    if (!match) return null;
    return match[1] || match[2];
  }

  const YES_RE =
    /\b(yes|yeah|yep|yup|sure|good|great|perfect|fine|ok|okay|intact|good shape)\b/;
  const ISSUE_RE =
    /\b(no|nope|issue|issues|problem|problems|damaged|damage|missing|broken|wrong|bad|crushed|torn|defective|scratched|ripped|not)\b/;

  // "no problems", "nothing wrong" etc. are POSITIVE idioms — rewrite them
  // before the issue check so ISSUE_RE's bare "no"/"wrong" can't veto them.
  function neutralizePositiveIdioms(input) {
    return input
      .replace(/\bno (problems?|issues?|complaints?|worries|damage)\b/g, 'all good')
      .replace(/\bnothing (wrong|missing|broken|damaged|bad)\b/g, 'all good');
  }

  function isYes(text) {
    const input = neutralizePositiveIdioms(normalize(text));
    return YES_RE.test(input) && !ISSUE_RE.test(input);
  }

  function hasIssue(text) {
    return ISSUE_RE.test(neutralizePositiveIdioms(normalize(text)));
  }

  const ACTIVITY_RES = {
    hiking: /\b(hike|hikes|hiking|trek|trekking|trail|trails|backpacking)\b/,
    camping: /\b(camp|camping|campsite|basecamp|campground)\b/,
    winter: /\b(winter|snow|snowy|ski|skiing|snowboard|snowboarding|cold|freezing)\b/,
    rain: /\b(rain|rains|raining|rainy|wet|storm|stormy|drizzle|monsoon)\b/,
  };

  function matchActivity(text) {
    const input = normalize(text);
    for (const [activity, re] of Object.entries(ACTIVITY_RES)) {
      if (re.test(input)) return activity;
    }
    return null;
  }

  const TYPE_RES = {
    apparel:
      /\b(apparel|clothes|clothing|wear|outfit|outfits|jacket|jackets|pants|shirt|shirts|layers|fleece)\b/,
    gear: /\b(gear|equipment|tent|tents|stove|stoves|backpack|backpacks|pack|packs|poles|gadgets)\b/,
  };

  function matchType(text) {
    const input = normalize(text);
    for (const [type, re] of Object.entries(TYPE_RES)) {
      if (re.test(input)) return type;
    }
    return null;
  }

  return {
    normalize,
    detectIntent,
    extractOrderNumber,
    isYes,
    hasIssue,
    matchActivity,
    matchType,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NSIntents;
}
