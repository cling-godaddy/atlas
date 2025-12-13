import { describe, expect, it } from 'vitest';

import { hashContent, normalizeText } from '../../src/utils/hash';

describe('normalizeText', () => {
  it('should lowercase text', () => {
    expect(normalizeText('Hello World')).toBe('hello world');
  });

  it('should remove punctuation', () => {
    expect(normalizeText('Hello, World!')).toBe('hello world');
    expect(normalizeText('foo.bar?baz')).toBe('foobarbaz');
  });

  it('should collapse whitespace', () => {
    expect(normalizeText('Hello   World')).toBe('hello world');
    expect(normalizeText('Hello\n\nWorld')).toBe('hello world');
    expect(normalizeText('Hello\t\tWorld')).toBe('hello world');
  });

  it('should trim whitespace', () => {
    expect(normalizeText('  Hello World  ')).toBe('hello world');
  });

  it('should handle empty string', () => {
    expect(normalizeText('')).toBe('');
  });

  it('should handle only whitespace', () => {
    expect(normalizeText('   ')).toBe('');
  });

  it('should preserve alphanumeric characters', () => {
    expect(normalizeText('abc123')).toBe('abc123');
  });

  it('should handle mixed content', () => {
    expect(normalizeText('Hello, World! This is a test.')).toBe('hello world this is a test');
  });
});

describe('hashContent', () => {
  it('should return 16 character hex string', () => {
    const hash = hashContent('Hello World');
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('should be deterministic', () => {
    const hash1 = hashContent('Hello World');
    const hash2 = hashContent('Hello World');
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different content', () => {
    const hash1 = hashContent('Hello World');
    const hash2 = hashContent('Goodbye World');
    expect(hash1).not.toBe(hash2);
  });

  it('should normalize before hashing', () => {
    const hash1 = hashContent('Hello World');
    const hash2 = hashContent('hello world');
    const hash3 = hashContent('Hello,   World!');
    expect(hash1).toBe(hash2);
    expect(hash1).toBe(hash3);
  });

  it('should handle empty string', () => {
    const hash = hashContent('');
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('should handle whitespace-only string', () => {
    const hash = hashContent('   ');
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('should handle special characters', () => {
    const hash = hashContent('!@#$%^&*()');
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });
});
