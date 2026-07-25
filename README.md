# Bot Bridge

Bridge a published Dify chatflow bot to a Chatwoot inbox so customers talk to the bot first and you can take over manually when needed.

## What this does

- Accepts Chatwoot agent-bot or message webhooks at `/api/webhook`
- Forwards customer messages to Dify
- Posts Dify replies back into the same Chatwoot conversation
- Stops auto-replying once the conversation leaves `pending`
- Persists the Dify conversation id in Chatwoot conversation custom attributes

## Required env vars

```bash
DIFY_API_KEY=
DIFY_API_BASE_URL=https://api.dify.ai/v1
CHATWOOT_API_TOKEN=
CHATWOOT_API_BASE_URL=https://app.chatwoot.com
CHATWOOT_ACCOUNT_ID=
CHATWOOT_WEBHOOK_SECRET=
CHATWOOT_CONVERSATION_STATE_KEY=dify_conversation_id
DIFY_INPUTS_JSON={}
CHATWOOT_WEBHOOK_MAX_AGE_SECONDS=300
```

## Local setup

```bash
npm install
npm run dev
```

Health check:

```bash
curl http://localhost:3000/api/health
```

## Chatwoot setup

1. Create an Agent Bot in Chatwoot.
2. Set the bot outgoing URL to `https://<your-vercel-domain>/api/webhook`.
3. Add the bot to the inbox.
4. Copy the bot access token into `CHATWOOT_API_TOKEN`.
5. Set `CHATWOOT_ACCOUNT_ID` to your Chatwoot account id.
6. Optionally set `CHATWOOT_WEBHOOK_SECRET` if you enable signed deliveries.

## Important note

This bridge only auto-replies while the conversation status is `pending`. When you open the conversation in Chatwoot, the bot stops responding.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo into Vercel.
3. Set the environment variables above in the Vercel project settings.
4. Deploy.

