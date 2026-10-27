import type { BillingInterval, ClubLicenseDto, LicensePriceDto, LicensingCatalogDto } from '@/types/api';

/**
 * Textos y cálculos de las licencias. La licencia de club cubre el primer equipo y todos sus filiales con todas las
 * funciones para el club, que hace lo mismo que su cuerpo técnico. Los técnicos con cuenta van aparte: cada licencia de
 * técnico es una plaza de la bolsa del club, que la reparte entre sus equipos. Los precios vienen de la API.
 */
export const clubFeatures = [
  'Primer equipo y todos sus filiales con una sola licencia',
  'El club trabaja como su cuerpo técnico: actas internas, datos del equipo, lesiones y vídeos',
  'Previa de cada partido y comparador de jugadores',
  'Plantilla entera, sin límite de jugadores, con cuentas para ellos',
  'Acta en papel para imprimir',
];

export const staffFeatures = [
  'Cada técnico con su propia cuenta y su acceso',
  'Para cualquier equipo del club: la bolsa se reparte como quieras',
  'Entrenador, segundo, delegado, fisio, analista…',
  'Añade técnicos cuando quieras: se cobra la parte que queda del periodo',
];

export const priceOf = (price: LicensePriceDto, interval: BillingInterval) =>
  interval === 'Yearly' ? price.yearlyPriceCents : price.monthlyPriceCents;

/** Lo que cuesta cada periodo: la licencia de club más sus técnicos. */
export const subscriptionPrice = (catalog: LicensingCatalogDto, interval: BillingInterval, staffSeats: number) =>
  priceOf(catalog.club, interval) + staffSeats * priceOf(catalog.staffSeat, interval);

/** Meses que regala el pago anual frente a pagar doce mensualidades (redondeado). */
export const freeMonths = (price: LicensePriceDto) =>
  price.monthlyPriceCents > 0 ? Math.round((price.monthlyPriceCents * 12 - price.yearlyPriceCents) / price.monthlyPriceCents) : 0;

/** «Club» o «Club + 3 técnicos». */
export const subscriptionLabel = (staffSeats: number) =>
  staffSeats > 0 ? `Club + ${staffSeats === 1 ? '1 técnico' : `${staffSeats} técnicos`}` : 'Solo club';

/** Suscripción en marcha: se renueva sola y el club tiene acceso. */
export const isSubscribed = (license: ClubLicenseDto) => license.autoRenew && license.contracted && license.status !== 'Expired';

/** Mientras queda prueba o periodo pagado, contratar no cobra nada hoy: el primer cobro llega al día siguiente. */
export const firstChargeOn = (license: Pick<ClubLicenseDto, 'status' | 'validUntil'>) => {
  if (license.status === 'Expired') return new Date().toISOString().slice(0, 10);
  const next = new Date(`${license.validUntil}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
};

/**
 * Parte proporcional de los técnicos añadidos hasta el final del periodo pagado, contando hoy (la misma cuenta que hace
 * la API). Durante la prueba no se cobra nada: entran en el primer cobro.
 */
export const staffSeatsProration = (license: ClubLicenseDto, added: number, seatPriceCents: number) => {
  if (added <= 0 || !license.paidUntil || !license.interval) return 0;
  const day = 86_400_000;
  const paid = Date.parse(`${license.paidUntil}T00:00:00Z`);
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  if (paid < today) return 0;
  const start = new Date(paid);
  start.setUTCMonth(start.getUTCMonth() - (license.interval === 'Yearly' ? 12 : 1));
  const periodDays = Math.round((paid - start.getTime()) / day);
  const remaining = Math.min(Math.round((paid - today) / day) + 1, periodDays);
  return Math.round((added * seatPriceCents * remaining) / periodDays);
};
