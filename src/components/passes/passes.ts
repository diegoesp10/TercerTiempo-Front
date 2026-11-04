/** Enlace para canjear un pase dentro de la app: /pase/CÓDIGO (pide entrar con una cuenta). */
export const passLink = (code: string) => `${window.location.origin}/pase/${code}`;

/** Céntimos a euros para un campo de texto: 1250 → «12,50», 0 → «0». */
export const centsToEuros = (cents: number) =>
  cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace('.', ',');

/** Lo que se escribe en un campo de precio («12», «12,5», «12.50») a céntimos; null si no es un importe válido. */
export function eurosToCents(text: string): number | null {
  const value = text.trim().replace(',', '.');
  if (value === '') return 0;
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(value)) return null;
  const cents = Math.round(Number(value) * 100);
  return cents <= 100_000 ? cents : null;
}
