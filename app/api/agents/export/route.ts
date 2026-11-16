import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabase.from("agents").select("*").order("id", { ascending: false });
  if (error) {
    return NextResponse.json({ detail: error.message }, { status: 400 });
  }

  const fieldnames = [
    "id",
    "agent_code",
    "name_kh",
    "name_latin",
    "id_number",
    "phone",
    "email",
    "house_no",
    "street",
    "village",
    "commune",
    "district",
    "province",
    "address_full",
    "bank_name",
    "bank_account_name",
    "bank_account_no",
    "branch_code",
  ];

  let csvContent = "\uFEFF" + fieldnames.join(",") + "\n";
  for (const ag of data || []) {
    const row = fieldnames.map((field) => {
      const val = (ag[field] ?? "").toString().replace(/"/g, '""');
      return `"${val}"`;
    });
    csvContent += row.join(",") + "\n";
  }

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="agents_export.csv"',
    },
  });
}
