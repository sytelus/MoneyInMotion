/**
 * Hashing utilities for generating deterministic identifiers.
 *
 * The MD5 implementation is designed to produce output identical to the
 * original C# `Utils.GetMD5HashString` so that existing LatestMerged.json
 * data files remain compatible.
 *
 * @module
 */

import { Md5 } from 'ts-md5';

/**
 * Compute the MD5 hash of a UTF-8 string in the format selected by the caller.
 *
 * The output matches the C# implementation:
 * ```csharp
 * var bytes = Encoding.UTF8.GetBytes(value);
 * var hash  = MD5.Create().ComputeHash(bytes);
 * return Convert.ToBase64String(hash);
 * ```
 *
 * The legacy helper's Boolean parameter is named `hexStringOutput`. Passing
 * `true` returns the lowercase 32-character hexadecimal form used by persisted
 * transaction, import, and scope IDs; omitting it returns standard base64.
 *
 * @param value           - The string to hash.
 * @param hexStringOutput - Return lowercase hexadecimal when `true`, or
 *                          standard padded base64 when `false`.
 * @returns The formatted MD5 digest.
 *
 * @example
 * ```ts
 * getMD5HashString('hello');
 * // => "XUFAKrxLKna5cZ2REBfFkg=="
 *
 * getMD5HashString('hello', true);
 * // => "5d41402abc4b2a76b9719d911017c592"
 * ```
 */
export function getMD5HashString(value: string, hexStringOutput: boolean = false): string {
  // ts-md5 hashStr with raw=true returns an Int32Array of 4 elements
  // representing the 128-bit MD5 digest as four little-endian 32-bit ints.
  const rawHash = Md5.hashStr(value, true) as Int32Array;

  // Convert the Int32Array to a 16-byte Uint8Array (little-endian),
  // matching how .NET's MD5.ComputeHash returns bytes.
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < 4; i++) {
    view.setInt32(i * 4, rawHash[i]!, true);
  }

  if (hexStringOutput) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  // Do not use Node's Buffer here: this module is shared with the browser and
  // Vite intentionally does not inject Node polyfills. MD5 always produces
  // exactly 16 bytes, so converting the byte string with the Web-standard
  // btoa function is both safe and available in every supported runtime.
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Generate a new v4 UUID.
 *
 * Uses the built-in {@link crypto.randomUUID} for cryptographically
 * strong random values.
 *
 * @returns A lowercase UUID string in the standard
 *          `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` format.
 *
 * @example
 * ```ts
 * createUUID();
 * // => "3b241101-e2bb-4d7a-8702-9e1be27c6a5e"
 * ```
 */
export function createUUID(): string {
  return crypto.randomUUID();
}
