# Heky

Photo of a handwritten shop document in → clean, structured data out.
Free trial: sign up with just an email (no password) to get 10 free
extractions, tracked server-side so it can't be dodged by clearing
your browser. A confirmation email is sent on signup.

## Deploy / update on Vercel

Same as before — push these files to GitHub, Vercel auto-redeploys.
This version needs TWO new things set up before signup/extraction will work:

### 1. A database (Vercel KV)
1. Vercel → your project → **Storage** tab → **Create Database** → choose **KV**
2. Connect it to this project
3. This automatically adds two environment variables for you:
   `KV_REST_API_URL` and `KV_REST_API_TOKEN` — no manual copying needed

### 2. An email service (Resend)
1. Go to resend.com → sign up (free)
2. Dashboard → **API Keys** → **Create API Key** → copy it
3. Vercel → Settings → Environment Variables → add
   `RESEND_API_KEY` = the key you copied
4. (The confirmation email sends from `onboarding@resend.dev` by default —
   works immediately, no domain setup needed. You can switch to your own
   domain later in Resend's settings once you have one.)

### 3. Redeploy
Deployments → Redeploy, so the new environment variables take effect.

## Cost

Hosting: $0. Vercel KV: free tier covers this easily. Resend: free up to
3,000 emails/month. AI: still just cents per extraction.

## Still true from before

- ANTHROPIC_API_KEY still required (from the original setup).
- Extraction is real — every photo is actually analyzed live.
- Quote/document history stays in the browser (localStorage) as before.
