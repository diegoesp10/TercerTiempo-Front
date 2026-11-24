import type { ChoiceOption } from '@/components/ui/choice';
import type { SelectOption } from '@/components/ui/SearchSelect.vue';
import type { BodyRegion, BodySide, BodySiteAgreement, BodySiteDto, BodySiteKind, InjuryGrade, InjuryMechanism, InjuryTypeDto } from '@/types/api';

/** De la cabeza a los pies: los grupos de la lista de sitios. */
export const regionLabels: Record<BodyRegion, string> = {
  Head: 'Cabeza',
  Neck: 'Cuello',
  Shoulder: 'Hombro',
  Arm: 'Brazo',
  Elbow: 'Codo',
  Forearm: 'Antebrazo',
  Wrist: 'Muñeca',
  Hand: 'Mano',
  Chest: 'Tórax',
  Abdomen: 'Abdomen',
  Back: 'Espalda',
  Hip: 'Cadera y pelvis',
  Thigh: 'Muslo',
  Knee: 'Rodilla',
  Leg: 'Pierna',
  Ankle: 'Tobillo',
  Foot: 'Pie',
};

export const regionOrder = Object.keys(regionLabels) as BodyRegion[];

export const kindLabels: Record<BodySiteKind, string> = {
  Zone: 'Zona',
  Muscle: 'Músculo',
  Bone: 'Hueso',
  Tendon: 'Tendón',
  Ligament: 'Ligamento',
  Joint: 'Articulación',
  Cartilage: 'Cartílago',
};

export const kindOrder = Object.keys(kindLabels) as BodySiteKind[];

/** Lo que pregunta un tipo sin sitio fijo, y lo que falta si no se contesta. */
export const kindQuestions: Record<BodySiteKind, string> = {
  Zone: '¿En qué zona del cuerpo?',
  Muscle: '¿Qué músculo?',
  Bone: '¿Qué hueso?',
  Tendon: '¿Qué tendón?',
  Ligament: '¿Qué ligamento?',
  Joint: '¿Qué articulación?',
  Cartilage: '¿Qué menisco o cartílago?',
};

const kindMissing: Record<BodySiteKind, string> = {
  Zone: 'Elige en qué zona del cuerpo fue',
  Muscle: 'Elige el músculo (o su grupo)',
  Bone: 'Elige el hueso',
  Tendon: 'Elige el tendón',
  Ligament: 'Elige el ligamento',
  Joint: 'Elige la articulación',
  Cartilage: 'Elige el menisco o cartílago',
};

export const agreementLabels: Record<BodySiteAgreement, string> = {
  Masculine: 'Masculino («tobillo izquierdo»)',
  Feminine: 'Femenino («rodilla izquierda»)',
  MasculinePlural: 'Masculino plural («isquiotibiales izquierdos»)',
  FemininePlural: 'Femenino plural («costillas izquierdas»)',
};

export const gradeLabels: Record<InjuryGrade, string> = {
  I: 'Grado I · distensión',
  II: 'Grado II · rotura parcial',
  III: 'Grado III · rotura completa',
};

export const mechanismLabels: Record<InjuryMechanism, string> = {
  Contact: 'Con contacto',
  NonContact: 'Sin contacto',
  Overuse: 'Por sobrecarga',
};

/** Para los selectores en que también vale no saberlo. */
export type Unknown = 'Unknown';

export const gradeOptions: ChoiceOption<InjuryGrade | Unknown>[] = [
  { value: 'Unknown', label: 'No se sabe' },
  { value: 'I', label: 'I · distensión' },
  { value: 'II', label: 'II · rotura parcial' },
  { value: 'III', label: 'III · rotura completa' },
];

export const mechanismOptions: ChoiceOption<InjuryMechanism | Unknown>[] = [
  { value: 'Unknown', label: 'No se sabe' },
  { value: 'Contact', label: 'Con contacto' },
  { value: 'NonContact', label: 'Sin contacto' },
  { value: 'Overuse', label: 'Por sobrecarga' },
];

const feminine = (agreement: BodySiteAgreement) => agreement === 'Feminine' || agreement === 'FemininePlural';
const plural = (agreement: BodySiteAgreement) => agreement === 'MasculinePlural' || agreement === 'FemininePlural';
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const lower = (text: string) => text.charAt(0).toLocaleLowerCase('es-ES') + text.slice(1);

