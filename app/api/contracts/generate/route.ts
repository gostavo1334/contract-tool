import { NextRequest, NextResponse } from "next/server";
import PizZip from "pizzip";
import { supabase } from "@/lib/supabase";
import { buildTemplateContext, renderDocxBuffer, convertDocxToPdf } from "@/lib/engine";
import { ContractFormPayload, Branch } from "@/lib/shared";
import { toLatinDigits } from "@/lib/khmer";
import { getSessionUser, resolveUserBranch } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    const userBranch = session ? await resolveUserBranch(session) : null;
    const body = await req.json();
    const payload: ContractFormPayload = body;
    if (userBranch) {
      payload.branch_code = userBranch;
    }
    const needPdf = Boolean(body.need_pdf);
    const pdfLang: "kh" | "en" | "both" =
      body.pdf_lang === "kh" || body.pdf_lang === "en" ? body.pdf_lang : "both";

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

    // Render Khmer contract
    const preparedKh = buildTemplateContext({ ...payload, lang: "kh" }, branch, settingsMap);
    const docxBufKh = renderDocxBuffer(preparedKh);
    const pdfBufKh =
      needPdf && (pdfLang === "kh" || pdfLang === "both")
        ? await convertDocxToPdf(docxBufKh)
        : null;

    // Render English contract
    const preparedEn = buildTemplateContext({ ...payload, lang: "en" }, branch, settingsMap);
    const docxBufEn = renderDocxBuffer(preparedEn);
    const pdfBufEn =
      needPdf && (pdfLang === "en" || pdfLang === "both")
        ? await convertDocxToPdf(docxBufEn)
        : null;

    const contractNo = preparedKh.context.contract_no;
    const latinSlug = (preparedKh.context.agent_name_latin || "Agent").replace(/[^A-Za-z0-9]+/g, "_");

    const docxFilenameKh = `${preparedKh.template_type}_${contractNo}_${latinSlug}_KH.docx`;
    const pdfFilenameKh = `${preparedKh.template_type}_${contractNo}_${latinSlug}_KH.pdf`;
    const docxFilenameEn = `${preparedEn.template_type}_${contractNo}_${latinSlug}_EN.docx`;
    const pdfFilenameEn = `${preparedEn.template_type}_${contractNo}_${latinSlug}_EN.pdf`;

    // Upload both to Supabase Storage if bucket exists
    let docxPath = docxFilenameKh;
    let pdfPath = pdfBufKh ? pdfFilenameKh : "";
    try {
      await supabase.storage.from("contracts").upload(docxFilenameKh, docxBufKh, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });
      await supabase.storage.from("contracts").upload(docxFilenameEn, docxBufEn, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });
      if (pdfBufKh) {
        await supabase.storage.from("contracts").upload(pdfFilenameKh, pdfBufKh, {
          contentType: "application/pdf",
          upsert: true,
        });
      }
      if (pdfBufEn) {
        await supabase.storage.from("contracts").upload(pdfFilenameEn, pdfBufEn, {
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
      name_kh: preparedKh.context.agent_name_kh,
      name_latin: preparedKh.context.agent_name_latin,
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
      address_full: preparedKh.address_full,
      bank_name: preparedKh.context.bank_name,
      bank_account_name: preparedKh.context.bank_account_name,
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
      contract_date: preparedKh.date_info.ddmmyyyy,
      branch_code: branch.code,
      agent_id: savedAgent?.id || null,
      agent_name_kh: preparedKh.context.agent_name_kh,
      agent_name_latin: preparedKh.context.agent_name_latin,
      agent_phone: toLatinDigits(payload.phone),
      agent_id_number: toLatinDigits(payload.id_number),
      template_type: preparedKh.template_type,
      eq_printer: preparedKh.eq_printer_bool,
      eq_scale: preparedKh.eq_scale_bool,
      eq_basket: preparedKh.eq_basket_bool,
      eq_deposit_total: preparedKh.eq_deposit_total,
      fixed_deposit: preparedKh.fixed_deposit,
      docx_path: docxPath,
      pdf_path: pdfPath,
      payload: payload,
      created_at: new Date().toISOString(),
    };

    const { data: contractRecord } = await supabase.from("contracts").insert(contractPayload).select().single();

    // Advance next_seq if contractNo matches branch prefix
    try {
      const cnoNorm = toLatinDigits(contractNo).toUpperCase();
      if (cnoNorm.startsWith(branch.code)) {
        const suffix = cnoNorm.slice(branch.code.length);
        const match = suffix.match(/^(\d+)/);
        if (match) {
          const usedSeq = parseInt(match[1], 10);
          await supabase.rpc("bump_branch_seq", { p_code: branch.code, p_next: usedSeq + 1 });
        }
      }
    } catch (seqErr) {
      console.warn("bump_branch_seq warning:", seqErr);
    }

    const docxBase64Kh = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${docxBufKh.toString("base64")}`;
    const pdfBase64Kh = pdfBufKh ? `data:application/pdf;base64,${pdfBufKh.toString("base64")}` : null;
    const docxBase64En = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${docxBufEn.toString("base64")}`;
    const pdfBase64En = pdfBufEn ? `data:application/pdf;base64,${pdfBufEn.toString("base64")}` : null;

    const zip = new PizZip();
    zip.file(docxFilenameKh, docxBufKh);
    zip.file(docxFilenameEn, docxBufEn);
    const zipBuf = zip.generate({ type: "nodebuffer" });
    const zipFilename = `${preparedKh.template_type}_${contractNo}_${latinSlug}_KH_EN.zip`;
    const zipBase64 = `data:application/zip;base64,${zipBuf.toString("base64")}`;

    const { data: updatedBranches } = await supabase.from("branches").select("*").order("code", { ascending: true });

    return NextResponse.json({
      status: "ok",
      agent: savedAgent,
      contract: contractRecord,
      branches: updatedBranches || [],
      docx_base64_kh: docxBase64Kh,
      docx_filename_kh: docxFilenameKh,
      pdf_base64_kh: pdfBase64Kh,
      pdf_filename_kh: pdfFilenameKh,
      docx_base64_en: docxBase64En,
      docx_filename_en: docxFilenameEn,
      pdf_base64_en: pdfBase64En,
      pdf_filename_en: pdfFilenameEn,
      zip_base64: zipBase64,
      zip_filename: zipFilename,
      // Default compatibility keys
      docx_base64: docxBase64Kh,
      docx_filename: docxFilenameKh,
      pdf_base64: pdfBase64Kh,
      pdf_filename: pdfFilenameKh,
      context: preparedKh.context,
      context_kh: preparedKh.context,
      context_en: preparedEn.context,
      eq_deposit_total: preparedKh.eq_deposit_total,
      fixed_deposit: preparedKh.fixed_deposit,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
