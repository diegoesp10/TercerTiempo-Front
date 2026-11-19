import type { SquadAgendaItemDto, UnavailablePlayerDto } from '@/types/api';

// Quién no puede jugar un partido que está por jugar: los sancionados y los lesionados.
export const unavailableOf = (item: SquadAgendaItemDto): UnavailablePlayerDto[] =>
  item.kind === 'Match' && !item.done ? (item.unavailable ?? []) : [];

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

// «sancionado: roja directa en la jornada 8», «lesionado: esguince de tobillo» o solo «lesionado».
export const unavailableReason = (player: UnavailablePlayerDto) =>
  player.kind === 'Suspended' ? `sancionado: ${lowerFirst(player.reason)}` : lowerFirst(player.reason);

export const unavailableSummary = (list: UnavailablePlayerDto[]) =>
  list.length ? `No disponibles: ${list.map((p) => `${p.playerName} (${unavailableReason(p)})`).join(', ')}` : '';
