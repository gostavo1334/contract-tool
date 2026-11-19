import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSessionUser, resolveUserBranch } from "@/lib/auth";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  const userBranch = await resolveUserBranch(session);

  let query = supabase.from("contracts").select("*").order("id", { ascending: false });
  if (userBranch) {
    query = query.eq("branch_code", userBranch);
  }
  const { data, error } = await query.limit(100);
  if (error) {
    return NextResponse.json({ detail: error.message }, { status: 400 });
  }
  return NextResponse.json(data || []);
}
