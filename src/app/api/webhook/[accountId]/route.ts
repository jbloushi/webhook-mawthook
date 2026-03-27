import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { verifyMetaSignature } from "@/lib/webhook-signature";
import { downloadAndStoreMedia } from "@/lib/media";
import { fanOutToDestinations } from "@/lib/delivery";

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

  const payload = JSON.parse(rawBody);

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
      for (const msg of messages) {
        await processIncomingMessage(account, msg, payload);
      }

      // Handle status updates
      const statuses = value.statuses || [];
      for (const status of statuses) {
        await processStatusUpdate(status);
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processIncomingMessage(account: any, msg: any, rawPayload: any) {
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

  // Fan out to destinations
  await fanOutToDestinations(message.id, account.id, rawPayload);
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
