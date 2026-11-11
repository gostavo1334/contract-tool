import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { buildTemplateContext, renderDocxBuffer, convertDocxToPdf } from "@/lib/engine";
import { ContractFormPayload, Branch } from "@/lib/shared";

function validatePayload(p: ContractFormPayload): string[] {
  const errors: string[] = [];
  if (!p.branch_code?.trim()) errors.push("សូមជ្រើសរើសសាខា (Branch is required)។");
  const code = (p.agent_code || p.contract_no || "").trim();
  if (!code) errors.push("សូមបញ្ចូលលេខកិច្ចសន្យា / កូដភ្នាក់ងារ (Contract No. / Agent Code is required)។");
  if (!p.name_kh?.trim()) errors.push("សូមបញ្ចូលឈ្មោះពេញជាអក្សរខ្មែរ (Full name in Khmer is required)។");
  if (!p.id_number?.trim()) errors.push("សូមបញ្ចូលលេខអត្តសញ្ញាណប័ណ្ណ (ID number is required)។");
  if (!p.phone?.trim()) errors.push("សូមបញ្ចូលលេខទូរស័ព្ទ (Phone number is required)។");
  if (!p.bank_account_no?.trim()) errors.push("សូមបញ្ចូលលេខគណនីធនាគារ (Bank account number is required)។");
  return errors;
}

export async function POST(req: NextRequest) {
  try {
    const payload: ContractFormPayload = await req.json();
    const errors = validatePayload(payload);
    if (errors.length > 0) {
      return NextResponse.json({ detail: errors.join(" | ") }, { status: 400 });
    }

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

    const docxBase64 = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${docxBuf.toString("base64")}`;
    const pdfBase64 = pdfBuf ? `data:application/pdf;base64,${pdfBuf.toString("base64")}` : null;

    return NextResponse.json({
      status: "ok",
      template_type: prepared.template_type,
      lang: prepared.lang,
      digit_style: prepared.digit_style,
      date_info: prepared.date_info,
      eq_deposit_total: prepared.eq_deposit_total,
      fixed_deposit: prepared.fixed_deposit,
      address_full: prepared.address_full,
      context: prepared.context,
      branch: branch,
      preview_docx_base64: docxBase64,
      preview_pdf_base64: pdfBase64,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
