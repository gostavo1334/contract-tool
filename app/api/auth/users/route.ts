import { NextRequest, NextResponse } from "next/server";
import {
  getSessionUser,
  getOrInitAuthUsers,
  saveAuthUsers,
  hashPassword,
} from "@/lib/auth";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  const users = await getOrInitAuthUsers();
  return NextResponse.json({
    users: users.map((u) => ({
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      createdAt: u.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const username = (body.username || "").trim();
    const displayName = (body.displayName || username).trim();
    const password = String(body.password || "");
    const role = body.role === "staff" ? "staff" : "admin";

    if (!username || !password || password.length < 4) {
      return NextResponse.json(
        { detail: "សូមបញ្ចូលឈ្មោះអ្នកប្រើប្រាស់ និង ពាក្យសម្ងាត់ (យ៉ាងតិច ៤ តួអក្សរ)។" },
        { status: 400 }
      );
    }

    const users = await getOrInitAuthUsers();
    const idx = users.findIndex(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    );

    if (idx >= 0) {
      users[idx] = {
        ...users[idx],
        displayName,
        role,
        passwordHash: hashPassword(password),
      };
    } else {
      users.push({
        username,
        displayName,
        role,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
      });
    }

    await saveAuthUsers(users);
    return NextResponse.json({
      status: "ok",
      users: users.map((u) => ({
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        createdAt: u.createdAt,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const username = (searchParams.get("username") || "").trim();
  if (!username) {
    return NextResponse.json({ detail: "Missing username" }, { status: 400 });
  }
  if (username.toLowerCase() === session.username.toLowerCase()) {
    return NextResponse.json(
      { detail: "មិនអាចលុបគណនីដែលកំពុងប្រើប្រាស់បានទេ។" },
      { status: 400 }
    );
  }

  const users = await getOrInitAuthUsers();
  const filtered = users.filter(
    (u) => u.username.toLowerCase() !== username.toLowerCase()
  );
  if (filtered.length === 0) {
    return NextResponse.json(
      { detail: "ត្រូវមានគណនីយ៉ាងតិច ១ នៅក្នុងប្រព័ន្ធ។" },
      { status: 400 }
    );
  }

  await saveAuthUsers(filtered);
  return NextResponse.json({
    status: "ok",
    users: filtered.map((u) => ({
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      createdAt: u.createdAt,
    })),
  });
}
