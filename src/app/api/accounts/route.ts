import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  const accounts = await prisma.whatsAppAccount.findMany({
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      phoneNumberId: true,
      wabaId: true,
      chatwootInboxId: true,
      active: true,
      verifyToken: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { destinations: true, messages: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ accounts });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      phoneNumber,
      phoneNumberId,
      wabaId,
      accessToken,
      appSecret,
      chatwootInboxId,
    } = body;

    if (!name || !phoneNumber || !phoneNumberId || !wabaId || !accessToken || !appSecret) {
      return NextResponse.json(
        { error: "Missing required fields: name, phoneNumber, phoneNumberId, wabaId, accessToken, appSecret" },
        { status: 400 }
      );
    }

    const account = await prisma.whatsAppAccount.create({
      data: {
        name,
        phoneNumber,
        phoneNumberId,
        wabaId,
        accessToken: encrypt(accessToken),
        appSecret: encrypt(appSecret),
        verifyToken: uuidv4(),
        chatwootInboxId: chatwootInboxId || null,
      },
    });

    const appUrl = process.env.APP_URL || "http://localhost:3000";

    return NextResponse.json({
      account: {
        id: account.id,
        name: account.name,
        phoneNumber: account.phoneNumber,
        phoneNumberId: account.phoneNumberId,
        verifyToken: account.verifyToken,
        webhookUrl: `${appUrl}/api/webhook/${account.id}`,
      },
    }, { status: 201 });
  } catch (err) {
    console.error("[Accounts] Create error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
