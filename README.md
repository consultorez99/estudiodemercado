<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/abdeb164-6b6c-4c28-8001-baa860cad404

## Run Locally

**Prerequisites:**  Node.js 18+


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

`npm run dev` starts two processes via `concurrently`:
- **client** — Vite on `http://localhost:3000`
- **server** — Express on `http://localhost:3001`

The Gemini API key never reaches the browser: the AI Importer posts raw text to
`POST /api/analyze` on the Express server ([server/index.ts](server/index.ts)),
which holds the key and calls Gemini. In dev, Vite proxies `/api` to the server.

## Production

`npm run build` then `npm start`. The Express server serves the built SPA from
`dist/` **and** the `/api` routes from a single service (Cloud Run model), reading
`GEMINI_API_KEY` and `PORT` from the environment.
