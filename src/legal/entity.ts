/**
 * Datos del titular de Tercer Tiempo que aparecen en la política de privacidad y en las condiciones de uso.
 * Los valores entre corchetes son marcadores: hay que rellenarlos con los datos reales (sociedad o persona física,
 * NIF, domicilio y correos) antes de abrir el servicio al público.
 */
export const legalEntity = {
  name: '[Nombre o razón social del titular]',
  nif: '[NIF]',
  address: '[Domicilio completo]',
  /** Correo de contacto general y para el ejercicio de derechos. */
  email: 'privacidad@tercertiempo.es',
  /** Proveedor de alojamiento (encargado del tratamiento). */
  hosting: '[Proveedor de alojamiento, p. ej. Hetzner Online GmbH (Alemania)]',
  /** Pasarela de pago de los vídeos (encargado del tratamiento). */
  payments: '[Pasarela de pago, p. ej. Stripe Payments Europe, Ltd.]',
};

/** Fecha de la última versión de los textos legales. */
export const legalVersion = '21 de octubre de 2026';

/** Fuentes públicas de datos deportivos que usa la plataforma, con atribución. */
export const dataSources = [
  { name: 'futbolasturiano.es', url: 'https://www.futbolasturiano.es', what: 'calendarios, resultados, clasificaciones y plantillas publicadas de las ligas asturianas' },
  { name: 'asturfutbol.es (Real Federación de Fútbol del Principado de Asturias)', url: 'https://www.asturfutbol.es', what: 'actas oficiales de los partidos: alineaciones, sustituciones, goles, tarjetas y árbitros' },
  { name: 'BeSoccer', url: 'https://es.besoccer.com', what: 'actas públicas de los partidos cuando la federación no las tiene o limita las consultas: alineaciones, cambios, goles y tarjetas' },
];
