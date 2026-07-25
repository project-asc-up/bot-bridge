# Project Kganya: Dify-Chatwoot Bot Bridge

A high-performance Next.js middleware that bridges **Dify (AI Agents)** to **Chatwoot (CRM/Helpdesk)** with native support for **Evolution Go (WhatsApp Gateway)**. It allows bots to handle WhatsApp/Web customer chats automatically, with instant handoff to human support agents without bot interference.

---

## Key Features

- **Live Action Monitor Dashboard**: Open `http://localhost:3000` to see real-time statistics (total events, replies, handoffs, errors) and a live scroll of incoming/outgoing messages.
- **Auto-Pause & Human Takeover**: The bot only replies while the Chatwoot conversation is in `pending` status. When a human agent types a reply or changes the status to `open`, the bot automatically silences itself.
- **Handoff Token Detection**: Intercepts `[HANDOFF]` or similar escalation indicators from Dify and automatically moves Chatwoot conversations to the `open` queue.
- **Session Persistence**: Stores and maps the Dify conversation ID in Chatwoot's conversation attributes so context is never lost.
- **Signed Webhook Support**: Validates incoming Chatwoot payloads using SHA-256 HMAC signatures to prevent unauthorized API requests.

---

## Required Environment Variables

Configure these variables in your `.env` (local) or your Coolify project environment settings:

```env
# Dify Settings
DIFY_API_KEY=your-dify-app-api-key
DIFY_API_BASE_URL=https://api.dify.ai/v1

# Chatwoot Settings
CHATWOOT_API_TOKEN=your-profile-access-token
CHATWOOT_API_BASE_URL=https://app.chatwoot.com
CHATWOOT_ACCOUNT_ID=your-account-id
CHATWOOT_CONVERSATION_STATE_KEY=dify_conversation_id

# Security (Webhook verification)
CHATWOOT_WEBHOOK_SECRET=your-secure-webhook-token
CHATWOOT_WEBHOOK_MAX_AGE_SECONDS=300

# Optional variables
DIFY_INPUTS_JSON={}
```

---

## Local Development & Verification

### 1. Installation & Run
```bash
npm install
npm run dev
```
Open `http://localhost:3000` to view the **Bot Bridge Live Monitor**.

### 2. Check Health
```bash
curl http://localhost:3000/api/health
```

### 3. Send a Signed Webhook Test
Because the API verifies requests with the `CHATWOOT_WEBHOOK_SECRET` defined in your `.env`, we provided a signing script to simulate inbound webhooks:
```bash
node scripts/test-webhook.js
```
This script will parse your secret, hash the payload, send a signed POST request to the API, and immediately display the result on your Live Monitor UI!

---

## Deployment & Integration Setup

### Step 1: Deploy on Coolify
1. Create a new resource in Coolify pointing to this GitHub repository.
2. Coolify will auto-detect this as a **Next.js** project.
3. Configure the **Environment Variables** in Coolify matching your credentials.
4. Set your custom FQDN (e.g. `https://botbridge.yourdomain.com`).
5. Click **Deploy**.

### Step 2: Configure Chatwoot Agent Bot
1. In Chatwoot, go to **Settings** $\rightarrow$ **Integrations** $\rightarrow$ **Agent Bots** $\rightarrow$ **Create New Bot**.
2. Set the Webhook URL to: `https://botbridge.yourdomain.com/api/webhook`.
3. Link the created Agent Bot to your target inbox channel in your inbox settings page.

### Step 3: Configure Evolution Go (WhatsApp)
1. Register Chatwoot on your Evolution Go WhatsApp instance using the following `POST` API call:
   ```bash
   curl -X POST https://evogo.yourdomain.com/chatwoot/set/{instance_name} \
     -H "Content-Type: application/json" \
     -H "apikey: your-global-key" \
     -d '{
       "enabled": true,
       "url": "https://app.chatwoot.com",
       "accountId": 173841,
       "token": "your_chatwoot_access_token",
       "signMsg": true,
       "reopenConversation": true,
       "conversationPending": true,
       "importContacts": true,
       "importMessages": true
     }'
   ```
   *Note: `"conversationPending": true` is critical to start WhatsApp chats in the pending queue so the bot responds.*
