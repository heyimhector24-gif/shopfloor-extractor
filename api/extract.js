// This file runs ONLY on Vercel's servers, never in the browser.
// The API key (process.env.ANTHROPIC_API_KEY) is never sent to or visible by any visitor.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is not configured with an API key yet.' });
  }

  const { base64, mediaType, isPdf } = req.body || {};
  if (!base64 || !mediaType) {
    return res.status(400).json({ error: 'Missing file data.' });
  }

  const contentBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };

  const instruction = {
    type: 'text',
    text: `This is a photo or scan of a shop-floor document (a work order, inspection sheet, quality check form, or similar). It may be handwritten, stamped, smudged, or at an angle, and it may be written in ANY language or script (English, Spanish, Chinese, Vietnamese, Arabic, etc.) — do not assume English. Detect the language actually used and read it in that language; do not translate values unless the field is a label you're matching to English for output purposes.

Read it carefully and extract every distinct labeled field and its value (e.g. work order number, date, operator/inspector name, part/product ID, quantity, measurements, pass/fail results, notes, signatures present, etc). Use whatever field names actually appear on the document — don't force it into a fixed template.

STRICT RULES — these matter more than completeness:
1. Classify each field's expected type as one of: "number", "date", "status" (a fixed set like PASS/FAIL/REJECT), or "text".
2. For "number", "date", and "status" fields: if any digit, character, or word is obscured, smudged, ambiguous, or you are inferring rather than clearly reading it, you MUST set uncertain=true — even if you have a plausible guess. Never silently state a guessed number, date, or status as if it were certain.
3. For a "status" field, only ever return one of the values that plausibly belongs to that closed set (e.g. PASS/FAIL/REJECT/HOLD). If the actual mark is unclear, return your best guess but set uncertain=true — never invent an out-of-set value like a percentage.
4. For "text" fields (names, notes, free text), normal reading confidence rules apply — flag uncertain only if genuinely illegible.
5. Do not average out, round, or "smooth" unclear digits into a plausible-looking number. If unclear, still give your best single reading, but flag it.

Respond with ONLY a raw JSON object, no markdown fences, no preamble, in this exact shape:
{"detected_language": "string", "fields": [{"label": "string", "value": "string", "type": "number|date|status|text", "uncertain": true|false}], "confidence_note": "one short sentence summarizing what was uncertain and why, or empty string if everything was clear"}`
  };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        messages: [{ role: 'user', content: [contentBlock, instruction] }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: 'Model request failed: ' + errText });
    }

    const data = await response.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    if (!textBlock) {
      return res.status(502).json({ error: 'No text in model response.' });
    }

    let clean = textBlock.text.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        return res.status(502).json({ error: 'Could not parse model output as JSON.' });
      }
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
