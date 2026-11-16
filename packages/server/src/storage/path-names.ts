/**
 * Path-name rules that must hold on every platform MiM runs on.
 *
 * Windows silently drops a trailing dot or space ("amex." opens "amex"), maps
 * reserved device names (CON, NUL, COM1, ...) to devices, and compares paths
 * without regard to case. Names that pass these checks mean the same folder
 * on Windows, Linux, and macOS.
 *
 * @module
 */

import * as path from 'node:path';

const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(\.[^.]*)?$/i;

/** True when a single file/folder name means the same thing on every platform. */
export function isPortableName(name: string): boolean {
  return (
    name.length > 0 &&
    !/[. ]$/.test(name) &&
    !/[<>:"|?*]/.test(name) &&
    ![...name].some((character) => character.charCodeAt(0) < 0x20) &&
    !WINDOWS_RESERVED_NAME.test(name)
  );
}

/** True when any segment is "..", whichever separator the platform uses. */
export function hasParentSegment(value: string): boolean {
  return value.split(/[\\/]/).includes('..');
}

/** True when `child` is `parent` or inside it, comparing case-insensitively on Windows. */
export function isWithinOrEqual(parent: string, child: string): boolean {
  // path.relative already ignores case on Windows; it yields an absolute path
  // across drives and a leading ".." segment outside the parent.
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (relative.split(path.sep)[0] !== '..' && !path.isAbsolute(relative));
}
