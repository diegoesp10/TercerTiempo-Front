import { textOnColor } from '@/charts/theme';
import type { LeagueZoneDto } from '@/types/api';

/** Un tramo de puestos seguidos con la misma plaza: «Promoción de ascenso, 2.º–5.º». */
export interface ZoneRange {
  label: string;
  color: string;
  from: number;
  to: number;
}

/** Las plazas de una liga agrupadas en tramos de puestos seguidos, para la leyenda. */
export function zoneRanges(places: LeagueZoneDto[] | null | undefined): ZoneRange[] {
  const ranges: ZoneRange[] = [];
  for (const place of [...(places ?? [])].sort((a, b) => a.position - b.position)) {
    const last = ranges.at(-1);
    if (last && last.label === place.label && last.to === place.position - 1) last.to = place.position;
    else ranges.push({ label: place.label, color: place.color, from: place.position, to: place.position });
  }
  return ranges;
}

export const rangeText = (range: ZoneRange) => (range.from === range.to ? `${range.from}.º` : `${range.from}.º–${range.to}.º`);

/** Estilo de la casilla del puesto con el color de su plaza (texto blanco o negro según el fondo). */
export function zoneStyle(places: LeagueZoneDto[] | null | undefined, position: number): Record<string, string> | undefined {
  const place = places?.find((p) => p.position === position);
  return place ? { backgroundColor: place.color, color: textOnColor(place.color) } : undefined;
}
