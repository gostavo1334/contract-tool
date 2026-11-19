import { supabase } from "@/lib/supabase";
import { type Branch, type Agent, type ContractRecord, type Settings, agentBranchCode } from "@/lib/shared";
import { getSessionUser, resolveUserBranch } from "@/lib/auth";
import fs from "fs";
import path from "path";

export async function getInitData() {
  const sessionUser = await getSessionUser();
  const userBranch = sessionUser ? await resolveUserBranch(sessionUser) : null;

  let contractsQuery = supabase.from("contracts").select("*").order("id", { ascending: false });
  let agentsQuery = supabase.from("agents").select("*").order("id", { ascending: false });

  if (userBranch) {
    contractsQuery = contractsQuery.eq("branch_code", userBranch);
    agentsQuery = agentsQuery.or(`branch_code.eq.${userBranch},agent_code.ilike.${userBranch}%`);
  }

  const [branchesRes, settingsRes, contractsRes, agentsRes] = await Promise.all([
    supabase.from("branches").select("*").order("code", { ascending: true }),
    supabase.from("settings").select("*"),
    sessionUser ? contractsQuery.limit(50) : Promise.resolve({ data: [] }),
    sessionUser ? agentsQuery.limit(1000) : Promise.resolve({ data: [] }),
  ]);

  // Load tag reference
  let tagReference = { new_template: [], old_template: [] };
  try {
    const tagPath = path.join(process.cwd(), "templates", "tag_reference.json");
    if (fs.existsSync(tagPath)) {
      tagReference = JSON.parse(fs.readFileSync(tagPath, "utf-8"));
    }
  } catch (e) {
    console.error("Error reading tag_reference.json:", e);
  }

  // Calculate next_contract_no for each branch
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
    const next_contract_no = `${code}${String(nextNum).padStart(3, "0")}`;
    return {
      ...b,
      next_contract_no,
    } as Branch;
  });

  const settingsMap: Record<string, any> = {};
  for (const s of settingsRes.data || []) {
    settingsMap[s.key] = s.value;
  }
  const settings: Settings = {
    new_digit_style: settingsMap.new_digit_style || "khmer",
    old_digit_style: settingsMap.old_digit_style || "latin",
  };

  const today = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Phnom_Penh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());

  let visibleBranches = branches;
  if (userBranch) {
    visibleBranches = branches.filter((b) => b.code.toUpperCase() === userBranch);
    if (visibleBranches.length === 0) {
      visibleBranches = branches;
    }
  }

  const effectiveUser = sessionUser
    ? {
        ...sessionUser,
        branchCode: userBranch,
      }
    : null;

  return {
    today,
    branches: visibleBranches,
    settings,
    tag_reference: tagReference,
    recent_contracts: sessionUser ? contracts : [],
    agents: sessionUser ? ((agentsRes.data || []) as Agent[]) : [],
    agents_count: sessionUser ? (agentsRes.data || []).length : 0,
    current_user: effectiveUser,
  };
}
