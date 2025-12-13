import { describe, it, expect } from 'vitest';

import { greet, version } from '../index.js';

describe('greet', () => {
  it('should return greeting with name', () => {
    const result = greet('Atlas');
    expect(result).toBe('Hello, Atlas! Welcome to Atlas.');
  });

  it('should handle empty string', () => {
    const result = greet('');
    expect(result).toBe('Hello, ! Welcome to Atlas.');
  });
});

describe('version', () => {
  it('should export version', () => {
    expect(version).toBe('0.1.0');
  });
});
