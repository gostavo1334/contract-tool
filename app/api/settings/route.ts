import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSessionUser, resolveUserBranch } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  const userBranch = await resolveUserBranch(session);
  if (userBranch) {
    return NextResponse.json({ detail: "Forbidden: Admin access only" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const updates = [];
    if (body.new_digit_style) {
      updates.push(supabase.from("settings").upsert({ key: "new_digit_style", value: body.new_digit_style }));
    }
    if (body.old_digit_style) {
      updates.push(supabase.from("settings").upsert({ key: "old_digit_style", value: body.old_digit_style }));
    }
    await Promise.all(updates);
    const { data } = await supabase.from("settings").select("*");
    const map: Record<string, string> = {};
    for (const r of data || []) {
      map[r.key] = r.value;
    }
    return NextResponse.json(map);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 400 });
  }
}
