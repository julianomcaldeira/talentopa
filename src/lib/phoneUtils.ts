export const maskPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
};

export const unmask = (value: string): string => value.replace(/\D/g, "");

export const MIN_PHONE_DIGITS = 10;
export const PHONE_MASKED_MAX_LENGTH = 15;
export const PHONE_PLACEHOLDER = "(99) 99999-9999";

export function validatePhone(phone: string): { valid: boolean; error?: string } {
  const digits = unmask(phone);
  if (digits.length === 0) return { valid: true };
  if (digits.length < MIN_PHONE_DIGITS) {
    return { valid: false, error: `O telefone precisa ter pelo menos ${MIN_PHONE_DIGITS} dígitos.` };
  }
  return { valid: true };
}

export function normalizePhone(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  const digits = unmask(trimmed);
  return digits.length >= MIN_PHONE_DIGITS ? trimmed : null;
}
