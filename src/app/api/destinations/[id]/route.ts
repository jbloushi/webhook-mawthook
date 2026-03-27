import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const destination = await prisma.webhookDestination.findUnique({
    where: { id },
    include: {
      accounts: { include: { account: true } },
      _count: { select: { attempts: true } },
    },
  });

  if (!destination) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ destination });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.type !== undefined) updateData.type = body.type;
  if (body.url !== undefined) updateData.url = body.url;
  if (body.headers !== undefined) updateData.headers = body.headers;
  if (body.active !== undefined) updateData.active = body.active;

  try {
    const destination = await prisma.webhookDestination.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({ destination });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.webhookDestination.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
