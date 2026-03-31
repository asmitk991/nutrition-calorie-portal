import { NextResponse } from "next/server";

import { validateMenuItems } from "@/lib/menu-input-schema";
import { estimateMenuItems } from "@/lib/portal-data";


export async function POST(request) {
  try {
    const body = await request.json();
    const rawItems = Array.isArray(body?.items) ? body.items : [];
    const { normalizedItems, errors } = validateMenuItems(rawItems);

    if (!normalizedItems.length) {
      return NextResponse.json({ error: "No menu items received." }, { status: 400 });
    }

    if (errors.length) {
      return NextResponse.json(
        {
          error: "Each menu item must include RID, ITEM_NAME, and ITEM_PRICE before estimation can run.",
          details: errors,
        },
        { status: 400 }
      );
    }

    const payload = await estimateMenuItems(normalizedItems);
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
