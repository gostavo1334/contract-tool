import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import Papa from "papaparse";
import ExcelJS from "exceljs";
import { toLatinDigits } from "@/lib/khmer";
import { getSessionUser, resolveUserBranch } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  const userBranch = await resolveUserBranch(session);
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ detail: "សូមជ្រើសរើសឯកសារ Excel ឬ CSV" }, { status: 400 });
    }

    const filename = file.name.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let rows: any[] = [];

    if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const worksheet = workbook.worksheets[0];
      const jsonRows: any[] = [];
      let headers: string[] = [];
      worksheet.eachRow((row, rowNumber) => {
        const values = (row.values as any[]).slice(1); // ExcelJS 1-based index
        if (rowNumber === 1) {
          headers = values.map((v) => String(v || "").trim().toLowerCase());
        } else {
          const rowObj: any = {};
          headers.forEach((h, idx) => {
            rowObj[h] = values[idx] !== undefined ? String(values[idx]).trim() : "";
          });
          jsonRows.push(rowObj);
        }
      });
      rows = jsonRows;
    } else {
      const text = buffer.toString("utf-8");
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      rows = parsed.data as any[];
    }

    const headerMap: Record<string, string[]> = {
      agent_code: ["agent_code", "code", "agent_no", "contract_no", "កូដភ្នាក់ងារ", "លេខកូដភ្នាក់ងារ", "លេខកិច្ចសន្យា"],
      name_kh: ["name_kh", "khmer_name", "full_name_kh", "ឈ្មោះពេញ", "ឈ្មោះខ្មែរ", "ឈ្មោះ"],
      name_latin: ["name_latin", "latin_name", "full_name_latin", "ឈ្មោះឡាតាំង", "អក្សរឡាតាំង"],
      id_number: ["id_number", "national_id", "id", "លេខអត្តសញ្ញាណប័ណ្ណ", "អត្តសញ្ញាណប័ណ្ណ"],
      phone: ["phone", "phone_number", "tel", "លេខទូរស័ព្ទ", "ទូរស័ព្ទ"],
      email: ["email", "អ៊ីម៉ែល"],
      house_no: ["house_no", "house", "ផ្ទះលេខ"],
      street: ["street", "ផ្លូវ"],
      village: ["village", "ភូមិ"],
      commune: ["commune", "sangkat", "ឃុំ", "ឃុំ/សង្កាត់"],
      district: ["district", "khan", "ស្រុក", "ស្រុក/ក្រុង", "ស្រុក/ខណ្ឌ"],
      province: ["province", "city", "ខេត្ត", "រាជធានី/ខេត្ត"],
      address_full: ["address_full", "address", "អាសយដ្ឋាន"],
      bank_name: ["bank_name", "bank", "ឈ្មោះធនាគារ", "ធនាគារ"],
      bank_account_name: ["bank_account_name", "account_name", "ឈ្មោះគណនីធនាគារ", "ឈ្មោះគណនី"],
      bank_account_no: ["bank_account_no", "account_no", "account_number", "លេខគណនីធនាគារ", "លេខគណនី"],
      branch_code: ["branch_code", "branch", "សាខា", "កូដសាខា"],
    };

    let importedCount = 0;
    for (const raw of rows) {
      const normRow: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (k) normRow[k.trim().toLowerCase()] = v ? String(v).trim() : "";
      }

      const mapped: any = {};
      for (const [field, aliases] of Object.entries(headerMap)) {
        for (const alias of aliases) {
          if (normRow[alias.toLowerCase()]) {
            mapped[field] = normRow[alias.toLowerCase()];
            break;
          }
        }
      }

      if (mapped.name_kh || mapped.name_latin || mapped.phone) {
        if (!mapped.name_kh) mapped.name_kh = mapped.name_latin || "";
        const idNorm = toLatinDigits(mapped.id_number || mapped.phone || "");
        const phoneNorm = toLatinDigits(mapped.phone || "");
        const agentCode = (mapped.agent_code || "").toUpperCase();

        const targetBranch = userBranch || (mapped.branch_code || "").toUpperCase();
        const agentRecord: any = {
          agent_code: agentCode,
          branch_code: targetBranch,
          name_kh: mapped.name_kh,
          name_latin: mapped.name_latin || "",
          id_number: mapped.id_number || "",
          id_number_norm: idNorm,
          phone: mapped.phone || "",
          phone_norm: phoneNorm,
          email: mapped.email || "",
          house_no: mapped.house_no || "",
          street: mapped.street || "",
          village: mapped.village || "",
          commune: mapped.commune || "",
          district: mapped.district || "",
          province: mapped.province || "",
          address_full: mapped.address_full || "",
          bank_name: mapped.bank_name || "eMoney",
          bank_account_name: mapped.bank_account_name || mapped.name_latin || "",
          bank_account_no: mapped.bank_account_no || "",
          updated_at: new Date().toISOString(),
        };

        let existing: any = null;
        if (agentCode) {
          const checkCode = await supabase.from("agents").select("id").eq("agent_code", agentCode).maybeSingle();
          existing = checkCode.data;
        }
        if (!existing && idNorm) {
          const checkId = await supabase.from("agents").select("id").eq("id_number_norm", idNorm).maybeSingle();
          existing = checkId.data;
        }

        if (existing) {
          await supabase.from("agents").update(agentRecord).eq("id", existing.id);
        } else {
          agentRecord.created_at = new Date().toISOString();
          await supabase.from("agents").insert(agentRecord);
        }
        importedCount++;
      }
    }

    let agentQuery = supabase.from("agents").select("*").order("id", { ascending: false });
    if (userBranch) {
      agentQuery = agentQuery.or(`branch_code.eq.${userBranch},agent_code.ilike.${userBranch}%`);
    }
    const { data: allAgents } = await agentQuery.limit(100);
    return NextResponse.json({ imported: importedCount, agents: allAgents || [] });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
