import type { SelectOption } from '@/components/ui/SearchSelect.vue';
import { MY_CLUB_GROUP } from '@/composables/useMyClub';
import type { CompetitionDto, TerritoryDto } from '@/types/api';
import { levelOrder } from '@/utils/format';

/** Los ámbitos de una lista de ligas o categorías, sin repetir: Nacional primero y después las comunidades por nombre. */
export function territoriesOf<T extends { territory: TerritoryDto }>(items: readonly T[]): TerritoryDto[] {
  const byId = new Map<string, TerritoryDto>();
  for (const item of items) if (!byId.has(item.territory.id)) byId.set(item.territory.id, item.territory);
  return [...byId.values()].sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name, 'es') : a.kind === 'National' ? -1 : 1,
  );
}

/** Opciones del buscador de ámbitos, con cuántas ligas (o categorías) tiene cada uno. */
export function territoryOptions<T extends { territory: TerritoryDto }>(items: readonly T[], noun: [string, string]): SelectOption[] {
  return territoriesOf(items).map((territory) => {
    const count = items.filter((item) => item.territory.id === territory.id).length;
    return { value: territory.id, label: territory.name, hint: `${count} ${count === 1 ? noun[0] : noun[1]}` };
  });
}

/**
 * Las ligas que se enseñan (sin fútbol base), ordenadas por ámbito (Nacional primero), nivel y grupo, como opciones del
 * buscador: agrupadas por su ámbito y con sus equipos al lado.
 */
export function competitionOptions(competitions: readonly CompetitionDto[]): (SelectOption & { value: string })[] {
  const territories = territoriesOf(competitions).map((t) => t.id);
  return competitions
    .filter((c) => levelOrder.includes(c.level))
    .sort((a, b) =>
      territories.indexOf(a.territory.id) - territories.indexOf(b.territory.id)
      || levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level)
      || a.sortOrder - b.sortOrder)
    .map((c) => ({ value: c.id, label: c.name, hint: c.teamsCount > 0 ? `${c.teamsCount} equipos` : undefined, group: c.territory.name }));
}

/**
 * Opciones de un solo ámbito (el elegido en su buscador): el título del ámbito sobra, salvo para separarlas de las de tu
 * club, que van primero.
 */
export function withinTerritory<T extends SelectOption>(options: readonly T[]): T[] {
  return options.some((o) => o.group === MY_CLUB_GROUP) ? [...options] : options.map((o) => ({ ...o, group: undefined }));
}
