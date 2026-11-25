import type { VideoAnalysisPartDto, VideoAnalysisPlayerDto } from '@/types/api';

// Desde Ojeador 2.1.2 cada acción de la propuesta llega con el segundo del vídeo en que pasó. Aquí se convierten en las
// líneas que se ven en «Ver en el vídeo»: una por acción, con los filtros en los que sale. Lo que el analizador cuenta
// dos veces (un tiro a puerta también es un tiro; un pase fallado también es una pérdida) sale una sola vez, en los dos filtros.

/** Lo que se puede filtrar al verlo en el vídeo; «passes» son los intentados, buenos y fallados («3/4 pases»). */
export type MomentKind =
  | 'goals'
  | 'shots'
  | 'shotsOnTarget'
  | 'passes'
  | 'recoveries'
  | 'ballLosses'
  | 'saves'
  | 'corners'
  | 'throwIns'
  | 'goalKicks'
  | 'fouls'
  | 'foulsReceived'
  | 'offsides';

export type MomentSide = 'ours' | 'rival';

/** Una acción para verla en el vídeo: en qué vídeo y en qué segundo, qué fue y en qué filtros sale. */
export interface VideoMoment {
  videoId: string;
  /** Segundo del vídeo, desde el principio del archivo. */
  t: number;
  label: string;
  kinds: MomentKind[];
  /** En los datos de equipo: de cuál de los dos es, con su nombre y el color de su equipación. */
  side?: MomentSide;
  who?: string;
  color?: string | null;
}

/** Cada vídeo del partido que puede salir en la lista (las dos partes, si se subieron por separado). */
export interface MomentVideo {
  videoId: string;
  contentType: string | null;
  label: string;
  title: string;
}

export const momentKindLabels: Record<MomentKind, string> = {
  goals: 'Goles',
  shots: 'Tiros',
  shotsOnTarget: 'Tiros a puerta',
  passes: 'Pases',
  recoveries: 'Recuperaciones',
  ballLosses: 'Pérdidas',
  saves: 'Paradas',
  corners: 'Córners',
  throwIns: 'Saques de banda',
  goalKicks: 'Saques de puerta',
  fouls: 'Faltas cometidas',
  foulsReceived: 'Faltas recibidas',
  offsides: 'Fueras de juego',
};

export const momentKindOrder = Object.keys(momentKindLabels) as MomentKind[];

type Draft = Pick<VideoMoment, 't' | 'label' | 'kinds'>;

const drafts = (seconds: number[], label: string, kinds: MomentKind[]): Draft[] => seconds.map((t) => ({ t, label, kinds }));

/** Separa de seconds, uno a uno, los que también están en subset (los tiros que fueron a puerta, las pérdidas que fueron un pase). */
function split(seconds: number[], subset: number[]): { inside: number[]; outside: number[] } {
  const left = new Map<number, number>();
  for (const t of subset) left.set(t, (left.get(t) ?? 0) + 1);
  const inside: number[] = [];
  const outside: number[] = [];
  for (const t of seconds) {
    const pending = left.get(t) ?? 0;
    if (pending > 0) {
      left.set(t, pending - 1);
      inside.push(t);
    } else {
      outside.push(t);
    }
  }
  return { inside, outside };
}

/** En orden; dos acciones distintas en el mismo segundo (un tiro que acaba en gol…) salen en una sola línea. */
function finish(videoId: string, items: Draft[], extra: Pick<VideoMoment, 'side' | 'who' | 'color'> = {}): VideoMoment[] {
  const result: VideoMoment[] = [];
  for (const item of [...items].sort((a, b) => a.t - b.t)) {
    const last = result[result.length - 1];
    if (last && last.t === item.t && !item.kinds.some((kind) => last.kinds.includes(kind))) {
      last.label = `${last.label} · ${item.label}`;
      last.kinds = [...last.kinds, ...item.kinds];
    } else {
      result.push({ ...item, kinds: [...item.kinds], videoId, ...extra });
    }
  }
  return result;
}

export function playerMoments(part: VideoAnalysisPartDto, player: VideoAnalysisPlayerDto): VideoMoment[] {
  const m = player.moments;
  if (!m) return [];
  const shots = split(m.shots, m.shotsOnTarget);
  const losses = split(m.ballLosses, m.passesFailed);
  return finish(part.videoId, [
    ...drafts(m.goals, 'Gol', ['goals']),
    ...drafts(shots.inside, 'Tiro a puerta', ['shots', 'shotsOnTarget']),
    ...drafts(shots.outside, 'Tiro', ['shots']),
    ...drafts(m.passesCompleted, 'Pase', ['passes']),
    ...drafts(m.passesFailed, 'Pase fallado', ['passes', 'ballLosses']),
    ...drafts(losses.outside, 'Pérdida', ['ballLosses']),
    ...drafts(m.recoveries, 'Recuperación', ['recoveries']),
    ...drafts(m.saves, 'Parada', ['saves']),
    ...drafts(m.fouls, 'Falta cometida', ['fouls']),
    ...drafts(m.foulsReceived, 'Falta recibida', ['foulsReceived']),
    ...drafts(m.offsides, 'Fuera de juego', ['offsides']),
  ]);
}

/** Las de los dos equipos de una parte; ourTeam es el que el cuerpo técnico dijo que era el suyo. */
export function teamMoments(part: VideoAnalysisPartDto, ourTeam: number, names: Record<MomentSide, string>): VideoMoment[] {
  return part.teams.flatMap((team) => {
    const m = team.moments;
    if (!m) return [];
    const side: MomentSide = team.index === ourTeam ? 'ours' : 'rival';
    const shots = split(m.shots, m.shotsOnTarget);
    return finish(part.videoId, [
      ...drafts(m.goals, 'Gol', ['goals']),
      ...drafts(shots.inside, 'Tiro a puerta', ['shots', 'shotsOnTarget']),
      ...drafts(shots.outside, 'Tiro', ['shots']),
      ...drafts(m.corners, 'Córner', ['corners']),
      ...drafts(m.throwIns, 'Saque de banda', ['throwIns']),
      ...drafts(m.goalKicks, 'Saque de puerta', ['goalKicks']),
      ...drafts(m.fouls, 'Falta cometida', ['fouls']),
      ...drafts(m.offsides, 'Fuera de juego', ['offsides']),
    ], { side, who: names[side], color: team.color });
  });
}

/** La propuesta trae los momentos (Ojeador 2.1.2 o posterior). */
export const hasMoments = (part: VideoAnalysisPartDto) => part.teams.some((t) => !!t.moments) || part.players.some((p) => !!p.moments);
