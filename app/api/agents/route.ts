import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { toLatinDigits } from "@/lib/khmer";
import { getSessionUser, resolveUserBranch } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const userBranch = await resolveUserBranch(session);

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const qNorm = toLatinDigits(q);

  let query = supabase.from("agents").select("*").order("id", { ascending: false });

  if (userBranch) {
    query = query.or(`branch_code.eq.${userBranch},agent_code.ilike.${userBranch}%`);
  }

  if (q) {
    query = query.or(
      `agent_code.ilike.%${q}%,name_kh.ilike.%${q}%,name_latin.ilike.%${q}%,phone.ilike.%${q}%,phone_norm.ilike.%${qNorm}%,id_number.ilike.%${q}%,id_number_norm.ilike.%${qNorm}%`
    );
  }

  const { data, error } = await query.limit(200);
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
  const userBranch = await resolveUserBranch(session);
  try {
    const body = await req.json();
    const id = body.id ? parseInt(body.id, 10) : undefined;
    const requestedBranch = (body.branch_code || "").trim().toUpperCase();
    const targetBranch = userBranch || requestedBranch;
    const agentCode = (body.agent_code || body.contract_no || "").trim().toUpperCase();
    const idNumber = (body.id_number || "").trim();
    const phone = (body.phone || "").trim();

    const record: any = {
      agent_code: agentCode,
      branch_code: targetBranch,
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

export async function DELETE(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  const userBranch = await resolveUserBranch(session);

  const { searchParams } = new URL(req.url);
  const idStr = searchParams.get("id");
  if (!idStr) {
    return NextResponse.json({ detail: "Missing agent ID" }, { status: 400 });
  }
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ detail: "Invalid agent ID" }, { status: 400 });
  }

  // If user is branch-scoped, check that this agent belongs to their branch
  if (userBranch) {
    const { data: existingAgent } = await supabase
      .from("agents")
      .select("branch_code, agent_code")
      .eq("id", id)
      .maybeSingle();

    if (!existingAgent) {
      return NextResponse.json({ detail: "រកមិនឃើញភ្នាក់ងារនេះទេ" }, { status: 404 });
    }

    const agBranch = (existingAgent.branch_code || "").toUpperCase();
    const agCode = (existingAgent.agent_code || "").toUpperCase();
    if (agBranch !== userBranch && !agCode.startsWith(userBranch)) {
      return NextResponse.json(
        { detail: "លោកអ្នកគ្មានសិទ្ធិលុបទិន្នន័យភ្នាក់ងាររបស់សាខាផ្សេងទេ" },
        { status: 403 }
      );
    }
  }

  const { error } = await supabase.from("agents").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ detail: error.message }, { status: 400 });
  }

  return NextResponse.json({ status: "ok", id });
}
