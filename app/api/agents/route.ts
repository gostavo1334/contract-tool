import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { toLatinDigits } from "@/lib/khmer";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const qNorm = toLatinDigits(q);

  let query = supabase.from("agents").select("*").order("id", { ascending: false });

  if (q) {
    query = query.or(
      `agent_code.ilike.%${q}%,name_kh.ilike.%${q}%,name_latin.ilike.%${q}%,phone.ilike.%${q}%,phone_norm.ilike.%${qNorm}%,id_number.ilike.%${q}%,id_number_norm.ilike.%${qNorm}%`
    );
  }

  const { data, error } = await query.limit(100);
  if (error) {
    return NextResponse.json({ detail: error.message }, { status: 400 });
  }
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const id = body.id ? parseInt(body.id, 10) : undefined;
    const agentCode = (body.agent_code || body.contract_no || "").trim().toUpperCase();
    const idNumber = (body.id_number || "").trim();
    const phone = (body.phone || "").trim();

    const record: any = {
      agent_code: agentCode,
      branch_code: (body.branch_code || "").trim().toUpperCase(),
      name_kh: (body.name_kh || "").trim(),
      name_latin: (body.name_latin || "").trim(),
      id_number: idNumber,
      id_number_norm: toLatinDigits(idNumber),
      phone: phone,
      phone_norm: toLatinDigits(phone),
      email: (body.email || "").trim(),
      house_no: (body.house_no || "").trim(),
      street: (body.street || "").trim(),
      village: (body.village || "").trim(),
      commune: (body.commune || "").trim(),
      district: (body.district || "").trim(),
      province: (body.province || "").trim(),
      address_full: (body.address_full || "").trim(),
      bank_name: (body.bank_name || "eMoney").trim(),
      bank_account_name: (body.bank_account_name || "").trim(),
      bank_account_no: (body.bank_account_no || "").trim(),
      company_name: (body.company_name || "").trim(),
      company_law: (body.company_law || "").trim(),
      company_reg_no: (body.company_reg_no || "").trim(),
      company_reg_date: (body.company_reg_date || "").trim(),
      company_tax_no: (body.company_tax_no || "").trim(),
      company_address: (body.company_address || "").trim(),
      updated_at: new Date().toISOString(),
    };

    let resultData: any;
    if (id) {
      const { data, error } = await supabase.from("agents").update(record).eq("id", id).select().single();
      if (error) throw error;
      resultData = data;
    } else {
      // Check if existing agent with same agent_code or id_number_norm exists
      let existing: any = null;
      if (agentCode) {
        const checkCode = await supabase.from("agents").select("id").eq("agent_code", agentCode).maybeSingle();
        existing = checkCode.data;
      }
      if (!existing && record.id_number_norm) {
        const checkId = await supabase.from("agents").select("id").eq("id_number_norm", record.id_number_norm).maybeSingle();
        existing = checkId.data;
      }

      if (existing) {
        const { data, error } = await supabase.from("agents").update(record).eq("id", existing.id).select().single();
        if (error) throw error;
        resultData = data;
      } else {
        record.created_at = new Date().toISOString();
        const { data, error } = await supabase.from("agents").insert(record).select().single();
        if (error) throw error;
        resultData = data;
      }
    }

    const allAgents = await supabase.from("agents").select("*").order("id", { ascending: false }).limit(100);
    return NextResponse.json({ agent: resultData, agents: allAgents.data || [] });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 400 });
  }
}
