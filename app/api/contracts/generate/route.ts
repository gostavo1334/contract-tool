import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { buildTemplateContext, renderDocxBuffer, convertDocxToPdf } from "@/lib/engine";
import { ContractFormPayload, Branch } from "@/lib/shared";
import { toLatinDigits } from "@/lib/khmer";

export async function POST(req: NextRequest) {
  try {
    const payload: ContractFormPayload = await req.json();

    const { data: branchData, error: branchErr } = await supabase
      .from("branches")
      .select("*")
      .eq("code", payload.branch_code.toUpperCase())
      .single();

    if (branchErr || !branchData) {
      return NextResponse.json({ detail: `រកមិនឃើញសាខា '${payload.branch_code}' ទេ។` }, { status: 400 });
    }

    const branch = branchData as Branch;
    const { data: settingsData } = await supabase.from("settings").select("*");
    const settingsMap: Record<string, any> = {};
    for (const s of settingsData || []) settingsMap[s.key] = s.value;

    const prepared = buildTemplateContext(payload, branch, settingsMap);
    const docxBuf = renderDocxBuffer(prepared);
    const pdfBuf = await convertDocxToPdf(docxBuf);

    const ctx = prepared.context;
    const contractNo = ctx.contract_no;
    const latinSlug = (ctx.agent_name_latin || "Agent").replace(/[^A-Za-z0-9]+/g, "_");
    const langSuffix = prepared.lang === "en" ? "_EN" : "";
    const filenameStem = `${prepared.template_type}${langSuffix}_${contractNo}_${latinSlug}`;
    const docxFilename = `${filenameStem}.docx`;
    const pdfFilename = `${filenameStem}.pdf`;

    // Upload to Supabase Storage if bucket exists
    let docxPath = docxFilename;
    let pdfPath = pdfBuf ? pdfFilename : "";
    try {
      await supabase.storage.from("contracts").upload(docxFilename, docxBuf, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });
      if (pdfBuf) {
        await supabase.storage.from("contracts").upload(pdfFilename, pdfBuf, {
          contentType: "application/pdf",
          upsert: true,
        });
      }
    } catch (storageErr) {
      console.warn("Storage upload warning:", storageErr);
    }

    // Save/update agent in database
    const agentPayload: any = {
      agent_code: contractNo,
      branch_code: branch.code,
      name_kh: ctx.agent_name_kh,
      name_latin: ctx.agent_name_latin,
      id_number: toLatinDigits(payload.id_number),
      id_number_norm: toLatinDigits(payload.id_number),
      phone: toLatinDigits(payload.phone),
      phone_norm: toLatinDigits(payload.phone),
      email: payload.email,
      house_no: payload.house_no,
      street: payload.street,
      village: payload.village,
      commune: payload.commune,
      district: payload.district,
      province: payload.province,
      address_full: prepared.address_full,
      bank_name: ctx.bank_name,
      bank_account_name: ctx.bank_account_name,
      bank_account_no: toLatinDigits(payload.bank_account_no),
      company_name: payload.company_name,
      company_law: payload.company_law,
      company_reg_no: payload.company_reg_no,
      company_reg_date: payload.company_reg_date,
      company_tax_no: payload.company_tax_no,
      company_address: payload.company_address,
      updated_at: new Date().toISOString(),
    };

    let savedAgent: any = null;
    if (payload.agent_id) {
      const { data } = await supabase.from("agents").update(agentPayload).eq("id", payload.agent_id).select().single();
      savedAgent = data;
    } else {
      const { data: existCode } = await supabase.from("agents").select("id").eq("agent_code", contractNo).maybeSingle();
      if (existCode) {
        const { data } = await supabase.from("agents").update(agentPayload).eq("id", existCode.id).select().single();
        savedAgent = data;
      } else {
        agentPayload.created_at = new Date().toISOString();
        const { data } = await supabase.from("agents").insert(agentPayload).select().single();
        savedAgent = data;
      }
    }

    // Record contract history
    const contractPayload = {
      contract_no: contractNo,
      contract_date: prepared.date_info.ddmmyyyy,
      branch_code: branch.code,
      agent_id: savedAgent?.id || null,
      agent_name_kh: ctx.agent_name_kh,
      agent_name_latin: ctx.agent_name_latin,
      agent_phone: toLatinDigits(payload.phone),
      agent_id_number: toLatinDigits(payload.id_number),
      template_type: prepared.template_type,
      eq_printer: prepared.eq_printer_bool,
      eq_scale: prepared.eq_scale_bool,
      eq_basket: prepared.eq_basket_bool,
      eq_deposit_total: prepared.eq_deposit_total,
      fixed_deposit: prepared.fixed_deposit,
      docx_path: docxPath,
      pdf_path: pdfPath,
      payload: payload,
      created_at: new Date().toISOString(),
    };

    const { data: contractRecord } = await supabase.from("contracts").insert(contractPayload).select().single();

    // Advance next_seq if contractNo matches branch prefix
    const cnoNorm = toLatinDigits(contractNo).toUpperCase();
    if (cnoNorm.startsWith(branch.code)) {
      const suffix = cnoNorm.slice(branch.code.length);
      const match = suffix.match(/^(\d+)/);
      if (match) {
        const usedSeq = parseInt(match[1], 10);
        await supabase.rpc("bump_branch_seq", { p_code: branch.code, p_next: usedSeq + 1 });
      }
    }

    const docxBase64 = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${docxBuf.toString("base64")}`;
    const pdfBase64 = pdfBuf ? `data:application/pdf;base64,${pdfBuf.toString("base64")}` : null;

    const { data: updatedBranches } = await supabase.from("branches").select("*").order("code", { ascending: true });

    return NextResponse.json({
      status: "ok",
      agent: savedAgent,
      contract: contractRecord,
      branches: updatedBranches || [],
      docx_base64: docxBase64,
      docx_filename: docxFilename,
      pdf_base64: pdfBase64,
      pdf_filename: pdfFilename,
      context: ctx,
      eq_deposit_total: prepared.eq_deposit_total,
      fixed_deposit: prepared.fixed_deposit,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
