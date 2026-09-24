// US phone numbers. Stored in E.164 form (+17655550123), which is what Twilio
// expects, and shown as (765) 555-0123.

// Accepts any common way of typing a US number: "765-555-0123",
// "(765) 555 0123", "+1 765 555 0123". Returns null if it isn't one.
export function normalizeUsPhone(input: string) {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  // US area codes and exchanges never start with 0 or 1.
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return null;
  return `+1${digits}`;
}

export function formatPhone(phone: string | null) {
  const match = phone?.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (!match) return phone ?? "";
  return `(${match[1]}) ${match[2]}-${match[3]}`;
}
