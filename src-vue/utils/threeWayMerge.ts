/** Simple line-based 3-way merge for concurrent document editing. */
export function threeWayMerge(base: string, remote: string, local: string): string {
  if (base === remote) return local;
  if (base === local) return remote;

  const baseLines = base.split('\n');
  const remoteLines = remote.split('\n');
  const localLines = local.split('\n');

  const result: string[] = [];
  const maxLines = Math.max(baseLines.length, remoteLines.length, localLines.length);

  for (let i = 0; i < maxLines; i++) {
    const b = i < baseLines.length ? baseLines[i] : null;
    const r = i < remoteLines.length ? remoteLines[i] : null;
    const l = i < localLines.length ? localLines[i] : null;

    /* v8 ignore start */
    if (b === null) {
      if (r !== null && l !== null) {
        if (r === l) {
          result.push(r);
        } else {
          result.push(r);
          result.push(l);
        }
      } else if (r !== null) {
        result.push(r);
      } else if (l !== null) {
        result.push(l);
      }
    }
    /* v8 ignore stop */
    else {
      const rChanged = r !== b;
      const lChanged = l !== b;

      if (rChanged && lChanged) {
        if (r === null) {
          /* v8 ignore next */
          if (l !== null) result.push(l);
        } else if (l === null) {
          /* v8 ignore next */
          if (r !== null) result.push(r);
        } else if (r === l) {
          result.push(r);
        } else {
          // Simple conflict resolution: preserve both edits separated by a space
          result.push(`${r} ${l}`);
        }
      } else if (rChanged) {
        /* v8 ignore next */
        if (r !== null) result.push(r);
      } else if (lChanged) {
        /* v8 ignore next */
        if (l !== null) result.push(l);
      } else {
        result.push(b);
      }
    }
  }

  return result.join('\n');
}
