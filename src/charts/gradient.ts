// Degradado lineal como objeto plano: ECharts lo entiende igual que un graphic.LinearGradient y así las opciones no
// importan la librería (solo la descarga AppChart, cuando de verdad hay un gráfico en pantalla).
export const linearGradient = (x2: number, y2: number, colorStops: { offset: number; color: string }[]) => ({
  type: 'linear' as const,
  x: 0,
  y: 0,
  x2,
  y2,
  colorStops,
  global: false,
});
