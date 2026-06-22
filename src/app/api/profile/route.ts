import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// Clears the must_change_password flag for the calling user. Called after a
// successful supabase.auth.updateUser({ password }) on the client — that call
// already proves the caller is authenticated, so this just unblocks the
// forced-password-change redirect in AppShell.
export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as { must_change_password?: boolean } | null;
  if (!body || body.must_change_password !== false) {
    return bad("must_change_password=false is required");
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return bad("Not authenticated", 401);

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ must_change_password: false })
    .eq("id", authUser.id);

  if (error) return bad(error.message, 400);

  return NextResponse.json({ ok: true });
}
