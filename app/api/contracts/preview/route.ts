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

    const preparedKh = buildTemplateContext({ ...payload, lang: "kh" }, branch, settingsMap);
    const preparedEn = buildTemplateContext({ ...payload, lang: "en" }, branch, settingsMap);
    const docxBufKh = renderDocxBuffer(preparedKh);
    const docxBufEn = renderDocxBuffer(preparedEn);
    const pdfBufKh = await convertDocxToPdf(docxBufKh);
    const pdfBufEn = await convertDocxToPdf(docxBufEn);

    const docxBase64Kh = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${docxBufKh.toString("base64")}`;
    const docxBase64En = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${docxBufEn.toString("base64")}`;
    const pdfBase64Kh = pdfBufKh ? `data:application/pdf;base64,${pdfBufKh.toString("base64")}` : null;
    const pdfBase64En = pdfBufEn ? `data:application/pdf;base64,${pdfBufEn.toString("base64")}` : null;

    return NextResponse.json({
      status: "ok",
      template_type: preparedKh.template_type,
      lang: preparedKh.lang,
      digit_style: preparedKh.digit_style,
      date_info: preparedKh.date_info,
      eq_deposit_total: preparedKh.eq_deposit_total,
      fixed_deposit: preparedKh.fixed_deposit,
      address_full: preparedKh.address_full,
      context: preparedKh.context,
      context_kh: preparedKh.context,
      context_en: preparedEn.context,
      branch: branch,
      preview_docx_base64: docxBase64Kh,
      preview_docx_base64_kh: docxBase64Kh,
      preview_docx_base64_en: docxBase64En,
      preview_pdf_base64: pdfBase64Kh,
      preview_pdf_base64_kh: pdfBase64Kh,
      preview_pdf_base64_en: pdfBase64En,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
