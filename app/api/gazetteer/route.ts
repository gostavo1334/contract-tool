import { NextResponse } from "next/server";
import gazetteerData from "@/lib/gazetteer.json";

export async function GET() {
  return NextResponse.json(gazetteerData, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
