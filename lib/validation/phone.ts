export const PHONE_ERROR = "Enter a valid phone number with country code, such as +91 98765 43210.";

export function normalizePhoneNumber(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /[^+\d\s().-]/.test(trimmed)) return "";
  const normalized = trimmed.replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : "";
}

export function isValidPhoneNumber(value: string): boolean {
  const normalized = normalizePhoneNumber(value);
  if (!normalized) return false;
  const digits = normalized.slice(1);
  const national = (callingCode: string) => digits.slice(callingCode.length);

  if (digits.startsWith("91")) return /^[6-9]\d{9}$/.test(national("91"));
  if (digits.startsWith("1")) return /^[2-9]\d{2}[2-9]\d{6}$/.test(national("1"));
  if (digits.startsWith("44")) return /^\d{9,10}$/.test(national("44"));
  if (digits.startsWith("61")) return /^\d{9}$/.test(national("61"));
  if (digits.startsWith("65")) return /^[6-9]\d{7}$/.test(national("65"));
  if (digits.startsWith("971")) return /^\d{9}$/.test(national("971"));
  if (digits.startsWith("64")) return /^\d{8,10}$/.test(national("64"));
  if (digits.startsWith("33")) return /^\d{9}$/.test(national("33"));
  if (digits.startsWith("49")) return /^\d{7,13}$/.test(national("49"));
  if (digits.startsWith("81")) return /^\d{9,10}$/.test(national("81"));
  if (digits.startsWith("55")) return /^\d{10,11}$/.test(national("55"));
  return digits.length >= 8 && digits.length <= 15;
}
