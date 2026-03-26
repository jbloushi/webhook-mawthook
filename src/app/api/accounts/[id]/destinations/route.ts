import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const links = await prisma.accountDestination.findMany({
    where: { accountId: id },
    include: { destination: true },
  });

  return NextResponse.json({
    destinations: links.map((l) => ({
      ...l.destination,
      linked: true,
      active: l.active,
      linkedAt: l.createdAt,
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { destinationId } = await request.json();

  if (!destinationId) {
    return NextResponse.json(
      { error: "destinationId is required" },
      { status: 400 }
    );
  }

  try {
    const link = await prisma.accountDestination.create({
      data: { accountId: id, destinationId },
      include: { destination: true },
    });

    return NextResponse.json({ link }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Link already exists or invalid IDs" },
      { status: 409 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { destinationId } = await request.json();

  try {
    await prisma.accountDestination.deleteMany({
      where: { accountId: id, destinationId },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
