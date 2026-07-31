// POST /api/extract
// Body: { docType: 'work_order'|'inspection'|'incoming', image: { data: <base64>, media_type }, email }
// Returns: { fields: [{ key, label, value, status: 'confident'|'flagged', note? }], usesRemaining }

const FREE_LIMIT = 10;

async function kvGet(key) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['GET', key])
  });
  const data = await resp.json();
  return data.result ? JSON.parse(data.result) : null;
}

async function kvSet(key, value) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['SET', key, JSON.stringify(value)])
  });
}

const DOC_TYPE_GUIDANCE = {
  work_order: `Common fields on this type of document include: work order number, requesting company name/address/contact, vendor or contractor name/number/address/contact, work order date, description of work, delivery/due date, actual completion date, priority, machine/station, requested by, materials required, plumbing/electrical/other trade requirements, total price, and notes.
This list is a starting point, NOT the limit — extract every distinct labeled field or section that actually appears on the page, even if it isn't in this list.
If the document contains a table or line-item list (e.g. multiple rows of labor type / quantity / work code / price), extract EACH row as its own set of fields rather than skipping the table — for example "Labourers — Quantity", "Labourers — Work Code", "Labourers — Price" as separate fields per row, using the row's own label as part of the field label so it's clear which row each value belongs to.
If a section contains a bulleted or multi-line list under one label (e.g. "Materials Required" listing several items), capture the full list as the value for that one field rather than dropping it.`,
  inspection: `Common fields include: inspector name, date, part number, batch/lot number, dimension checks (each with its spec vs measured value if shown), visual defects, pass/fail result, and comments.
This list is a starting point, NOT the limit — extract every distinct labeled field or section that actually appears on the page, even if it isn't in this list.
If the document contains a table of multiple checks/measurements, extract EACH row as its own set of fields (e.g. "Diameter Check — Spec", "Diameter Check — Measured") rather than skipping the table.
If a section contains a bulleted or multi-line list under one label, capture the full list as the value for that one field rather than dropping it.`,
  incoming: `Common fields include: supplier name/address/contact, PO number, material/part received, quantity received, date received, inspector, condition, discrepancies, and accepted/rejected disposition.
This list is a starting point, NOT the limit — extract every distinct labeled field or section that actually appears on the page, even if it isn't in this list.
If the document contains a table of multiple items received, extract EACH row as its own set of fields rather than skipping the table.
If a section contains a bulleted or multi-line list under one label, capture the full list as the value for that one field rather than dropping it.`
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only.' });
  }

  const apiKey = process.env.SCANNER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Server is missing SCANNER_API_KEY. Add it in Vercel → Settings → Environment Variables, then redeploy.'
    });
  }

  try {
    const { docType = 'work_order', image, email } = req.body || {};

    if (!image || !image.data) {
      return res.status(400).json({ error: 'No photo data was received. Try selecting the photo again.' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Sign up with your email first to start your free trial.' });
    }

    const normalized = String(email).trim().toLowerCase();
    const kvKey = `sf_user:${normalized}`;
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const isAdmin = adminEmails.includes(normalized);

    if (!isAdmin && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const record = await kvGet(kvKey);
      if (!record) {
        return res.status(400).json({ error: 'That email is not signed up yet. Sign up first to start your free trial.' });
      }
      if (record.uses >= FREE_LIMIT) {
        return res.status(402).json({ error: `You've used all ${FREE_LIMIT} free extractions. Contact us to keep going.` });
      }
    }

    const guidance = DOC_TYPE_GUIDANCE[docType] || DOC_TYPE_GUIDANCE.work_order;

    const instruction = `You are reading a photo of a shop-floor document (a ${docType.replace('_',' ')}) for a manufacturing extraction tool — it may be handwritten, printed, typed, or a mix of both.

${guidance}

STRICT RULES:
1. Only extract what is actually visible on the page. Never invent a field that isn't there.
2. For each field you find, decide: can you read it with real confidence, or is it genuinely ambiguous (smudged, crossed out, unclear digit, overlapping marks, cut off)?
   - status: "confident" if you're sure.
   - status: "flagged" if there's real ambiguity — and explain briefly in "note" what's unclear and what the plausible alternatives are (e.g. "could be 3 or 8").
3. Never silently guess and present a guess as confident. When in doubt, flag it.
4. label should be a short human-readable field name (e.g. "Work Order #", "Quantity"). key should be a short lowercase snake_case identifier.
5. If the photo is unreadable, blank, or not a shop document at all, return an empty fields array.
6. The document may be handwritten in any language (English, Spanish, Chinese, Vietnamese, etc.) — read it in its original language. Keep "value" in the language/script it was written in (don't translate it). Keep "label" and "note" in English so the tool stays consistent, but never let an unfamiliar language cause a false "flagged" status — flag only for genuine illegibility, not because the language itself is unfamiliar to you.

Respond with ONLY a JSON object, no markdown fences, no preamble:
{
  "fields": [
    { "key": "wo_number", "label": "Work Order #", "value": "4471", "status": "confident" },
    { "key": "qty", "label": "Quantity", "value": "38", "status": "flagged", "note": "Handwriting unclear — could be 3 or 8." }
  ]
}`;

    const content = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: image.media_type || 'image/jpeg',
          data: image.data
        }
      },
      { type: 'text', text: instruction }
    ];

    const apiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content }]
      })
    });

    if (!apiResp.ok) {
      const errBody = await apiResp.text();
      console.error('Anthropic API error:', apiResp.status, errBody);
      return res.status(502).json({ error: 'The AI service returned an error. Try again in a moment.' });
    }

    const data = await apiResp.json();
    const text = (data.content || [])
      .map((b) => (b.type === 'text' ? b.text : ''))
      .filter(Boolean)
      .join('\n');

    const clean = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      const m = clean.match(/\{[\s\S]*\}/);
      if (m) {
        parsed = JSON.parse(m[0]);
      } else {
        console.error('Unparseable model output:', clean.slice(0, 400));
        return res.status(502).json({ error: 'Could not read the AI response. Try again.' });
      }
    }

    let usesRemaining = null;
    if (!isAdmin && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const record = (await kvGet(kvKey)) || { uses: 0, createdAt: Date.now() };
      record.uses = (record.uses || 0) + 1;
      await kvSet(kvKey, record);
      usesRemaining = Math.max(0, FREE_LIMIT - record.uses);
    }

    return res.status(200).json({
      fields: Array.isArray(parsed.fields) ? parsed.fields : [],
      usesRemaining,
      unlimited: isAdmin
    });
  } catch (err) {
    console.error('extract handler error:', err);
    return res.status(500).json({ error: 'Something went wrong reading the document. Try again.' });
  }
}
