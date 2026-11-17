/**
 * Reading persisted dictionaries safely.
 *
 * @module
 */

/**
 * Copy a persisted `Record<string, T>` into a null-prototype object, so even
 * special keys such as "__proto__" stay ordinary data.
 *
 * @param data - A plain object, or `null`/`undefined` for an empty dictionary.
 * @throws {Error} For arrays (including the old C# key/value form) and other
 *                 non-objects.
 */
export function deserializeDictionary<T>(data: unknown): Record<string, T> {
  if (data == null) {
    return {};
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Dictionary value must be an object or null');
  }
  return Object.assign(Object.create(null) as Record<string, T>, data);
}
