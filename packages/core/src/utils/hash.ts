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
 * Compute the MD5 hash of a UTF-8 string and return it as a base64 string.
 *
 * The output matches the C# implementation:
 * ```csharp
 * var bytes = Encoding.UTF8.GetBytes(value);
 * var hash  = MD5.Create().ComputeHash(bytes);
 * return Convert.ToBase64String(hash);
 * ```
 *
 * When {@link urlSafe} is `true` the standard base64 alphabet is replaced
 * with URL-safe characters (`+` becomes `-`, `/` becomes `_`) and trailing
 * `=` padding is stripped.
 *
 * @param value   - The string to hash.
 * @param urlSafe - When `true`, return a URL-safe base64 variant.
 *                  Defaults to `false`.
 * @returns The base64-encoded MD5 hash string.
 *
 * @example
 * ```ts
 * getMD5HashString('hello');
 * // => "XUFAKrxLKna5cZ2REBfFkg=="
 *
 * getMD5HashString('hello', true);
 * // => "XUFAKrxLKna5cZ2REBfFkg"
 * ```
 */
export function getMD5HashString(value: string, urlSafe?: boolean): string {
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

    // Encode as standard base64, identical to C#'s Convert.ToBase64String.
    let base64 = Buffer.from(bytes).toString('base64');

    if (urlSafe) {
        base64 = base64
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    return base64;
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
