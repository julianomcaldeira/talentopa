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

export const PHONE_ERROR_MESSAGES = {
  REQUIRED: "O telefone é obrigatório.",
  INVALID_FORMAT: "Formato de telefone inválido. Use o formato (99) 99999-9999.",
  TOO_SHORT: (min: number) => `O telefone precisa ter pelo menos ${min} dígitos.`,
};

export const PHONE_TOAST_TITLE = "Telefone inválido";

export function getPhoneErrorToast(error?: string) {
  return {
    title: PHONE_TOAST_TITLE,
    description: error || PHONE_ERROR_MESSAGES.INVALID_FORMAT,
    variant: "destructive" as const,
  };
}

export function validatePhone(phone: string, required = false): { valid: boolean; error?: string } {
  const trimmed = phone.trim();
  if (!trimmed) {
    if (required) return { valid: false, error: PHONE_ERROR_MESSAGES.REQUIRED };
    return { valid: true };
  }
  const digits = unmask(trimmed);
  if (digits.length > 11) {
    return { valid: false, error: PHONE_ERROR_MESSAGES.INVALID_FORMAT };
  }
  const expectedPattern = digits.length <= 10
    ? /^\(\d{2}\) \d{4}-\d{4}$/
    : /^\(\d{2}\) \d{5}-\d{4}$/;
  if (!expectedPattern.test(trimmed)) {
    return { valid: false, error: PHONE_ERROR_MESSAGES.INVALID_FORMAT };
  }
  if (digits.length < MIN_PHONE_DIGITS) {
    return { valid: false, error: PHONE_ERROR_MESSAGES.TOO_SHORT(MIN_PHONE_DIGITS) };
  }
  return { valid: true };
}

export function normalizePhone(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  const digits = unmask(trimmed);
  return digits.length >= MIN_PHONE_DIGITS ? trimmed : null;
}
