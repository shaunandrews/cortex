import { describe, it, expect } from 'vitest';
import { deriveSlug, validateSlugShape } from './slug';

describe('deriveSlug', () => {
  it('lowercases', () => {
    expect(deriveSlug('Hello World')).toBe('hello-world');
  });

  it('replaces whitespace with hyphens', () => {
    expect(deriveSlug('team retro q2')).toBe('team-retro-q2');
  });

  it('replaces underscores with hyphens', () => {
    expect(deriveSlug('team_retro')).toBe('team-retro');
  });

  it('strips non-alphanumeric characters', () => {
    expect(deriveSlug("Shaun's P2!")).toBe('shauns-p2');
  });

  it('collapses repeated hyphens', () => {
    expect(deriveSlug('too   many   spaces')).toBe('too-many-spaces');
    expect(deriveSlug('dash---dash')).toBe('dash-dash');
  });

  it('trims leading and trailing hyphens', () => {
    expect(deriveSlug('---hello---')).toBe('hello');
  });

  it('strips unicode and emoji', () => {
    expect(deriveSlug('café 🎉')).toBe('caf');
  });

  it('handles empty input', () => {
    expect(deriveSlug('')).toBe('');
    expect(deriveSlug('   ')).toBe('');
  });

  it('preserves digits', () => {
    expect(deriveSlug('Q1 2026 Planning')).toBe('q1-2026-planning');
  });
});

describe('validateSlugShape', () => {
  it('rejects empty', () => {
    expect(validateSlugShape('')).toEqual({ ok: false, message: expect.any(String) });
  });

  it('rejects too short', () => {
    expect(validateSlugShape('abc')).toEqual({ ok: false, message: expect.any(String) });
  });

  it('rejects too long', () => {
    expect(validateSlugShape('a'.repeat(51))).toEqual({ ok: false, message: expect.any(String) });
  });

  it('rejects leading hyphen', () => {
    expect(validateSlugShape('-team')).toEqual({ ok: false, message: expect.any(String) });
  });

  it('rejects trailing hyphen', () => {
    expect(validateSlugShape('team-')).toEqual({ ok: false, message: expect.any(String) });
  });

  it('rejects uppercase', () => {
    expect(validateSlugShape('Team')).toEqual({ ok: false, message: expect.any(String) });
  });

  it('rejects spaces', () => {
    expect(validateSlugShape('team retro')).toEqual({ ok: false, message: expect.any(String) });
  });

  it('accepts valid slugs', () => {
    expect(validateSlugShape('team-retro')).toEqual({ ok: true });
    expect(validateSlugShape('p2-team-2026')).toEqual({ ok: true });
    expect(validateSlugShape('abcd')).toEqual({ ok: true });
  });
});
