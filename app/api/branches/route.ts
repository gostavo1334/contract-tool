import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Branch, ContractRecord } from "@/lib/shared";

export async function GET() {
  const [branchesRes, contractsRes] = await Promise.all([
    supabase.from("branches").select("*").order("code", { ascending: true }),
    supabase.from("contracts").select("contract_no, branch_code"),
  ]);

  const contracts = (contractsRes.data || []) as ContractRecord[];
  const branches = ((branchesRes.data || []) as any[]).map((b) => {
    const code = b.code.toUpperCase();
    let maxHist = 0;
    for (const c of contracts) {
      const cno = (c.contract_no || "").toUpperCase();
      if (cno.startsWith(code)) {
        const numPart = parseInt(cno.slice(code.length), 10);
        if (!isNaN(numPart) && numPart > maxHist) {
          maxHist = numPart;
        }
      }
    }
    const nextNum = Math.max(b.next_seq || 1, maxHist + 1);
    return {
      ...b,
      next_contract_no: `${code}${String(nextNum).padStart(3, "0")}`,
    };
  });

  return NextResponse.json(branches);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = (body.code || "").trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ detail: "កូដសាខា (Branch code) មិនអាចទទេបានទេ។" }, { status: 400 });
    }

    const payload = {
      code,
      province_kh: (body.province_kh || "").trim(),
      director_kh: (body.director_kh || "").trim(),
      director_latin: (body.director_latin || "").trim(),
      body_name_format: body.body_name_format === "latin" ? "latin" : "khmer",
      next_seq: parseInt(body.next_seq, 10) || 1,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("branches").upsert(payload).select().single();
    if (error) {
      return NextResponse.json({ detail: error.message }, { status: 400 });
    }
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
