import crypto from "node:crypto";

export function verifyChatwootSignature(args: {
  secret: string;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  maxAgeSeconds: number;
}): boolean {
  const { secret, timestamp, signature, rawBody, maxAgeSeconds } = args;

  if (!secret) {
    return true;
  }

  if (!timestamp || !signature) {
    return false;
  }

  const parsedTimestamp = Number(timestamp);
  if (!Number.isFinite(parsedTimestamp)) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - parsedTimestamp) > maxAgeSeconds) {
    return false;
  }

  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex")}`;

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);

  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}
