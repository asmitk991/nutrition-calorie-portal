import { NextResponse } from "next/server";

import { estimateMenuItems } from "@/lib/portal-data";


export async function POST(request) {
  try {
    const body = await request.json();
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!items.length) {
      return NextResponse.json({ error: "No menu items received." }, { status: 400 });
    }

    const payload = await estimateMenuItems(items);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to estimate menu items.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
