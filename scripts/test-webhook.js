import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Manually parse .env file to extract the webhook secret
const envPath = path.resolve(".env");
let secret = "";

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const match = envContent.match(/^CHATWOOT_WEBHOOK_SECRET\s*=\s*(.*)$/m);
  if (match) {
    secret = match[1].trim();
  }
}

const payload = {
  event: "message_created",
  message_type: "incoming",
  content: "Hello, is this bot active?",
  conversation: {
    id: 401,
    status: "pending",
    custom_attributes: {},
  },
};

const rawBody = JSON.stringify(payload);
const timestamp = Math.floor(Date.now() / 1000).toString();

let signature = "";
if (secret) {
  signature = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex")}`;
}

const headers = {
  "Content-Type": "application/json",
  "X-Chatwoot-Timestamp": timestamp,
  "X-Chatwoot-Signature": signature,
};

console.log("Sending signed payload to http://localhost:3000/api/webhook...");
console.log("Secret detected:", secret ? "YES" : "NO");
console.log("Headers:", JSON.stringify(headers, null, 2));

try {
  const response = await fetch("http://localhost:3000/api/webhook", {
    method: "POST",
    headers,
    body: rawBody,
  });

  const data = await response.json();
  console.log(`\nResponse [Status ${response.status}]:`, JSON.stringify(data, null, 2));
} catch (error) {
  console.error("Request failed:", error);
}
