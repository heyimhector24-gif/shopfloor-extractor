// POST /api/chat
// Body: { messages: [{role, content}], history: [...extraction history entries...], email }
// Returns: { reply }
//
// The assistant is only given the user's own extraction history as data —
// it answers questions about what was actually scanned, and says so plainly
// when something isn't in the data rather than guessing.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY.' });
  }

  try {
    const { messages = [], history = [] } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'No message received.' });
    }

    // Keep the payload lean: strip anything huge, cap history size sent to the model.
    const trimmedHistory = history.slice(0, 30).map(h => ({
      title: h.title,
      date: h.date,
      docType: h.docType,
      fields: (h.fields || []).map(f => ({
        label: f.label,
        value: f.value,
        status: f.status,
        note: f.note || undefined
      }))
    }));

    const systemInstruction = `You are Hex, the assistant inside Heky, a manufacturing document extraction tool. You help visitors with two things: understanding their own scanned document history, and giving a rough sense of pricing.

Below is the user's actual extraction history, in JSON. This is your ONLY source of data about their documents.

${JSON.stringify(trimmedHistory, null, 2)}

PRICING CONTEXT (for pricing questions only):
- Free tier: 10 free document extractions, no credit card needed.
- Beyond that, pricing is custom based on how much a shop actually processes per month — there's no fixed public rate.
- If asked for a price, give a rough, honest ballpark range based on typical usage tiers (e.g. a shop doing a handful of documents a week is a very different price point than one processing hundreds a month) — but always be clear this is a rough estimate, not a quote, and that final pricing is confirmed directly with the Heky team.
- Never state a single "final" price as if it's fixed — always frame it as an estimate pending confirmation.
- For anyone who wants to follow up directly (custom quote, questions, anything beyond what you can answer), share this contact: hectorbusiness0924@gmail.com or (657) 469-1183.

DOCUMENT-DATA RULES:
1. Answer only from the data above. Never invent part numbers, quantities, dates, or any field value that isn't literally in this data.
2. If the user asks something the history doesn't cover, say plainly that you don't have that data — don't guess or extrapolate.
3. You can summarize, count, compare, and spot patterns across documents since that's real analysis of real data.
4. Fields marked "flagged" were uncertain reads the user may or may not have corrected — mention that distinction when relevant.
5. Keep answers conversational and concise — a couple sentences to a short paragraph, not a report.`;

    const anthropicMessages = messages
      .filter(m => m && m.role && m.content)
      .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) }));

    const apiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        system: systemInstruction,
        messages: anthropicMessages
      })
    });

    if (!apiResp.ok) {
      const errBody = await apiResp.text();
      console.error('Anthropic API error:', apiResp.status, errBody);
      return res.status(502).json({ error: 'The chat service returned an error. Try again in a moment.' });
    }

    const data = await apiResp.json();
    const reply = (data.content || [])
      .map((b) => (b.type === 'text' ? b.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim();

    return res.status(200).json({ reply: reply || "I couldn't come up with an answer to that." });
  } catch (err) {
    console.error('chat handler error:', err);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
}
