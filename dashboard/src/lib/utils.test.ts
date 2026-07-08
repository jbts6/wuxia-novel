import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('合并类名', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('处理条件类名', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('合并 Tailwind 类名', () => {
    expect(cn('px-4 py-2', 'px-6')).toBe('py-2 px-6');
  });
});
