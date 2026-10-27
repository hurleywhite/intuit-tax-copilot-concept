# Tax Copilot Concept

A concept demo for an interview pitch. Sample data only. Not affiliated with Intuit.

- Next.js 16 app, Geist fonts.
- `/api/chat` streams answers with the Vercel AI SDK (`streamText`) through AI Gateway (model `anthropic/claude-haiku-5.5`).
- On Vercel, AI Gateway authenticates automatically with the project's OIDC token. If the model is unavailable, the route streams a built-in sample answer instead, and the UI labels it "simulated answer".

## Deploy
1. `npm install`
2. `npx vercel` (creates a preview deployment, which is your review link)
3. `npx vercel --prod` (promotes to production)