/** «izquierda», «derechos», «las dos»…: el lado concuerda con el sitio. */
export function sideWord(site: Pick<BodySiteDto, 'agreement'>, side: BodySide) {
  if (side === 'Both') return plural(site.agreement) ? 'los dos lados' : feminine(site.agreement) ? 'las dos' : 'los dos';
  return (side === 'Left' ? 'izquierd' : 'derech') + (feminine(site.agreement) ? 'a' : 'o') + (plural(site.agreement) ? 's' : '');
}

export const sideOptions = (site: BodySiteDto): ChoiceOption<BodySide>[] =>
  (['Left', 'Right', 'Both'] as const).map((side) => ({ value: side, label: capitalize(sideWord(site, side)) }));

/** «¿Qué rodilla?» si el sitio es una palabra; si no, «¿De qué lado?». */
export const sideQuestion = (site: BodySiteDto) =>
  !plural(site.agreement) && !site.label.includes(' ') ? `¿Qué ${lower(site.label)}?` : '¿De qué lado?';

export const sideMissing = (site: BodySiteDto) =>
  !plural(site.agreement) && !site.label.includes(' ') ? `Elige qué ${lower(site.label)}` : `Elige el lado (${lower(site.label)})`;

export const siteQuestion = (kind: BodySiteKind) => kindQuestions[kind];
export const siteMissing = (kind: BodySiteKind) => kindMissing[kind];

/** Un tipo sin sitio fijo vale para cualquier sitio de su clase (por zona, también las articulaciones). */
export const fitsKind = (asked: BodySiteKind, kind: BodySiteKind) => asked === kind || (asked === 'Zone' && kind === 'Joint');

/**
 * Lo que ofrece un tipo para elegir: con sitio fijo, lo que lo precisa; con clase, sus sitios o todos los de la clase. Los
 * retirados no salen, salvo el que ya tiene la lesión.
 */
export function offeredSites(type: InjuryTypeDto, sites: BodySiteDto[], current?: string | null): BodySiteDto[] {
  return sites.filter((s) => {
    if (type.baseSite && s.code === type.baseSite) return false;
    if (s.code === current) return true;
    if (!s.active) return false;
    if (type.baseSite) return type.sites.includes(s.code);
    if (!type.siteKind) return false;
    return type.sites.length > 0 ? type.sites.includes(s.code) : fitsKind(type.siteKind, s.kind);
  });
}

/** Para el desplegable: por zonas del cuerpo; un músculo dice su grupo (y se encuentra buscándolo) y un grupo, que lo es. */
export function siteSelectOptions(list: BodySiteDto[], all: BodySiteDto[]): SelectOption[] {
  const byCode = new Map(all.map((s) => [s.code, s]));
  const groups = new Set(all.filter((s) => s.parent).map((s) => s.parent as string));
  return list.map((s) => ({
    value: s.code,
    label: s.label,
    group: regionLabels[s.region],
    hint: !s.active
      ? 'ya no se ofrece para lesiones nuevas'
      : s.parent
        ? (byCode.get(s.parent)?.label ?? undefined)
        : groups.has(s.code)
          ? 'el grupo, si no se sabe cuál'
          : undefined,
  }));
}

/** «Grado II · rotura parcial · Sin contacto»: lo que se sabe de la lesión además del sitio; null si nada. */
export function injuryFacts(injury: { grade?: InjuryGrade | null; mechanism?: InjuryMechanism | null }) {
  const parts = [injury.grade ? gradeLabels[injury.grade] : null, injury.mechanism ? mechanismLabels[injury.mechanism] : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** «Esguince de tobillo (tobillo derecho)»: el tipo con dónde fue, si se sabe. */
export const injuryWithLocation = (injury: { typeLabel: string; location?: string | null }) =>
  injury.location ? `${injury.typeLabel} (${lower(injury.location)})` : injury.typeLabel;

/** «Rodilla izquierda», «Ligamento cruzado anterior (LCA), rodilla derecha»: como lo escribe la API. */
export function describeLocation(site: BodySiteDto | null, sideSite: BodySiteDto | null, side: BodySide | null) {
  if (!site) return null;
  const withSide = (s: BodySiteDto) => {
    if (!side || !s.paired) return s.label;
    const word = sideWord(s, side);
    const open = s.label.endsWith(')') ? s.label.lastIndexOf(' (') : -1;
    if (side === 'Both') return open > 0 ? `${s.label}, ${word}` : `${s.label} (${word})`;
    return open > 0 ? `${s.label.slice(0, open)} ${word}${s.label.slice(open)}` : `${s.label} ${word}`;
  };
  if (!sideSite || sideSite.code === site.code) return withSide(site);
  return `${site.label}, ${lower(withSide(sideSite))}`;
}
