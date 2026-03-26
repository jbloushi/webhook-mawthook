import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { parseChatwootOutbound } from "@/lib/chatwoot";
import { sendTextMessage } from "@/lib/meta-api";

export async function POST(request: NextRequest) {
  // Verify shared secret
  const secret = request.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.CHATWOOT_WEBHOOK_SECRET;

  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const outbound = parseChatwootOutbound(payload);

    if (!outbound) {
      // Not an outbound message event, acknowledge silently
      return NextResponse.json({ ok: true });
    }

    // Find WhatsApp account by Chatwoot inbox ID
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        chatwootInboxId: outbound.chatwootInboxId,
        active: true,
      },
    });

    if (!account) {
      console.warn(
        `[Chatwoot] No account found for inbox ${outbound.chatwootInboxId}`
      );
      return NextResponse.json(
        { error: "No linked WhatsApp account" },
        { status: 404 }
      );
    }

    const accessToken = decrypt(account.accessToken);
    const result = await sendTextMessage(
      account.phoneNumberId,
      accessToken,
      outbound.to,
      outbound.text
    );

    // Log outbound message
    await prisma.message.create({
      data: {
        accountId: account.id,
        direction: "outbound",
        waMessageId: result.messages?.[0]?.id || null,
        fromNumber: account.phoneNumber.replace(/[^\d]/g, ""),
        toNumber: outbound.to,
        type: "text",
        content: { text: outbound.text },
        status: result.error ? "failed" : "sent",
        rawPayload: payload,
      },
    });

    return NextResponse.json({ ok: true, messageId: result.messages?.[0]?.id });
  } catch (err) {
    console.error("[Chatwoot] Webhook error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
