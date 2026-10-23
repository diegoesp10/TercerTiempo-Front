import type { jsPDF as JsPdf } from 'jspdf';
import type { MatchDto } from '@/types/api';

/**
 * Acta interna en papel (PDF A4 apaisado) para apuntar en directo y pasarla luego a la app. Mismas columnas y en el
 * mismo orden que el acta digital; los nombres y todos los datos se escriben a mano. Con un partido, la cabecera sale
 * con el equipo, el rival, la fecha y la jornada.
 */
export interface PaperSheetContext {
  teamName: string;
  teamId?: string;
  competition?: string;
  season?: string;
  match?: MatchDto | null;
}

const PAGE = { width: 297, height: 210, margin: 8 };
const PLAYER_ROWS = 22;
const LINE = 0.2;
const GRID = [90, 90, 90] as const;
const SHADE = [242, 242, 242] as const;
const INK = [20, 20, 20] as const;
const MUTED = [110, 110, 110] as const;

// Jugó, Dorsal, Jugador, Tit, Min, los 13 contadores del acta, TA, TR y Notas. Las columnas que se apuntan con palotes
// durante el partido (pases, pérdidas, recuperaciones) son más anchas.
const PLAYER_COLUMNS: { label: string; width: number; box?: boolean; left?: boolean }[] = [
  { label: 'Jugó', width: 8, box: true },
  { label: 'Dorsal', width: 10 },
  { label: 'Jugador', width: 44, left: true },
  { label: 'Tit', width: 8, box: true },
  { label: 'Min', width: 10 },
  { label: 'G', width: 9 },
  { label: 'A', width: 9 },
  { label: 'T', width: 10 },
  { label: 'TP', width: 10 },
  { label: 'PC', width: 10 },
  { label: 'PasC', width: 17 },
  { label: 'PasI', width: 17 },
  { label: 'Pér', width: 16 },
  { label: 'Rec', width: 16 },
  { label: 'Ent', width: 10 },
  { label: 'Int', width: 10 },
  { label: 'Par', width: 10 },
  { label: 'F', width: 10 },
  { label: 'TA', width: 8 },
  { label: 'TR', width: 8 },
  { label: 'Notas', width: 31, left: true },
];

const LEGEND =
  'Jugó: marca quien ha jugado · Tit: titular · Min: minutos · G: goles · A: asistencias · T: tiros · TP: tiros a puerta · PC: pases clave · ' +
  'PasC / PasI: pases completados / intentados · Pér: pérdidas · Rec: recuperaciones · Ent: entradas · Int: intercepciones · Par: paradas · ' +
  'F: faltas cometidas · TA / TR: tarjetas amarilla / roja';

const TEAM_ROWS = ['Posesión (%)', 'Córners', 'Tiros', 'Tiros a puerta', 'Fueras de juego', 'Faltas cometidas', 'Goles a balón parado'];
const INCIDENT_ROWS = 17;

export async function downloadPaperSheet(context: PaperSheetContext) {
  (await buildPaperSheet(context)).save(fileName(context));
}

export async function buildPaperSheet(context: PaperSheetContext): Promise<JsPdf> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setLineWidth(LINE);
  doc.setDrawColor(...GRID);
  doc.setTextColor(...INK);

  const top = header(doc, context, 1);
  playerGrid(doc, top);

  doc.addPage();
  const top2 = header(doc, context, 2);
  teamAndIncidents(doc, context, top2);
  return doc;
}

