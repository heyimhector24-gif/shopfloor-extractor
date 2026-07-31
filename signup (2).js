// POST /api/signup
// Body: { email }
// Creates (or looks up) a free-trial record for this email in Vercel KV,
// and sends a confirmation email via Resend on first signup.
// Returns: { usesRemaining, limit }

const FREE_LIMIT = 10;

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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

async function sendConfirmationEmail(email) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // Don't block signup if email isn't configured yet.
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Heky <onboarding@resend.dev>',
        to: [email],
        subject: "You're set up on Heky",
        text: `You're all set.\n\nYou have ${FREE_LIMIT} free document extractions on Heky. Just go back to the site and start uploading — no password needed, this email is your account.\n\n— Heky`
      })
    });
  } catch (e) {
    console.error('Resend send failed:', e);
    // Non-fatal — signup still succeeds even if the email fails to send.
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only.' });
  }

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return res.status(500).json({
      error: 'Server is missing KV_REST_API_URL / KV_REST_API_TOKEN. Connect a KV database in Vercel → Storage, then redeploy.'
    });
  }

  const { email } = req.body || {};
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  const normalized = email.trim().toLowerCase();
  const key = `sf_user:${normalized}`;
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const isAdmin = adminEmails.includes(normalized);

  try {
    let record = await kvGet(key);
    if (!record) {
      record = { uses: 0, createdAt: Date.now() };
      await kvSet(key, record);
      await sendConfirmationEmail(normalized);
    }
    return res.status(200).json({
      usesRemaining: isAdmin ? null : Math.max(0, FREE_LIMIT - record.uses),
      limit: FREE_LIMIT,
      unlimited: isAdmin
    });
  } catch (err) {
    console.error('signup handler error:', err);
    return res.status(500).json({ error: 'Something went wrong signing up. Try again.' });
  }
}
