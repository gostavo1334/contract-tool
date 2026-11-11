import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import {
  formatContractDate,
  parseDateParts,
  composeKhmerAddress,
  toLatinDigits,
  formatDigitsByStyle,
  transliterateKhmerToLatin,
  stripTitle,
  type DigitStyle,
} from "./khmer";
import {
  type Branch,
  type ContractFormPayload,
  directorBodyName,
  detectBranchFromCode,
  KHMER_TO_ENGLISH_PROVINCE,
} from "./shared";

const TEMPLATES_DIR = path.join(process.cwd(), "templates");

// Dotted lines matching original docx for company fields in old template
const OLD_COMPANY_DOTS: Record<string, string> = {
  company_name: ".".repeat(74),
  company_law: ".".repeat(108),
  company_reg_no: ".".repeat(106),
  company_reg_date: ".".repeat(83),
  company_tax_no: ".".repeat(58),
  company_address: ".".repeat(106),
};

export interface PreparedContext {
  template_type: "NEW" | "OLD";
  lang: "kh" | "en";
  digit_style: DigitStyle;
  date_info: ReturnType<typeof formatContractDate>;
  eq_printer_bool: boolean;
  eq_scale_bool: boolean;
  eq_basket_bool: boolean;
  eq_deposit_total: number;
  fixed_deposit: number;
  address_full: string;
  context: Record<string, any>;
}

export function buildTemplateContext(
  payload: ContractFormPayload,
  branch: Branch,
  settings?: { new_digit_style?: DigitStyle; old_digit_style?: DigitStyle }
): PreparedContext {
  const templateType: "NEW" | "OLD" = payload.template_type === "OLD" ? "OLD" : "NEW";
  const lang: "kh" | "en" = payload.lang === "en" ? "en" : "kh";
  const isEn = lang === "en";

  const defaultDigitStyle: DigitStyle = templateType === "NEW" ? "khmer" : "latin";
  const settingKey = templateType === "NEW" ? "new_digit_style" : "old_digit_style";
  const digitStyle: DigitStyle = isEn
    ? "latin"
    : (payload.digit_style || settings?.[settingKey] || defaultDigitStyle);

  const dateInfo = formatContractDate(payload.contract_date, templateType);
  const parsedDate = parseDateParts(payload.contract_date);
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");

  const directorBody = directorBodyName(branch);
  const directorLatin = branch.director_latin.trim();
  const branchProvinceKh = branch.province_kh.trim();
  const branchProvinceEn = KHMER_TO_ENGLISH_PROVINCE[branchProvinceKh] || branchProvinceKh;

  let agentNameKh = stripTitle(payload.name_kh || "");
  let agentNameLatin = (payload.name_latin || "").trim();
  if (!agentNameLatin && agentNameKh) {
    agentNameLatin = transliterateKhmerToLatin(agentNameKh);
  }

  const rawId = (payload.id_number || "").trim();
  const rawPhone = (payload.phone || "").trim();
  const rawBankNo = (payload.bank_account_no || "").trim();

  const idNumberFmt = formatDigitsByStyle(rawId, digitStyle);
  const phoneFmt = formatDigitsByStyle(rawPhone, digitStyle);
  const bankNoFmt = formatDigitsByStyle(rawBankNo, digitStyle);

  let addressFull = (payload.address_full || "").trim();
  if (!addressFull) {
    addressFull = composeKhmerAddress({
      house_no: payload.house_no,
      street: payload.street,
      village: payload.village,
      commune: payload.commune,
      district: payload.district,
      province: payload.province,
    });
  }

  const bankName = (payload.bank_name || "eMoney").trim();
  const bankAccountName = (payload.bank_account_name || agentNameLatin).trim();
  const email = (payload.email || "").trim();

  const eqPrinterBool = templateType === "OLD" ? true : Boolean(payload.eq_printer);
  const eqScaleBool = Boolean(payload.eq_scale);
  const eqBasketBool = Boolean(payload.eq_basket);

  const eqDepositTotal =
    (eqPrinterBool ? 150 : 0) + (eqScaleBool ? 65 : 0) + (eqBasketBool ? 35 : 0);
  const fixedDeposit = templateType === "NEW" ? 50 : 250;

  const companyCtx: Record<string, string> = {};
  for (const [key, defaultDots] of Object.entries(OLD_COMPANY_DOTS)) {
    const val = ((payload as any)[key] || "").trim();
    companyCtx[key] = val || defaultDots;
  }

  const contractNo = (payload.agent_code || payload.contract_no || "").trim();

  const context: Record<string, any> = {
    contract_no: contractNo,
    agent_code: contractNo,
    day: isEn ? pad(parsedDate.d) : dateInfo.day,
    month: isEn ? pad(parsedDate.m) : dateInfo.month,
    year: isEn ? pad(parsedDate.y, 4) : dateInfo.year,
    director_body_name: directorBody,
    branch_province_kh: branchProvinceKh,
    branch_province_en: branchProvinceEn,
    director_latin: directorLatin,
    agent_name_kh: agentNameKh,
    agent_name_latin: agentNameLatin,
    id_number: idNumberFmt,
    phone: phoneFmt,
    email: email,
    address: addressFull,
    registration_address: addressFull,
    bank_name: bankName,
    bank_account_name: bankAccountName,
    bank_account_no: bankNoFmt,
    eq_printer: eqPrinterBool
      ? isEn && templateType === "OLD"
        ? "Compulsory"
        : "☑"
      : "☐",
    eq_scale: eqScaleBool ? "☑" : "☐",
    eq_basket: eqBasketBool ? "☑" : "☐",
    eq_deposit_sum: `$${eqDepositTotal}`,
    ...companyCtx,
  };

  return {
    template_type: templateType,
    lang,
    digit_style: digitStyle,
    date_info: dateInfo,
    eq_printer_bool: eqPrinterBool,
    eq_scale_bool: eqScaleBool,
    eq_basket_bool: eqBasketBool,
    eq_deposit_total: eqDepositTotal,
    fixed_deposit: fixedDeposit,
    address_full: addressFull,
    context,
  };
}

export function renderDocxBuffer(prepared: PreparedContext): Buffer {
  let tplName: string;
  if (prepared.lang === "en") {
    tplName =
      prepared.template_type === "NEW"
        ? "new_agreement_en_template.docx"
        : "old_agreement_en_template.docx";
  } else {
    tplName =
      prepared.template_type === "NEW"
        ? "new_agreement_template.docx"
        : "old_agreement_template.docx";
  }

  const primaryPath = path.join(process.cwd(), "templates", tplName);
  const fallbackPath = path.join(process.cwd(), "web", "templates", tplName);
  const tplPath = fs.existsSync(primaryPath) ? primaryPath : fallbackPath;
  const content = fs.readFileSync(tplPath);
  const zip = new PizZip(content);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
  });

  doc.render(prepared.context);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}

export async function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer | null> {
  const converterUrl = process.env.PDF_CONVERTER_URL;
  if (!converterUrl) {
    return null;
  }
  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(docxBuffer)], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    formData.append("files", blob, "contract.docx");

    const res = await fetch(converterUrl, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      console.warn("External PDF converter failed with status:", res.status);
      return null;
    }
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch (err) {
    console.warn("PDF conversion error:", err);
    return null;
  }
}
