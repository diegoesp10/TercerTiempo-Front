// Perfil por 90' calculado en el cliente a partir de los totales (mismas reglas que la API).
import type { IndividualStatsDto, PlayerAxesDto, TeamImpactDto } from '@/types/api';

export const MIN_MINUTES_FOR_REFERENCE = 90;

const round2 = (value: number) => Math.round(value * 100) / 100;

export function axesFromStats(stats: IndividualStatsDto, impact: TeamImpactDto): PlayerAxesDto {
  const per90 = (value: number) => (stats.minutes > 0 ? round2((value * 90) / stats.minutes) : 0);
  return {
    goalsPer90: per90(stats.goals),
    assistsPer90: per90(stats.assists),
    shotsOnTargetPer90: per90(stats.shotsOnTarget),
    keyPassesPer90: per90(stats.keyPasses),
    tacklesPer90: per90(stats.tackles),
    interceptionsPer90: per90(stats.interceptions),
    savesPer90: per90(stats.saves),
    averageRating: stats.averageRating,
    participationPct: impact.participationPct,
  };
}

type NumericKey = Exclude<keyof PlayerAxesDto, 'averageRating'>;
const numericKeys: NumericKey[] = [
  'goalsPer90', 'assistsPer90', 'shotsOnTargetPer90', 'keyPassesPer90', 'tacklesPer90', 'interceptionsPer90', 'savesPer90', 'participationPct',
];

function combine(list: PlayerAxesDto[], fn: (values: number[]) => number): PlayerAxesDto {
  const result = {} as PlayerAxesDto;
  for (const key of numericKeys) result[key] = list.length ? round2(fn(list.map((a) => a[key]))) : 0;
  const ratings = list.map((a) => a.averageRating).filter((r): r is number => r !== null);
  result.averageRating = ratings.length ? round2(fn(ratings)) : null;
  return result;
}

export const averageAxes = (list: PlayerAxesDto[]) => combine(list, (v) => v.reduce((a, b) => a + b, 0) / v.length);
export const maxAxes = (list: PlayerAxesDto[]) => combine(list, (v) => Math.max(...v));
