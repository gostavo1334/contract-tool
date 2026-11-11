/** Shared types and pure helpers (safe for both server and client components). */

export type BodyNameFormat = "khmer" | "latin";

export interface Branch {
  code: string;
  province_kh: string;
  director_kh: string;
  director_latin: string;
  body_name_format: BodyNameFormat;
  next_seq: number;
  updated_at?: string;
  /** Computed: branch code + 3-digit running number (from next_seq and contracts history). */
  next_contract_no: string;
}

export interface Agent {
  id: number;
  agent_code: string;
  branch_code: string;
  name_kh: string;
  name_latin: string;
  id_number: string;
  id_number_norm?: string;
  phone: string;
  phone_norm?: string;
  email: string;
  house_no: string;
  street: string;
  village: string;
  commune: string;
  district: string;
  province: string;
  address_full: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_no: string;
  company_name: string;
  company_law: string;
  company_reg_no: string;
  company_reg_date: string;
  company_tax_no: string;
  company_address: string;
  created_at?: string;
  updated_at?: string;
}

export interface ContractRecord {
  id: number;
  contract_no: string;
  contract_date: string;
  branch_code: string;
  agent_id: number | null;
  agent_name_kh: string;
  agent_name_latin: string;
  agent_phone: string;
  agent_id_number: string;
  template_type: "NEW" | "OLD";
  eq_printer: boolean;
  eq_scale: boolean;
  eq_basket: boolean;
  eq_deposit_total: number;
  fixed_deposit: number;
  docx_path: string;
  pdf_path: string;
  created_at: string;
}

export interface Settings {
  new_digit_style: "khmer" | "latin";
  old_digit_style: "khmer" | "latin";
}

export interface TagRef {
  location: string;
  tag: string;
  original_text: string;
  description: string;
}

export interface ContractFormPayload {
  template_type: "NEW" | "OLD";
  lang?: "kh" | "en";
  branch_code: string;
  contract_no: string;
  agent_code?: string;
  contract_date: string;
  digit_style?: "khmer" | "latin" | null;
  agent_id?: number | null;
  name_kh: string;
  name_latin: string;
  id_number: string;
  phone: string;
  email: string;
  house_no: string;
  street: string;
  village: string;
  commune: string;
  district: string;
  province: string;
  address_full: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_no: string;
  eq_printer: boolean;
  eq_scale: boolean;
  eq_basket: boolean;
  company_name: string;
  company_law: string;
  company_reg_no: string;
  company_reg_date: string;
  company_tax_no: string;
  company_address: string;
}

export const EQUIPMENT_PRICES = { printer: 150, scale: 65, basket: 35 } as const;

/** Detect the branch prefix of an agent code (e.g. MONA011 -> MONA), longest known code first. */
export function detectBranchFromCode(code: string, branches: Pick<Branch, "code">[]): string {
  const upper = (code || "").trim().toUpperCase();
  if (!upper) return "";
  const sorted = [...branches].sort((a, b) => b.code.length - a.code.length);
  for (const b of sorted) {
    if (b.code && upper.startsWith(b.code.toUpperCase())) return b.code.toUpperCase();
  }
  const m = upper.match(/^([A-Z]+)/);
  return m ? m[1] : "";
}

export function agentBranchCode(ag: Pick<Agent, "agent_code" | "branch_code">, branches: Pick<Branch, "code">[]): string {
  return detectBranchFromCode(ag.agent_code, branches) || (ag.branch_code || "").trim().toUpperCase();
}

export function directorBodyName(b: Pick<Branch, "body_name_format" | "director_kh" | "director_latin">): string {
  return b.body_name_format === "khmer" && b.director_kh ? b.director_kh : b.director_latin || b.director_kh;
}

export const KHMER_TO_ENGLISH_PROVINCE: Record<string, string> = {
  "មណ្ឌលគិរី": "Mondulkiri",
  "ភ្នំពេញ": "Phnom Penh",
  "កណ្ដាល": "Kandal",
  "កណ្តាល": "Kandal",
  "កំពង់ចាម": "Kampong Cham",
  "កំពង់ឆ្នាំង": "Kampong Chhnang",
  "កំពង់ស្ពឺ": "Kampong Speu",
  "កំពង់ធំ": "Kampong Thom",
  "កំពត": "Kampot",
  "កែប": "Kep",
  "កោះកុង": "Koh Kong",
  "ក្រចេះ": "Kratie",
  "ព្រះវិហារ": "Preah Vihear",
  "ព្រះសីហនុ": "Preah Sihanouk",
  "ព្រៃវែង": "Prey Veng",
  "ពោធិ៍សាត់": "Pursat",
  "រតនគិរី": "Ratanakiri",
  "សៀមរាប": "Siem Reap",
  "ស្ទឹងត្រែង": "Stung Treng",
  "ស្វាយរៀង": "Svay Rieng",
  "តាកែវ": "Takeo",
  "ឧត្តរមានជ័យ": "Oddar Meanchey",
  "ប៉ៃលិន": "Pailin",
  "បន្ទាយមានជ័យ": "Banteay Meanchey",
  "បាត់ដំបង": "Battambang",
  "ត្បូងឃ្មុំ": "Tboung Khmum",
};

