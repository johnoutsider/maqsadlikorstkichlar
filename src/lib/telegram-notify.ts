import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/telegram";
import { createNotifications } from "@/lib/notifications";

// Notify every user with the given role(s) in a university — both via the
// in-app notification bell and, if their phone is linked, Telegram.
export async function notifyRolesByTelegram(
  admin: SupabaseClient,
  args: {
    universityId: string;
    roles: string[];
    departmentId?: string | null;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }
): Promise<void> {
  let query = admin
    .from("users")
    .select("id, phone, roles!inner(name)")
    .eq("university_id", args.universityId)
    .in("roles.name", args.roles);

  if (args.departmentId) {
    query = query.eq("department_id", args.departmentId);
  }

  const { data: recipients } = await query;
  const list = (recipients ?? []) as Array<{ id: string; phone: string | null }>;

  await createNotifications(
    admin,
    list.map((r) => ({
      university_id: args.universityId,
      recipient_id: r.id,
      type: args.type,
      title: args.title,
      message: args.message,
      data: args.data,
    }))
  );

  const phones = list.map((r) => r.phone).filter((p): p is string => !!p);
  if (phones.length === 0) return;

  const { data: contacts } = await admin
    .from("telegram_contacts")
    .select("phone, chat_id")
    .in("phone", phones);

  for (const contact of contacts ?? []) {
    await sendTelegramMessage(contact.chat_id, `<b>${args.title}</b>\n${args.message}`);
  }
}

// Notify the applicant on their linked Telegram chat (status updates).
export async function notifyApplicant(
  applicantChatId: number | null,
  message: string
): Promise<void> {
  if (!applicantChatId) return;
  await sendTelegramMessage(applicantChatId, message);
}
