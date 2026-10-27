/**
 * Requisitos de las contraseñas, los mismos que aplica la API (PasswordPolicy + PasswordRulesValidator) para avisar
 * mientras se escribe. La API manda: además rechaza las contraseñas demasiado fáciles de adivinar («Futbol2026!»).
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
const MIN_UNIQUE_CHARS = 5;

export interface PasswordCheck {
  label: string;
  ok: boolean;
}

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** El usuario del email y sus trozos de cuatro letras o más («diego.espina» → diego, espina). */
function emailPieces(email: string | null | undefined): string[] {
  const local = fold(email?.split('@')[0] ?? '');
  if (local.length < 4) return [];
  return [local, ...local.split(/[._+-]/).filter((piece) => piece.length >= 4 && piece !== local)];
}

export function passwordChecks(password: string, email?: string | null): PasswordCheck[] {
  const checks: PasswordCheck[] = [
    { label: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`, ok: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH },
    { label: 'Una mayúscula y una minúscula', ok: /\p{Lu}/u.test(password) && /\p{Ll}/u.test(password) },
    { label: 'Un número', ok: /\d/.test(password) },
    { label: 'Un símbolo (por ejemplo - . # ! ?)', ok: /[^\p{L}\p{N}]/u.test(password) },
    { label: `${MIN_UNIQUE_CHARS} caracteres distintos y ninguno repetido 4 veces seguidas`, ok: new Set(password).size >= MIN_UNIQUE_CHARS && !/(.)\1{3,}/.test(password) },
  ];
  const pieces = emailPieces(email);
  if (pieces.length) checks.push({ label: 'Sin tu email', ok: password.length > 0 && !pieces.some((piece) => fold(password).includes(piece)) });
  return checks;
}

export const passwordLooksValid = (password: string, email?: string | null) => passwordChecks(password, email).every((check) => check.ok);

/** Email de la sesión, sacado del token (la cuenta no lo trae). */
export function tokenEmail(token: string | null): string | null {
  try {
    const payload = token?.split('.')[1];
    if (!payload) return null;
    const bytes = Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const json = JSON.parse(new TextDecoder().decode(bytes));
    return typeof json.email === 'string' ? json.email : null;
  } catch {
    return null;
  }
}
