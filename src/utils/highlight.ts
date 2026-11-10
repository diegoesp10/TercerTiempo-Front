/** Trozos de un texto con las palabras buscadas marcadas (sin tener en cuenta tildes ni mayúsculas, por el comienzo de cada palabra). */
export interface HighlightPart {
  text: string;
  match: boolean;
}

const fold = (ch: string) => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function highlightParts(text: string, terms: string[]): HighlightPart[] {
  const wanted = terms.filter((t) => t.length > 0);
  if (!text || wanted.length === 0) return [{ text, match: false }];

  // Texto plegado letra a letra (cada letra conserva su posición en el original).
  const folded = [...text].map(fold);
  const flat = folded.join('');
  const starts: number[] = [];
  let position = 0;
  for (const piece of folded) {
    starts.push(position);
    position += piece.length;
  }
  const toOriginal = (flatIndex: number) => {
    let index = starts.findIndex((s) => s > flatIndex);
    if (index === -1) index = starts.length;
    return index - 1;
  };

  const marked = new Array<boolean>(folded.length).fill(false);
  for (const term of wanted) {
    let from = 0;
    while (from < flat.length) {
      const at = flat.indexOf(term, from);
      if (at === -1) break;
      const atWordStart = at === 0 || !/[\p{L}\p{N}]/u.test(flat[at - 1] ?? '');
      if (atWordStart) for (let i = toOriginal(at); i <= toOriginal(at + term.length - 1); i++) marked[i] = true;
      from = at + 1;
    }
  }

  const chars = [...text];
  const parts: HighlightPart[] = [];
  chars.forEach((ch, i) => {
    const last = parts[parts.length - 1];
    if (last && last.match === marked[i]) last.text += ch;
    else parts.push({ text: ch, match: marked[i] ?? false });
  });
  return parts;
}
