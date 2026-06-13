import "server-only";

const TELEGRAM_API = "https://api.telegram.org";

function botToken(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return token ? token : null;
}

export async function sendTelegramMessage(chatId: number | string, text: string): Promise<void> {
  const token = botToken();
  if (!token) return;

  await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  }).catch(() => {
    // Best-effort notification — failures shouldn't break the workflow.
  });
}

export async function sendTelegramContactRequest(chatId: number | string, text: string): Promise<void> {
  const token = botToken();
  if (!token) return;

  await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        keyboard: [[{ text: "Telefon raqamni ulashish", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }),
  }).catch(() => {});
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("998") && digits.length === 12) return `+${digits}`;
  if (digits.length === 9) return `+998${digits}`;
  return digits.startsWith("+") ? digits : `+${digits}`;
}
