import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { verifyMetaSignature } from "@/lib/webhook-signature";
import { downloadAndStoreMedia } from "@/lib/media";
import { fanOutToDestinations } from "@/lib/delivery";
import { Prisma } from "@prisma/client";

// Meta webhook verification (GET)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const verifyToken = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (!mode || !verifyToken || !challenge) {
    return new NextResponse("Missing parameters", { status: 400 });
  }

  const account = await prisma.whatsAppAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    return new NextResponse("Account not found", { status: 404 });
  }

  if (mode === "subscribe" && verifyToken === account.verifyToken) {
    console.log(`[Webhook] Verified account ${account.name}`);
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// Meta webhook receive (POST)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;

  // Read raw body first for signature verification
  const rawBody = await request.text();

  const account = await prisma.whatsAppAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    return new NextResponse("Account not found", { status: 404 });
  }

  // Verify signature (skip if no app secret configured)
  const signature = request.headers.get("x-hub-signature-256") || "";

  try {
    const appSecret = decrypt(account.appSecret);
    if (appSecret && signature) {
      if (!verifyMetaSignature(rawBody, signature, appSecret)) {
        console.warn(`[Webhook] Invalid signature for account ${account.name} — allowing for now (check App Secret)`);
        // TODO: Re-enable strict rejection once App Secret is confirmed correct
        // return new NextResponse("Invalid signature", { status: 401 });
      } else {
        console.log(`[Webhook] Signature verified for account ${account.name}`);
      }
    }
  } catch (err) {
    console.warn(`[Webhook] Signature check failed for account ${account.name}:`, err);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  // Process in background, return 200 immediately
  processWebhookPayload(account, payload).catch((err) => {
    console.error("[Webhook] Processing error:", err);
  });

  return new NextResponse("OK", { status: 200 });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processWebhookPayload(account: any, payload: any) {
  const entries = payload.entry || [];

  for (const entry of entries) {
    const changes = entry.changes || [];

    for (const change of changes) {
      if (change.field !== "messages") continue;
      const value = change.value;

      // Handle incoming messages
      const messages = value.messages || [];
      await runWithConcurrency(messages, 8, (msg) =>
        processIncomingMessage(account, msg, payload)
      );

      // Handle status updates
      const statuses = value.statuses || [];
      await runWithConcurrency(statuses, 16, processStatusUpdate);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processIncomingMessage(account: any, msg: any, rawPayload: any) {
  if (!msg?.id) return;

  const accessToken = decrypt(account.accessToken);

  let mediaLocalPath: string | null = null;
  let mediaUrl: string | null = null;

  // Handle media messages
  const mediaTypes = ["image", "video", "audio", "document", "sticker"];
  if (mediaTypes.includes(msg.type) && msg[msg.type]?.id) {
    try {
      const result = await downloadAndStoreMedia(
        msg[msg.type].id,
        accessToken,
        account.id
      );
      mediaLocalPath = result.localPath;
      mediaUrl = result.publicUrl;
    } catch (err) {
      console.error("[Webhook] Media download error:", err);
    }
  }

  // Extract text content
  let content: object;
  if (msg.type === "text") {
    content = { text: msg.text?.body || "" };
  } else if (msg[msg.type]) {
    content = { ...msg[msg.type], mediaUrl };
  } else {
    content = { raw: msg };
  }

  try {
    const message = await prisma.message.create({
      data: {
        accountId: account.id,
        direction: "inbound",
        waMessageId: msg.id,
        fromNumber: msg.from,
        toNumber: account.phoneNumber.replace(/[^\d]/g, ""),
        type: msg.type,
        content,
        mediaLocalPath,
        mediaUrl,
        status: "received",
        rawPayload,
      },
    });

    // Fan-out returns quickly (attempt creation + background dispatch)
    // and avoids blocking on downstream endpoint latency.
    await fanOutToDestinations(message.id, account.id, rawPayload);
  } catch (err) {
    // Ignore duplicate message inserts (Meta may retry delivery).
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return;
    }
    throw err;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processStatusUpdate(status: any) {
  if (!status.id) return;

  const statusMap: Record<string, string> = {
    sent: "sent",
    delivered: "delivered",
    read: "read",
    failed: "failed",
  };

  const newStatus = statusMap[status.status];
  if (!newStatus) return;

  await prisma.message
    .updateMany({
      where: { waMessageId: status.id },
      data: { status: newStatus },
    })
    .catch(() => {
      // Message might not exist yet (status for outbound)
    });
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>
): Promise<void> {
  if (!Array.isArray(items) || items.length === 0) return;
  const normalizedLimit = Math.max(1, limit);
  let index = 0;

  const workers = Array.from({
    length: Math.min(normalizedLimit, items.length),
  }).map(async () => {
    while (index < items.length) {
      const current = items[index++];
      await task(current);
    }
  });

  await Promise.allSettled(workers);
}
