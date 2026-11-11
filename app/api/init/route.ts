import { NextRequest, NextResponse } from "next/server";
import { getInitData } from "@/lib/server-data";

export async function GET() {
  try {
    const data = await getInitData();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
