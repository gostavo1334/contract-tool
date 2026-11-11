import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase.from("contracts").select("*").order("id", { ascending: false }).limit(100);
  if (error) {
    return NextResponse.json({ detail: error.message }, { status: 400 });
  }
  return NextResponse.json(data || []);
}
