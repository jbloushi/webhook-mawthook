import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const skip = parseInt(params.get("skip") || "0");
  const take = parseInt(params.get("take") || "50");
  const direction = params.get("direction") || undefined;
  const status = params.get("status") || undefined;

  const where: Record<string, unknown> = {};
  if (direction) where.direction = direction;
  if (status) where.status = status;

  const messages = await prisma.message.findMany({
    where,
    include: {
      account: { select: { name: true } },
      deliveryAttempts: {
        include: { destination: { select: { name: true, url: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });

  return NextResponse.json({ messages });
}
