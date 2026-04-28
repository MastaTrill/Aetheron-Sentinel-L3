# Run and Deploy Your AI Studio App

![GHBanner](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

This contains everything you need to run your app locally.

View your app in AI Studio: [https://ai.studio/apps/b153508a-2199-41c5-a192-6b5207dff22e](https://ai.studio/apps/b153508a-2199-41c5-a192-6b5207dff22e)

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key

---

## Secret Management & Environment Variables

**Never commit real API keys or secrets to the repository.**

- Use `.env.local` for all sensitive values (API keys, tokens, credentials).
- Copy from `.env.example` if provided, and fill in your own values locally.
- Never share or commit your real `.env.local` file.

**Warning:** Commits containing secrets will be rejected by push protection and secret scanning. 3. Run the app:
`npm run dev`
