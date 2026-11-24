import type { InjuryOccasionDto, InjuryProposalDto } from '@/types/api';
import { formatDate } from '@/utils/format';

type Occasion = Pick<InjuryOccasionDto, 'kind' | 'label' | 'day'>;

/** «en el partido J11 · Local – Visitante (22 nov 2026)» o «en el entrenamiento «Táctico» (20 nov 2026)». */
export const occasionPlace = (o: Occasion) =>
  o.kind === 'Match' ? `en el partido ${o.label} (${formatDate(o.day)})` : `en el entrenamiento «${o.label}» (${formatDate(o.day)})`;

export const occasionIcon = (o: Pick<InjuryOccasionDto, 'kind'>) => (o.kind === 'Match' ? 'futbol' : 'dumbbell');

/** El partido de una posible lesión de la crónica, como el sitio donde se lesionó. */
export const proposalOccasion = (p: InjuryProposalDto): InjuryOccasionDto => ({
  kind: 'Match',
  id: p.matchId,
  day: p.matchDate,
  label: `J${p.matchday} · ${p.homeTeam} – ${p.awayTeam}`,
});
