import crypto from "crypto";

export function verifyMetaSignature(
  rawBody: string,
  signature: string,
  appSecret: string
): boolean {
  if (!signature.startsWith("sha256=")) return false;

  const expectedHash = signature.slice(7);
  const computedHash = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedHash, "hex"),
      Buffer.from(computedHash, "hex")
    );
  } catch {
    return false;
  }
}
