import { NextRequest, NextResponse } from "next/server";
import {
  getOrInitAuthUsers,
  verifyPassword,
  signSession,
  resolveUserBranch,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const usernameInput = (body.username || "").trim();
    const password = String(body.password || "");

    if (!usernameInput || !password) {
      return NextResponse.json(
        { detail: "សូមបញ្ចូលឈ្មោះអ្នកប្រើប្រាស់ និង ពាក្យសម្ងាត់។" },
        { status: 400 }
      );
    }

    const users = await getOrInitAuthUsers();
    const matched = users.find(
      (u) => u.username.toLowerCase() === usernameInput.toLowerCase()
    );

    let sessionPayload: {
      username: string;
      displayName: string;
      role: "admin" | "staff";
      branchCode?: string | null;
    } | null = null;

    if (matched && verifyPassword(password, matched.passwordHash)) {
      const branchCode = await resolveUserBranch(matched);
      sessionPayload = {
        username: matched.username,
        displayName: matched.displayName || matched.username,
        role: matched.role || "admin",
        branchCode,
      };
    } else if (usernameInput.includes("@")) {
      // Fallback: also allow Supabase Auth email/password accounts if configured
      const { data, error } = await supabase.auth.signInWithPassword({
        email: usernameInput,
        password,
      });
      if (!error && data.user) {
        sessionPayload = {
          username: data.user.email || usernameInput,
          displayName: data.user.user_metadata?.full_name || data.user.email || usernameInput,
          role: "admin",
          branchCode: null,
        };
      }
    }

    if (!sessionPayload) {
      return NextResponse.json(
        { detail: "ឈ្មោះអ្នកប្រើប្រាស់ ឬ ពាក្យសម្ងាត់មិនត្រឹមត្រូវទេ។" },
        { status: 401 }
      );
    }

    const token = signSession(sessionPayload);
    const res = NextResponse.json({
      status: "ok",
      user: sessionPayload,
    });

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { detail: err?.message || "មានបញ្ហាក្នុងការចូលប្រព័ន្ធ" },
      { status: 500 }
    );
  }
}