function header(doc: JsPdf, context: PaperSheetContext, page: number): number {
  const { margin, width } = PAGE;
  const match = context.match ?? null;
  const home = match && context.teamId ? match.homeTeam.id === context.teamId : null;
  const opponent = match && home !== null ? (home ? match.awayTeam.name : match.homeTeam.name) : '';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(page === 1 ? 'Acta interna del partido' : 'Datos del equipo e incidencias', margin, margin + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  const subtitle = ['Tercer Tiempo', context.competition, context.season].filter(Boolean).join(' · ');
  doc.text(`${subtitle} · Hoja ${page} de 2`, margin, margin + 9.5);
  doc.setTextColor(...INK);

  // Campos de la cabecera: el valor sale impreso si se conoce; si no, queda la línea para escribirlo.
  const fields: { label: string; value: string; width: number }[] = [
    { label: 'Equipo', value: context.teamName, width: 44 },
    { label: 'Rival', value: opponent, width: 44 },
    { label: 'Fecha', value: match ? formatDate(match.kickoffAt) : '', width: 32 },
    { label: 'Jornada', value: match ? String(match.matchday) : '', width: 14 },
    { label: 'L / V', value: home === null ? '' : home ? 'Local' : 'Visitante', width: 16 },
    { label: 'Resultado', value: '', width: 20 },
  ];
  let x = width - margin - fields.reduce((sum, f) => sum + f.width, 0) - (fields.length - 1) * 3;
  const y = margin + 1;
  for (const field of fields) {
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text(field.label.toUpperCase(), x, y + 2);
    doc.setTextColor(...INK);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    if (field.value) doc.text(fit(doc, field.value, field.width - 1), x, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.line(x, y + 9.5, x + field.width, y + 9.5);
    x += field.width + 3;
  }
  return margin + 15;
}

function playerGrid(doc: JsPdf, top: number) {
  const { margin } = PAGE;
  const headHeight = 7;
  const rowHeight = 6.9;
  const tableWidth = PLAYER_COLUMNS.reduce((sum, c) => sum + c.width, 0);

  // Cabecera de columnas.
  doc.setFillColor(...SHADE);
  doc.rect(margin, top, tableWidth, headHeight, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  let x = margin;
  for (const column of PLAYER_COLUMNS) {
    const textX = column.left ? x + 1.5 : x + column.width / 2;
    doc.text(column.label, textX, top + 4.6, { align: column.left ? 'left' : 'center' });
    x += column.width;
  }

  // Filas de jugadores (sombreadas una sí y una no) y fila de totales.
  doc.setFont('helvetica', 'normal');
  for (let row = 0; row <= PLAYER_ROWS; row++) {
    const y = top + headHeight + row * rowHeight;
    const totals = row === PLAYER_ROWS;
    if (row % 2 === 1 || totals) {
      const shade = totals ? 230 : 248;
      doc.setFillColor(shade, shade, shade);
      doc.rect(margin, y, tableWidth, rowHeight, 'F');
    }
    x = margin;
    for (const column of PLAYER_COLUMNS) {
      if (totals && column.label === 'Jugador') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text('Totales', x + 1.5, y + 4.5);
        doc.setFont('helvetica', 'normal');
      }
      if (column.box && !totals) {
        const size = 3.6;
        doc.setDrawColor(...MUTED);
        doc.rect(x + (column.width - size) / 2, y + (rowHeight - size) / 2, size, size, 'S');
        doc.setDrawColor(...GRID);
      }
      x += column.width;
    }
  }

  // Rejilla.
  const bottom = top + headHeight + (PLAYER_ROWS + 1) * rowHeight;
  doc.setDrawColor(...GRID);
  for (let row = 0; row <= PLAYER_ROWS + 1; row++) {
    const y = top + headHeight + row * rowHeight;
    doc.line(margin, y, margin + tableWidth, y);
  }
  x = margin;
  for (const column of PLAYER_COLUMNS) {
    doc.line(x, top, x, bottom);
    x += column.width;
  }
  doc.line(x, top, x, bottom);
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.4);
  doc.rect(margin, top, tableWidth, bottom - top, 'S');
  doc.setLineWidth(LINE);
  doc.setDrawColor(...GRID);

  // Leyenda.
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  doc.text(doc.splitTextToSize(LEGEND, tableWidth) as string[], margin, bottom + 4);
  doc.setTextColor(...INK);
}

function teamAndIncidents(doc: JsPdf, context: PaperSheetContext, top: number) {
  const { margin, width, height } = PAGE;
  const match = context.match ?? null;
  const home = match && context.teamId ? match.homeTeam.id === context.teamId : null;
  const opponent = match && home !== null ? (home ? match.awayTeam.name : match.homeTeam.name) : 'Rival';

  // Datos del equipo: cada lado por partes y total, con sitio para palotes.
  const labelWidth = 34;
  const cell = 19;
  const rowHeight = 9;
  const teamWidth = labelWidth + cell * 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Datos del equipo', margin, top + 3);

  const headTop = top + 6;
  doc.setFillColor(...SHADE);
  doc.rect(margin, headTop, teamWidth, 12, 'F');
  doc.setFontSize(7.5);
  doc.text(fit(doc, context.teamName || 'Nuestro equipo', cell * 3 - 2), margin + labelWidth + (cell * 3) / 2, headTop + 4.3, { align: 'center' });
  doc.text(fit(doc, opponent, cell * 3 - 2), margin + labelWidth + cell * 3 + (cell * 3) / 2, headTop + 4.3, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  ['1ª parte', '2ª parte', 'Total', '1ª parte', '2ª parte', 'Total'].forEach((label, i) => {
    doc.text(label, margin + labelWidth + cell * i + cell / 2, headTop + 10, { align: 'center' });
  });

  const bodyTop = headTop + 12;
  doc.setFontSize(7.5);
  TEAM_ROWS.forEach((label, i) => {
    const y = bodyTop + i * rowHeight;
    if (i % 2 === 1) {
      doc.setFillColor(248, 248, 248);
      doc.rect(margin, y, teamWidth, rowHeight, 'F');
    }
    doc.text(label, margin + 1.5, y + 5.6);
  });
  const teamBottom = bodyTop + TEAM_ROWS.length * rowHeight;
  for (let i = 0; i <= TEAM_ROWS.length; i++) doc.line(margin, bodyTop + i * rowHeight, margin + teamWidth, bodyTop + i * rowHeight);
  doc.line(margin + labelWidth, headTop + 6, margin + teamWidth, headTop + 6);
  for (let i = 0; i <= 6; i++) {
    const x = margin + labelWidth + cell * i;
    doc.setLineWidth(i === 3 || i === 0 || i === 6 ? 0.4 : LINE);
    doc.line(x, i === 0 || i === 3 || i === 6 ? headTop : headTop + 6, x, teamBottom);
  }
  doc.setLineWidth(0.4);
  doc.setDrawColor(...INK);
  doc.rect(margin, headTop, teamWidth, teamBottom - headTop, 'S');
  doc.setDrawColor(...GRID);
  doc.setLineWidth(LINE);
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  doc.text('Posesión: el % de tu equipo (el rival, lo que falta hasta 100). Faltas: en la columna del rival, las que te hacen a ti.', margin, teamBottom + 4);
  doc.setTextColor(...INK);

  // Notas del partido, debajo de los datos del equipo.
  const notesTop = teamBottom + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Notas del partido', margin, notesTop);
  doc.setFont('helvetica', 'normal');
  for (let y = notesTop + 8; y < height - margin; y += 8) doc.line(margin, y, margin + teamWidth, y);

  // Incidencias en orden de minuto: goles, asistencias, tarjetas y cambios.
  const incidentsX = margin + teamWidth + 8;
  const incidentsWidth = width - margin - incidentsX;
  const columns = [
    { label: 'Min', width: 12 },
    { label: 'Tipo', width: 24 },
    { label: 'Dorsal', width: 14 },
    { label: 'Sale / asiste / detalle', width: incidentsWidth - 50 },
  ];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Incidencias', incidentsX, top + 3);
  const incidentRow = 8.6;
  doc.setFillColor(...SHADE);
  doc.rect(incidentsX, headTop, incidentsWidth, 7, 'F');
  doc.setFontSize(7.5);
  let x = incidentsX;
  for (const column of columns) {
    doc.text(column.label, x + 1.5, headTop + 4.6);
    x += column.width;
  }
  doc.setFont('helvetica', 'normal');
  const incidentsBottom = headTop + 7 + INCIDENT_ROWS * incidentRow;
  for (let i = 0; i <= INCIDENT_ROWS; i++) {
    const y = headTop + 7 + i * incidentRow;
    if (i < INCIDENT_ROWS && i % 2 === 1) {
      doc.setFillColor(248, 248, 248);
      doc.rect(incidentsX, y, incidentsWidth, incidentRow, 'F');
    }
  }
  for (let i = 0; i <= INCIDENT_ROWS; i++) doc.line(incidentsX, headTop + 7 + i * incidentRow, incidentsX + incidentsWidth, headTop + 7 + i * incidentRow);
  x = incidentsX;
  for (const column of columns) {
    doc.line(x, headTop, x, incidentsBottom);
    x += column.width;
  }
  doc.line(x, headTop, x, incidentsBottom);
  doc.setLineWidth(0.4);
  doc.setDrawColor(...INK);
  doc.rect(incidentsX, headTop, incidentsWidth, incidentsBottom - headTop, 'S');
  doc.setDrawColor(...GRID);
  doc.setLineWidth(LINE);
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  doc.text('Tipo: gol, gol en contra, asistencia, amarilla, roja, cambio, lesión… En un cambio, «Dorsal» es quien entra y el detalle, quien sale.', incidentsX, incidentsBottom + 4, { maxWidth: incidentsWidth });
  doc.setTextColor(...INK);
}

function fit(doc: JsPdf, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

function fileName(context: PaperSheetContext) {
  const slug = (text: string) =>
    text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const match = context.match;
  const suffix = match ? `j${match.matchday}-${slug(match.homeTeam.name)}-${slug(match.awayTeam.name)}` : slug(context.teamName) || 'en-blanco';
  return `acta-interna-${suffix}.pdf`;
}
