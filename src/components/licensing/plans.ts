import type { BillingInterval, LicensePlan, LicensePlanDto, ClubLicenseDto } from '@/types/api';

/**
 * Textos de los planes. La licencia es del club (primer equipo y filiales, un solo precio) y los dos planes dan las
 * mismas funciones a todos sus equipos; lo que cambia es el cuerpo técnico que puede tener cada equipo. Los precios y
 * el número de técnicos vienen de la API (configuración del backend).
 */
export const planCopy: Record<LicensePlan, { tagline: string; staffNote: string; extras: string[] }> = {
  Basic: {
    tagline: 'Para el entrenador y su plantilla',
    staffNote: 'El entrenador, con su cuenta',
    extras: [],
  },
  Premium: {
    tagline: 'Para un cuerpo técnico completo',
    staffNote: 'Segundo entrenador, delegado, fisio, analista…',
    extras: ['Cada técnico con su cuenta y su acceso', 'Reparte el acta y el seguimiento entre el cuerpo técnico'],
  },
};

/** Lo que incluyen los dos planes. */
export const sharedFeatures = [
  'Primer equipo y todos sus filiales con una sola licencia',
  'Plantilla entera, sin límite de jugadores',
  'Acta interna con estadísticas por jugador',
  'Previa de cada partido y comparador de jugadores',
  'Lesiones y vídeos del equipo',
  'Cuentas para tus jugadores',
  'Acta en papel para imprimir',
];

/** Filas de la comparativa: [concepto, Básica, Premium] (true/false = incluido o no). */
export const comparisonRows = (basic: LicensePlanDto, premium: LicensePlanDto): [string, string | boolean, string | boolean][] => [
  ['Primer equipo y filiales', true, true],
  ['Técnicos con cuenta en cada equipo', String(basic.maxStaff), `Hasta ${premium.maxStaff}`],
  ['Jugadores en la plantilla', 'Sin límite', 'Sin límite'],
  ['Acta interna y estadísticas', true, true],
  ['Previa de partidos y comparador', true, true],
  ['Lesiones y vídeos', true, true],
  ['Acta en papel (PDF)', true, true],
  ['Segundo entrenador, delegado, fisio y analista', false, true],
];

/** Meses que regala el pago anual frente a pagar doce mensualidades (redondeado). */
export const freeMonths = (plan: LicensePlanDto) =>
  plan.monthlyPriceCents > 0 ? Math.round((plan.monthlyPriceCents * 12 - plan.yearlyPriceCents) / plan.monthlyPriceCents) : 0;

export const priceOf = (plan: LicensePlanDto, interval: BillingInterval) =>
  interval === 'Yearly' ? plan.yearlyPriceCents : plan.monthlyPriceCents;

/** Suscripción en marcha: se renueva sola y el club tiene acceso. */
export const isSubscribed = (license: ClubLicenseDto) => license.autoRenew && license.plan !== null && license.status !== 'Expired';

/** Mientras queda prueba o periodo pagado, contratar no cobra nada hoy: el primer cobro llega al día siguiente. */
export const firstChargeOn = (license: Pick<ClubLicenseDto, 'status' | 'validUntil'>) => {
  if (license.status === 'Expired') return new Date().toISOString().slice(0, 10);
  const next = new Date(`${license.validUntil}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
};
