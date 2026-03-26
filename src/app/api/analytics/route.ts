import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const range = searchParams.get("range") || "7d";

  const now = new Date();
  let since: Date;
  switch (range) {
    case "24h":
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "30d":
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "7d":
    default:
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
  }

  const [
    totalMessages,
    inboundCount,
    outboundCount,
    deliveryStats,
    messagesPerAccount,
    recentMessages,
  ] = await Promise.all([
    prisma.message.count({ where: { createdAt: { gte: since } } }),
    prisma.message.count({
      where: { createdAt: { gte: since }, direction: "inbound" },
    }),
    prisma.message.count({
      where: { createdAt: { gte: since }, direction: "outbound" },
    }),
    prisma.deliveryAttempt.groupBy({
      by: ["status"],
      where: { createdAt: { gte: since } },
      _count: true,
    }),
    prisma.message.groupBy({
      by: ["accountId"],
      where: { createdAt: { gte: since } },
      _count: true,
    }),
    prisma.message.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Build delivery status breakdown
  const deliveryBreakdown: Record<string, number> = {};
  for (const stat of deliveryStats) {
    deliveryBreakdown[stat.status] = stat._count;
  }

  const totalDeliveries = Object.values(deliveryBreakdown).reduce((a, b) => a + b, 0);
  const successRate =
    totalDeliveries > 0
      ? ((deliveryBreakdown["success"] || 0) / totalDeliveries) * 100
      : 0;

  // Build daily volume
  const dailyVolume: Record<string, number> = {};
  for (const msg of recentMessages) {
    const day = msg.createdAt.toISOString().split("T")[0];
    dailyVolume[day] = (dailyVolume[day] || 0) + 1;
  }

  // Get account names for per-account stats
  const accountIds = messagesPerAccount.map((m) => m.accountId);
  const accounts = await prisma.whatsAppAccount.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, name: true },
  });
  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]));

  return NextResponse.json({
    range,
    totalMessages,
    inboundCount,
    outboundCount,
    successRate: Math.round(successRate * 100) / 100,
    deliveryBreakdown,
    dailyVolume: Object.entries(dailyVolume).map(([date, count]) => ({
      date,
      count,
    })),
    messagesPerAccount: messagesPerAccount.map((m) => ({
      accountId: m.accountId,
      accountName: accountMap[m.accountId] || "Unknown",
      count: m._count,
    })),
  });
}
