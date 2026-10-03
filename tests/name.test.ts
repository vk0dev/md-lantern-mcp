import { describe, expect, it } from 'vitest';

import { isBareToken, isValidName } from '../src/core/reference.js';

describe('isValidName', () => {
  it('accepts lowercase alphanumeric names with . _ -', () => {
    expect(isValidName('daily-report')).toBe(true);
    expect(isValidName('status_board')).toBe(true);
    expect(isValidName('v1.2.report')).toBe(true);
    expect(isValidName('a')).toBe(true);
  });

  it('rejects names starting with a disallowed character, uppercase, or spaces', () => {
    expect(isValidName('Bad Name!')).toBe(false);
    expect(isValidName('-leading-dash')).toBe(false);
    expect(isValidName('UPPER')).toBe(false);
    expect(isValidName('')).toBe(false);
    expect(isValidName('has space')).toBe(false);
  });

  it('rejects names longer than 64 characters', () => {
    expect(isValidName('a'.repeat(64))).toBe(true);
    expect(isValidName('a'.repeat(65))).toBe(false);
  });
});

describe('isBareToken', () => {
  it('accepts 8-64 char alphanumeric/_/- tokens', () => {
    expect(isBareToken('AbCdEfGh1234')).toBe(true);
    expect(isBareToken('a'.repeat(8))).toBe(true);
    expect(isBareToken('a'.repeat(64))).toBe(true);
  });

  it('rejects tokens that are too short, too long, or contain invalid characters', () => {
    expect(isBareToken('short')).toBe(false);
    expect(isBareToken('a'.repeat(65))).toBe(false);
    expect(isBareToken('has a space')).toBe(false);
    expect(isBareToken('slash/es')).toBe(false);
  });
});
