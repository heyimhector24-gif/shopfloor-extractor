# Shopfloor extractor — Vercel-ready

Real extraction: uploaded photos are sent to `/api/extract`, which calls the
Anthropic API with your key and reads the document live. Nothing here is
mock/demo data.

## Deploy

1. Push this whole folder to your GitHub repo (replace the old files).
2. In Vercel: Project → Settings → Environment Variables → add
   `ANTHROPIC_API_KEY` = your key from console.anthropic.com.
3. Redeploy (adding the env var alone does not update an existing
   deployment — trigger a new deploy after adding it).

## Test it

1. Open your deployed URL.
2. Click "OPEN THE TOOL".
3. Pick a document type, choose a real photo (handwriting is fine — that's
   the point), click "EXTRACT DATA".
4. You should see fields read from *your specific photo*, with anything
   ambiguous marked "VERIFY" and a short note on why.

If it errors with "Server is not configured with an API key yet", the env
var isn't set or you haven't redeployed since adding it.

## Notes / limitations

- History and Analytics are stored in the browser's `localStorage` only —
  there's no account system or server-side database yet, so history won't
  follow you to another device or browser.
- Images are resized/compressed client-side (max 1600px, JPEG ~80%) before
  upload to stay under serverless payload limits. Very large or unusual
  files may still fail — if so, try a smaller photo.
- Pricing tiers on the marketing page are placeholders, not wired to any
  billing system.
