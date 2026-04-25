import * as path from 'path';

export interface ZipSlipResult {
  ok: boolean;
  reason?: string;
  resolvedPath?: string;
  relativePath?: string;
}

function isAbsoluteEntryPath(entryPath: string): boolean {
  if (entryPath.startsWith('/') || entryPath.startsWith('\\')) {
    return true;
  }
  return /^[a-zA-Z]:[\\/]/.test(entryPath);
}

export function validateZipEntryPath(targetDir: string, entryPath: string): ZipSlipResult {
  if (!entryPath) {
    return { ok: false, reason: 'empty' };
  }
  if (entryPath.includes('\0')) {
    return { ok: false, reason: 'null-byte' };
  }
  if (isAbsoluteEntryPath(entryPath)) {
    return { ok: false, reason: 'absolute-path' };
  }

  const normalized = path.posix.normalize(entryPath.replace(/\\/g, '/'));

  if (normalized === '.' || normalized === '') {
    return { ok: false, reason: 'empty' };
  }
  if (normalized === '..' || normalized.startsWith('../')) {
    return { ok: false, reason: 'path-traversal' };
  }

  const resolvedTarget = path.resolve(targetDir);
  const resolvedPath = path.resolve(resolvedTarget, normalized);

  if (!resolvedPath.startsWith(resolvedTarget + path.sep) && resolvedPath !== resolvedTarget) {
    return { ok: false, reason: 'escape' };
  }

  return {
    ok: true,
    resolvedPath,
    relativePath: normalized,
  };
}
