/** Split chat text into plain segments and link segments for rendering. */
export function splitMessage(txt: string): Array<{ text: string; href?: string }> {
  const re = /(https?:\/\/[^\s]+)/g;
  const segments: Array<{ text: string; href?: string }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt)) !== null) {
    if (m.index > last) segments.push({ text: txt.slice(last, m.index) });
    segments.push({ text: m[0], href: m[0] });
    last = m.index + m[0].length;
  }
  if (last < txt.length) segments.push({ text: txt.slice(last) });
  return segments.length ? segments : [{ text: txt }];
}
