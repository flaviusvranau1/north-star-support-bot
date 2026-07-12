/*
 * North Star Outfitters — bot content & business rules.
 * Single source of truth: every policy string, mock order and product
 * recommendation lives here, so copy changes never touch the engine.
 *
 * Loaded as a classic <script> in the browser (defines the NSData global)
 * and required directly by Node for the test suite.
 */

const NSData = {
  brand: {
    store: 'North Star Outfitters',
    bot: 'North Star Support Bot',
    agentName: 'Alex',
  },

  links: {
    returns: 'https://northstar-outfitters.example.com/returns',
  },

  // Mock order database — exactly the statuses required by the brief.
  orders: {
    111: {
      status: 'Shipped',
      message:
        'Good news! Order #111 has shipped and is on its way — it arrives tomorrow. 🎒',
    },
    222: {
      status: 'Processing',
      message:
        'Order #222 is currently processing and will ship within the next 24 hours. 📦',
      shippingNote:
        'Once it ships: standard delivery takes 3–5 business days, expedited takes 1–2.',
    },
    333: {
      status: 'Delivered',
      message: 'Order #333 shows as delivered. ✅',
      followUp: 'Did everything arrive in good shape?',
    },
  },

  returnPolicy: {
    intro: "Here's our return policy in a nutshell:",
    rules: [
      '🗓️ 30-day returns — you have 30 days from delivery',
      '🏷️ Items must be unused',
      '📦 Original packaging required',
    ],
    outro: 'Ready to send something back? Our returns portal makes it quick:',
  },

  shipping: {
    standard: 'Standard shipping: 3–5 business days',
    expedited: 'Expedited shipping: 1–2 business days',
  },

  // Recommendation matrix: activity × type → product category pitch.
  recommendations: {
    hiking: {
      apparel: {
        category: 'Trail Apparel',
        pitch:
          'Check out our Trail Apparel — moisture-wicking layers, stretch hiking pants and sun shirts built for big miles. 🥾',
      },
      gear: {
        category: 'Day-Hike Gear',
        pitch:
          'Our Day-Hike Gear collection has you covered — daypacks, trekking poles and hydration systems trusted on real trails. 🥾',
      },
    },
    camping: {
      apparel: {
        category: 'Campsite Apparel',
        pitch:
          'Cozy up with our Campsite Apparel — fleece, flannel and base layers made for fireside evenings. 🏕️',
      },
      gear: {
        category: 'Camping Gear',
        pitch:
          'Head to our Camping Gear collection — tents, sleeping bags and camp stoves that make basecamp feel like home. 🏕️',
      },
    },
    winter: {
      apparel: {
        category: 'Winter Apparel',
        pitch:
          'Bundle up with our Winter Apparel — insulated jackets, thermal layers and cold-weather accessories. ❄️',
      },
      gear: {
        category: 'Winter Gear',
        pitch:
          'Gear up with our Winter Gear line — snowshoes, insulated pads and 4-season shelters for when the mercury drops. ❄️',
      },
    },
    rain: {
      apparel: {
        category: 'Rainwear',
        pitch:
          'Stay dry with our Rainwear collection — waterproof shells and rain pants that laugh at the forecast. 🌧️',
      },
      gear: {
        category: 'Weather-Protection Gear',
        pitch:
          'Our Weather-Protection Gear keeps the wet out — pack covers, dry bags and tarps for soggy adventures. 🌧️',
      },
    },
  },

  // Simulated live-agent replies, rotated in order while in the agent state.
  agentReplies: [
    "Thanks for the details! In a real deployment I'd pull up your account and sort this out right away. Is there anything else you'd like to pass along? (Simulated agent for this demo.)",
    "Got it — I've added that to your ticket notes. Anything else I can note down for you? (Simulated agent for this demo.)",
    "Noted! A teammate would normally follow up by email within a few hours. Anything else on your mind? (Simulated agent for this demo.)",
  ],
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NSData;
}
