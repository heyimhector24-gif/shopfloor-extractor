# Shop Floor Extract

## What this is
- `index.html` — the page people see and use (upload a document, click Extract)
- `api/extract.js` — a hidden backend function. This is the only place that talks to the AI model, and the only place your API key lives.

## How to deploy (Vercel)

1. Push this whole folder to a GitHub repository (see steps below).
2. Go to vercel.com, sign in with GitHub, click "Add New Project," and select this repo.
3. Before clicking Deploy, open "Environment Variables" and add:
   - Key: `ANTHROPIC_API_KEY`
   - Value: (paste your key from console.anthropic.com — starts with `sk-ant-`)
4. Click Deploy. Vercel gives you a live URL like `your-project.vercel.app`.
5. That's it — the key stays on Vercel's servers and is never sent to anyone's browser.

## Uploading this folder to GitHub (no terminal needed)

1. Go to your new empty GitHub repository page.
2. Click "uploading an existing file" (a link shown on the empty repo page).
3. Drag in `index.html`, `README.md`, and the `api` folder (or its contents — GitHub's uploader supports drag-and-drop of folders in most browsers).
4. Scroll down, click "Commit changes."

## Testing after deploy
Open the live Vercel URL in an incognito window (to confirm it works without being logged into anything) and try uploading a test document.
