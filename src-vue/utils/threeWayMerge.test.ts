import { describe, it, expect } from 'vitest';
import { threeWayMerge } from './threeWayMerge';

describe('threeWayMerge', () => {
  it('returns local if base and remote match', () => {
    expect(threeWayMerge('base', 'base', 'local')).toBe('local');
  });

  it('returns remote if base and local match', () => {
    expect(threeWayMerge('base', 'remote', 'base')).toBe('remote');
  });

  it('merges non-conflicting line changes', () => {
    const base = 'line 1\nline 2\nline 3';
    const remote = 'line 1 changed\nline 2\nline 3';
    const local = 'line 1\nline 2\nline 3 changed';
    expect(threeWayMerge(base, remote, local)).toBe('line 1 changed\nline 2\nline 3 changed');
  });

  it('handles added lines at the end', () => {
    const base = 'line 1';
    const remote = 'line 1\nremote addition';
    const local = 'line 1\nlocal addition';
    expect(threeWayMerge(base, remote, local)).toBe('line 1\nremote addition\nlocal addition');
  });

  it('resolves conflicting line changes by joining them', () => {
    const base = 'line 1';
    const remote = 'line 1 remote';
    const local = 'line 1 local';
    expect(threeWayMerge(base, remote, local)).toBe('line 1 remote line 1 local');
  });

  it('covers remaining branch conditions', () => {
    // b === null, r !== null, l !== null, r === l
    expect(threeWayMerge('base', 'base\nadd', 'base\nadd')).toBe('base\nadd');

    // b === null, r !== null, l === null
    expect(threeWayMerge('base', 'base\nadd', 'local')).toBe('local\nadd');

    // b === null, r === null, l !== null
    expect(threeWayMerge('base', 'remote', 'base\nadd')).toBe('remote\nadd');

    // rChanged && lChanged, r === null, l !== null
    expect(threeWayMerge('line 1\nline 2', 'line 1', 'line 1\nchanged')).toBe('line 1\nchanged');

    // rChanged && lChanged, l === null, r !== null
    expect(threeWayMerge('line 1\nline 2', 'line 1\nchanged', 'line 1')).toBe('line 1\nchanged');

    // rChanged && lChanged, r !== null, l !== null, r === l
    expect(threeWayMerge('base', 'changed', 'changed')).toBe('changed');
  });
});
