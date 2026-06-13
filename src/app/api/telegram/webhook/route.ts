import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, sendTelegramMessage, sendTelegramContactRequest } from "@/lib/telegram";

interface TelegramContact {
  phone_number: string;
  user_id?: number;
}

interface TelegramMessage {
  chat: { id: number };
  text?: string;
  contact?: TelegramContact;
}

interface TelegramUpdate {
  message?: TelegramMessage;
}

export async function POST(req: NextRequest) {
  const update = (await req.json()) as TelegramUpdate;
  const message = update.message;
  if (!message) return NextResponse.json({ ok: true });

  const chatId = message.chat.id;
  const admin = createAdminClient();

  if (message.contact?.phone_number) {
    const phone = normalizePhone(message.contact.phone_number);

    await admin
      .from("telegram_contacts")
      .upsert({ phone, chat_id: chatId }, { onConflict: "phone" });

    const { data: user } = await admin
      .from("users")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (user) {
      await admin
        .from("telegram_contacts")
        .update({ linked_user_id: user.id })
        .eq("phone", phone);
    }

    const { data: applications } = await admin
      .from("defense_applications")
      .select("id")
      .eq("applicant_phone", phone)
      .eq("phone_verified", false);

    if (applications && applications.length > 0) {
      await admin
        .from("defense_applications")
        .update({ phone_verified: true, applicant_chat_id: chatId })
        .eq("applicant_phone", phone)
        .eq("phone_verified", false);
    }

    await sendTelegramMessage(chatId, "Telefon raqamingiz tasdiqlandi. Endi arizani saytda davom ettirishingiz mumkin.");
    return NextResponse.json({ ok: true });
  }

  if (message.text?.startsWith("/start")) {
    const parts = message.text.trim().split(/\s+/);
    const token = parts[1];

    if (token) {
      const { data: application } = await admin
        .from("defense_applications")
        .select("id, phone_verified")
        .eq("id", token)
        .maybeSingle();

      if (application) {
        if (!application.phone_verified) {
          await admin
            .from("defense_applications")
            .update({ applicant_chat_id: chatId })
            .eq("id", token);
        }
        await sendTelegramContactRequest(
          chatId,
          "Salom! Himoya arizangizni tasdiqlash uchun telefon raqamingizni ulashing."
        );
        return NextResponse.json({ ok: true });
      }
    }

    await sendTelegramContactRequest(chatId, "Salom! Davom etish uchun telefon raqamingizni ulashing.");
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
