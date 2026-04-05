import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

export async function GET() {
  const destinations = await prisma.webhookDestination.findMany({
    select: {
      id: true,
      name: true,
      type: true,
      url: true,
      headers: true,
      active: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { accounts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    destinations: destinations.map((d) => ({
      ...d,
      url: decrypt(d.url),
      headers: JSON.parse(decrypt(d.headers)),
    })),
  });
}

export async function POST(request: NextRequest) {
  try {
    const { name, type, url, headers, active } = await request.json();

    if (!name || !url) {
      return NextResponse.json(
        { error: "name and url are required" },
        { status: 400 }
      );
    }

    const destination = await prisma.webhookDestination.create({
      data: {
        name,
        type: type || "custom",
        url: encrypt(url),
        headers: encrypt(JSON.stringify(headers || {})),
        active: active ?? true,
      },
    });

    return NextResponse.json({
      destination: {
        ...destination,
        url,
        headers: headers || {},
      },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
