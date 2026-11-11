import { NextRequest, NextResponse } from "next/server";
import { transliterateKhmerToLatin, formatContractDate } from "@/lib/khmer";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const nameKh = searchParams.get("name_kh") || "";
  const dateStr = searchParams.get("date_str") || "";
  const templateType = searchParams.get("template_type") || "NEW";

  const nameLatin = nameKh ? transliterateKhmerToLatin(nameKh) : "";
  const dateInfo = formatContractDate(dateStr, templateType);

  return NextResponse.json({
    name_latin: nameLatin,
    date_info: dateInfo,
  });
}
