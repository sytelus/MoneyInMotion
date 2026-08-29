import { describe, it, expect, vi } from 'vitest';
import { getMD5HashString, createUUID } from '../../src/utils/hash.js';

describe('getMD5HashString', () => {
  it('should produce base64-encoded MD5 matching C# output for empty string', () => {
    // C#: Convert.ToBase64String(MD5.Create().ComputeHash(Encoding.UTF8.GetBytes("")))
    expect(getMD5HashString('')).toBe('1B2M2Y8AsgTpgAmY7PhCfg==');
  });

  it('should produce base64-encoded MD5 matching C# output for "hello"', () => {
    // C#: Convert.ToBase64String(MD5.Create().ComputeHash(Encoding.UTF8.GetBytes("hello")))
    expect(getMD5HashString('hello')).toBe('XUFAKrxLKna5cZ2REBfFkg==');
  });

  it('should produce correct hash for multi-word string', () => {
    // MD5("Hello World") hex = b10a8db164e0754105b7a99be72e3fe5
    // base64 of those bytes: sQqNsWTgdUEFt6mb5y4/5Q==
    expect(getMD5HashString('Hello World')).toBe('sQqNsWTgdUEFt6mb5y4/5Q==');
  });

  it('should handle UTF-8 characters (non-ASCII)', () => {
    // Ensure no crash and deterministic output for UTF-8 input
    const hash1 = getMD5HashString('café');
    const hash2 = getMD5HashString('café');
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBeGreaterThan(0);
  });

  it('should return standard base64 by default (hexStringOutput=false)', () => {
    // "Hello World" hash contains both '/' and '=' in base64
    const hash = getMD5HashString('Hello World');
    expect(hash).toBe('sQqNsWTgdUEFt6mb5y4/5Q==');
    expect(hash).toContain('/');
    expect(hash).toContain('=');
  });

  it('should return the legacy lowercase hexadecimal form when requested', () => {
    const hash = getMD5HashString('Hello World', true);
    expect(hash).toBe('b10a8db164e0754105b7a99be72e3fe5');
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it('should return standard base64 when hex output is explicitly false', () => {
    const hash = getMD5HashString('Hello World', false);
    expect(hash).toBe('sQqNsWTgdUEFt6mb5y4/5Q==');
  });

  it('should produce consistent results across multiple calls', () => {
    const input = 'test-consistency-12345';
    const hash1 = getMD5HashString(input);
    const hash2 = getMD5HashString(input);
    const hash3 = getMD5HashString(input);
    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
  });

  it('should produce different hashes for different inputs', () => {
    const hash1 = getMD5HashString('input-a');
    const hash2 = getMD5HashString('input-b');
    expect(hash1).not.toBe(hash2);
  });

  it('works without the Node-only Buffer global used by browser builds', () => {
    vi.stubGlobal('Buffer', undefined);
    try {
      expect(getMD5HashString('hello')).toBe('XUFAKrxLKna5cZ2REBfFkg==');
      expect(getMD5HashString('hello', true)).toBe('5d41402abc4b2a76b9719d911017c592');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('createUUID', () => {
  it('should return a string matching UUID v4 format', () => {
    const uuid = createUUID();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(uuid).toMatch(uuidRegex);
  });

  it('should return unique values on successive calls', () => {
    const uuids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      uuids.add(createUUID());
    }
    expect(uuids.size).toBe(100);
  });

  it('should return lowercase characters', () => {
    const uuid = createUUID();
    expect(uuid).toBe(uuid.toLowerCase());
  });

  it('falls back to getRandomValues when randomUUID is unavailable', () => {
    let nextByte = 0;
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.forEach((_, index) => {
          bytes[index] = nextByte++;
        });
        return bytes;
      },
    });

    try {
      expect(createUUID()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
