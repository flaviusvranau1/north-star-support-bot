/*
 * Conversation state machine — no DOM in here.
 * respond(session, text) mutates the session and returns
 *   { messages: [{author: 'bot'|'agent'|'system', text}], quickReplies, state }
 * Quick-reply values are natural phrases fed back through respond(), so
 * clicking a chip and typing the words exercise the exact same code path.
 *
 * Loaded as a classic <script> in the browser (defines the NSFlows global)
 * and required directly by Node for the test suite.
 */

const NSFlows = (() => {
  const data =
    typeof NSData !== 'undefined' ? NSData : require('./data.js');
  const intents =
    typeof NSIntents !== 'undefined' ? NSIntents : require('./intents.js');

  const MENU_CHIPS = [
    { label: '📦 Track my order', value: 'track my order' },
    { label: '🔄 Returns & exchanges', value: 'returns and exchanges' },
    { label: '🏕️ Gear recommendations', value: 'gear recommendations' },
    { label: '🚚 Shipping info', value: 'shipping info' },
    { label: '💬 Talk to a human', value: 'talk to a human' },
  ];

  const BACK_CHIP = { label: '⬅️ Back to main menu', value: 'main menu' };
  const AGENT_CHIP = { label: '💬 Talk to a live agent', value: 'talk to a live agent' };

  const ACTIVITY_CHIPS = [
    { label: '🥾 Hiking', value: 'hiking' },
    { label: '⛺ Camping', value: 'camping' },
    { label: '❄️ Winter trips', value: 'winter' },
    { label: '🌧️ Rainy weather', value: 'rainy weather' },
  ];

  const TYPE_CHIPS = [
    { label: '🧥 Apparel', value: 'apparel' },
    { label: '🎒 Gear', value: 'gear' },
  ];

  const FOLLOWUP_CHIPS = [
    { label: '👍 All good', value: 'yes, all good' },
    { label: '⚠️ There was an issue', value: 'there was an issue' },
  ];

  function bot(text) {
    return { author: 'bot', text };
  }
  function agent(text) {
    return { author: 'agent', text };
  }
  function system(text) {
    return { author: 'system', text };
  }

  function createSession() {
    return {
      state: 'MAIN_MENU',
      strikes: 0, // consecutive not-understood inputs (2-strike fallback)
      orderTries: 0, // consecutive invalid order numbers
      activity: null, // recommendation slot: adventure type
      recoType: null, // recommendation slot: apparel/gear, if mentioned early
      agentReplyIdx: 0,
    };
  }

  /** Gentle, state-aware nudge for empty input — no fallback strikes. */
  function repromptForState(session) {
    switch (session.state) {
      case 'AWAITING_ORDER_NUMBER':
        return {
          messages: [bot("What's your order number? (It looks like #111.)")],
          quickReplies: [BACK_CHIP],
          state: session.state,
        };
      case 'ORDER_FOLLOWUP':
        return {
          messages: [bot('Just checking — did everything arrive okay?')],
          quickReplies: FOLLOWUP_CHIPS.slice(),
          state: session.state,
        };
      case 'RECO_ACTIVITY':
        return {
          messages: [bot('What kind of adventure are you gearing up for?')],
          quickReplies: ACTIVITY_CHIPS.slice(),
          state: session.state,
        };
      case 'RECO_TYPE':
        return {
          messages: [bot('Apparel (things you wear) or gear (things you pack)?')],
          quickReplies: TYPE_CHIPS.slice(),
          state: session.state,
        };
      case 'LIVE_AGENT':
        return {
          messages: [
            agent(
              "Still there? No rush — I'm right here when you're ready. (Simulated agent for this demo.)"
            ),
          ],
          quickReplies: [BACK_CHIP],
          state: session.state,
        };
      default:
        return mainMenu(session);
    }
  }

  /** Opening messages shown when the chat loads. */
  function greeting(session) {
    session.state = 'MAIN_MENU';
    return {
      messages: [
        bot(
          `Hey there, adventurer! 👋 Welcome to ${data.brand.store} — I'm your ${data.brand.bot}.`
        ),
        bot(
          'I can track orders, sort out returns, recommend gear, and more. What can I do for you today?'
        ),
      ],
      quickReplies: MENU_CHIPS.slice(),
      state: session.state,
    };
  }

  function mainMenu(session, lead) {
    session.state = 'MAIN_MENU';
    return {
      messages: [bot(lead || "Here's what I can help with:")],
      quickReplies: MENU_CHIPS.slice(),
      state: session.state,
    };
  }

  function anythingElse(session, messages) {
    session.state = 'MAIN_MENU';
    messages.push(bot('Anything else I can help you with?'));
    return {
      messages,
      quickReplies: MENU_CHIPS.slice(),
      state: session.state,
    };
  }

  // ---------- fallback ----------

  function notUnderstood(session, repromptText, chips) {
    session.strikes += 1;
    if (session.strikes >= 2) {
      return {
        messages: [
          bot(
            "Hmm, I'm still not catching that — sorry! 🧭 Want me to connect you with a live agent? They're great with the tricky stuff."
          ),
        ],
        quickReplies: [AGENT_CHIP, BACK_CHIP],
        state: session.state,
      };
    }
    return {
      messages: [
        bot(
          repromptText ||
            "Sorry, I didn't quite catch that. 🤔 Here's what I can help with:"
        ),
      ],
      quickReplies: chips || MENU_CHIPS.slice(),
      state: session.state,
    };
  }

  // ---------- order tracking ----------

  function askOrderNumber(session) {
    session.state = 'AWAITING_ORDER_NUMBER';
    session.orderTries = 0;
    session.strikes = 0;
    return {
      messages: [
        bot(
          "Happy to check on that! 🔍 What's your order number? (It looks like #111 — you'll find it in your confirmation email.)"
        ),
      ],
      quickReplies: [BACK_CHIP],
      state: session.state,
    };
  }

  function orderStatus(session, number) {
    session.strikes = 0;
    const order = data.orders[number];

    if (!order) {
      session.orderTries += 1;
      const messages = [
        bot(
          `Hmm, I can't find an order #${number}. 🤔 Order numbers look like #111 — mind double-checking your confirmation email?`
        ),
      ];
      session.state = 'AWAITING_ORDER_NUMBER';
      if (session.orderTries >= 2) {
        messages.push(
          bot('Or, if you prefer, I can bring in a human to dig deeper:')
        );
        return {
          messages,
          quickReplies: [AGENT_CHIP, BACK_CHIP],
          state: session.state,
        };
      }
      return { messages, quickReplies: [BACK_CHIP], state: session.state };
    }

    session.orderTries = 0;
    const messages = [bot(order.message)];
    if (order.shippingNote) messages.push(bot(order.shippingNote));

    if (order.followUp) {
      session.state = 'ORDER_FOLLOWUP';
      messages.push(bot(order.followUp));
      return {
        messages,
        quickReplies: FOLLOWUP_CHIPS.slice(),
        state: session.state,
      };
    }
    return anythingElse(session, messages);
  }

  function handleAwaitingOrderNumber(session, text) {
    const number = intents.extractOrderNumber(text);
    if (number) return orderStatus(session, number);

    // No digits — let strong non-tracking intents escape the flow.
    const intent = intents.detectIntent(text);
    if (intent && intent.score >= 3 && intent.id !== 'track_order') {
      session.state = 'MAIN_MENU';
      return handleMainMenu(session, text);
    }

    session.orderTries += 1;
    if (session.orderTries >= 2) {
      return {
        messages: [
          bot(
            "I just need the order number — like 111 or #222. If it's playing hide-and-seek, a live agent can look it up another way:"
          ),
        ],
        quickReplies: [AGENT_CHIP, BACK_CHIP],
        state: session.state,
      };
    }
    return {
      messages: [
        bot(
          "I just need the number — like 111 or #222. What does your confirmation email say?"
        ),
      ],
      quickReplies: [BACK_CHIP],
      state: session.state,
    };
  }

  function handleOrderFollowUp(session, text) {
    if (intents.isYes(text)) {
      session.strikes = 0;
      return anythingElse(session, [
        bot('Glad to hear it — enjoy the new gear! 🌟'),
      ]);
    }
    if (intents.hasIssue(text)) {
      session.strikes = 0;
      session.state = 'MAIN_MENU';
      return {
        messages: [
          bot(
            "Oh no, sorry about that! Let's make it right. You can start a return or exchange, or I can pull in a live agent:"
          ),
        ],
        quickReplies: [
          { label: '🔄 Returns & exchanges', value: 'returns and exchanges' },
          AGENT_CHIP,
          BACK_CHIP,
        ],
        state: session.state,
      };
    }
    const intent = intents.detectIntent(text);
    if (intent && intent.score >= 3) {
      session.state = 'MAIN_MENU';
      return handleMainMenu(session, text);
    }
    return notUnderstood(
      session,
      'Just checking — did everything arrive okay? A quick "yes" or "there was an issue" works!',
      FOLLOWUP_CHIPS.slice()
    );
  }

  // ---------- returns ----------

  function returnsFlow(session) {
    session.strikes = 0;
    session.state = 'MAIN_MENU';
    const policy = data.returnPolicy;
    const messages = [
      bot(policy.intro + '\n' + policy.rules.join('\n')),
      bot(policy.outro),
      bot('Anything else I can help you with?'),
    ];
    return {
      messages,
      quickReplies: [
        { label: '🔗 Start a return', url: data.links.returns },
        ...MENU_CHIPS,
      ],
      state: session.state,
    };
  }

  // ---------- shipping ----------

  function shippingFlow(session) {
    session.strikes = 0;
    return anythingElse(session, [
      bot(
        "Here's how fast we get gear to your door: 🚚\n• " +
          data.shipping.standard +
          '\n• ' +
          data.shipping.expedited
      ),
    ]);
  }

  // ---------- recommendations ----------

  function startRecommendations(session, text) {
    session.strikes = 0;
    const activity = intents.matchActivity(text);
    // "gear" inside the trigger phrase "gear recommendations" is not an
    // answer to the apparel-vs-gear question — strip it before slot-filling.
    const slotText = intents
      .normalize(text)
      .replace(/\bgear recommendations?\b/g, ' ');
    const type = intents.matchType(slotText);

    if (activity && type) return giveRecommendation(session, activity, type);
    if (activity) return askType(session, activity);
    // remember an early type mention ("help me pick a tent") so we don't
    // ask a question the user already answered
    if (type) session.recoType = type;

    session.state = 'RECO_ACTIVITY';
    return {
      messages: [
        bot(
          "Love it — let's find you something great. 🧭 What kind of adventure are you gearing up for?"
        ),
      ],
      quickReplies: ACTIVITY_CHIPS.slice(),
      state: session.state,
    };
  }

  const ACTIVITY_ACKS = {
    hiking: 'Trail time — excellent choice! 🥾',
    camping: 'Nights under the stars — love it! ⛺',
    winter: 'Chasing the snow — respect! ❄️',
    rain: 'Embracing the elements — bold! 🌧️',
  };

  function askType(session, activity) {
    session.activity = activity;
    session.state = 'RECO_TYPE';
    return {
      messages: [
        bot(
          ACTIVITY_ACKS[activity] +
            ' Are you after apparel (clothing) or gear (equipment)?'
        ),
      ],
      quickReplies: TYPE_CHIPS.slice(),
      state: session.state,
    };
  }

  function giveRecommendation(session, activity, type) {
    const reco = data.recommendations[activity][type];
    session.activity = null;
    session.recoType = null;
    return anythingElse(session, [bot(reco.pitch)]);
  }

  function handleRecoActivity(session, text) {
    const activity = intents.matchActivity(text);
    if (activity) {
      session.strikes = 0;
      const type = intents.matchType(text) || session.recoType;
      if (type) return giveRecommendation(session, activity, type);
      return askType(session, activity);
    }
    const intent = intents.detectIntent(text);
    if (intent && intent.score >= 3 && intent.id !== 'recommendations') {
      session.state = 'MAIN_MENU';
      return handleMainMenu(session, text);
    }
    return notUnderstood(
      session,
      'No rush! Are we talking hiking, camping, winter trips, or rainy days?',
      ACTIVITY_CHIPS.slice()
    );
  }

  function handleRecoType(session, text) {
    const type = intents.matchType(text);
    if (type) {
      session.strikes = 0;
      return giveRecommendation(session, session.activity, type);
    }
    const intent = intents.detectIntent(text);
    if (intent && intent.score >= 3 && intent.id !== 'recommendations') {
      session.state = 'MAIN_MENU';
      return handleMainMenu(session, text);
    }
    return notUnderstood(
      session,
      'Apparel (things you wear) or gear (things you pack)? 🎒',
      TYPE_CHIPS.slice()
    );
  }

  // ---------- live agent ----------

  function handoff(session) {
    session.strikes = 0;
    session.state = 'LIVE_AGENT';
    session.agentReplyIdx = 0;
    return {
      messages: [
        bot(
          'You got it — let me grab a teammate from base camp. ⛺ Connecting you now…'
        ),
        system(
          `You're now chatting with ${data.brand.agentName} (Live Agent) — simulated for this demo`
        ),
        agent(
          `Hi there, ${data.brand.agentName} here! 👋 Thanks for waiting. I can see your conversation with our support bot — how can I help?`
        ),
      ],
      quickReplies: [BACK_CHIP],
      state: session.state,
    };
  }

  // Leaving the agent requires an EXPLICIT exit phrase — casual small talk
  // containing "back" or "home" must not eject the user mid-conversation.
  const AGENT_EXIT_RE =
    /\b(main menu|menu|back to (the )?(bot|menu|start)|start over|go back|exit|leave|goodbye|bye|that is all|thats all|i am done)\b|^back$/;

  function handleLiveAgent(session, text) {
    if (AGENT_EXIT_RE.test(intents.normalize(text))) {
      session.state = 'MAIN_MENU';
      return {
        messages: [
          system(
            `${data.brand.agentName} has left the chat — you're back with ${data.brand.bot}`
          ),
          bot("Welcome back! 🌟 Here's what I can help with:"),
        ],
        quickReplies: MENU_CHIPS.slice(),
        state: session.state,
      };
    }
    const reply = data.agentReplies[session.agentReplyIdx % data.agentReplies.length];
    session.agentReplyIdx += 1;
    return {
      messages: [agent(reply)],
      quickReplies: [BACK_CHIP],
      state: session.state,
    };
  }

  // ---------- main menu / global intents ----------

  function handleMainMenu(session, text) {
    const intent = intents.detectIntent(text);
    if (!intent) {
      // "order 333", "#222" or a bare number is clearly a tracking request
      // even without a tracking verb.
      const number = intents.extractOrderNumber(text);
      if (number) {
        const n = intents.normalize(text);
        if (
          /^#?\s*\d+$/.test(n) ||
          /\b(order|orders|package|parcel|shipment)\b/.test(n)
        ) {
          return orderStatus(session, number);
        }
      }
      return notUnderstood(session);
    }
    session.strikes = 0;

    switch (intent.id) {
      case 'track_order': {
        const number = intents.extractOrderNumber(text);
        if (number) return orderStatus(session, number);
        return askOrderNumber(session);
      }
      case 'returns':
        return returnsFlow(session);
      case 'recommendations':
        return startRecommendations(session, text);
      case 'human_handoff':
        return handoff(session);
      case 'shipping_info':
        return shippingFlow(session);
      case 'greeting':
        return mainMenu(
          session,
          'Hey! 👋 Great to see you. What can I help you with today?'
        );
      case 'thanks':
        return anythingElse(session, [
          bot("Anytime — that's what basecamp is for! 🏔️"),
        ]);
      case 'goodbye':
        return mainMenu(
          session,
          "Happy trails out there! 🌲 If you need anything else, I'm right here."
        );
      case 'menu':
        return mainMenu(session);
      default:
        return notUnderstood(session);
    }
  }

  /** Main entry point: route the user's input based on conversation state. */
  function respond(session, rawText) {
    const text = String(rawText || '').trim();
    if (!text) return repromptForState(session);

    switch (session.state) {
      case 'AWAITING_ORDER_NUMBER':
        return handleAwaitingOrderNumber(session, text);
      case 'ORDER_FOLLOWUP':
        return handleOrderFollowUp(session, text);
      case 'RECO_ACTIVITY':
        return handleRecoActivity(session, text);
      case 'RECO_TYPE':
        return handleRecoType(session, text);
      case 'LIVE_AGENT':
        return handleLiveAgent(session, text);
      default:
        return handleMainMenu(session, text);
    }
  }

  return { createSession, greeting, respond };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NSFlows;
}
