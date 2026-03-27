import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const account = await prisma.whatsAppAccount.findUnique({
    where: { id },
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
      destinations: {
        include: { destination: true },
      },
      _count: { select: { messages: true } },
    },
  });

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const appUrl = process.env.APP_URL || "http://localhost:3000";

  return NextResponse.json({
    account: {
      ...account,
      webhookUrl: `${appUrl}/api/webhook/${account.id}`,
    },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.phoneNumber !== undefined) updateData.phoneNumber = body.phoneNumber;
  if (body.phoneNumberId !== undefined) updateData.phoneNumberId = body.phoneNumberId;
  if (body.wabaId !== undefined) updateData.wabaId = body.wabaId;
  if (body.chatwootInboxId !== undefined) updateData.chatwootInboxId = body.chatwootInboxId;
  if (body.active !== undefined) updateData.active = body.active;
  if (body.accessToken) updateData.accessToken = encrypt(body.accessToken);
  if (body.appSecret) updateData.appSecret = encrypt(body.appSecret);

  try {
    const account = await prisma.whatsAppAccount.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        phoneNumberId: true,
        active: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ account });
  } catch {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await prisma.whatsAppAccount.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
}
