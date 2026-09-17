import path from 'path';

export class PathTraversalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathTraversalError';
  }
}

/**
 * Normalizes a file path to standard forward slashes and lowercases Windows drive letters
 */
export function normalizePath(filePath: string): string {
  const normalized = path.normalize(filePath).replace(/\\/g, '/');
  return normalized;
}

/**
 * Checks if childPath is strictly within or equal to parentPath
 */
export function isSubPath(parentPath: string, childPath: string): boolean {
  const rel = path.relative(parentPath, childPath);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Validates that the requested target path is safely within the workspace root.
 * Throws PathTraversalError if traversal is attempted.
 *
 * @param workspaceRoot Absolute root path for the workspace
 * @param relativeOrAbsolutePath Requested file path
 * @returns Absolute validated path
 */
export function validateWorkspacePath(
  workspaceRoot: string,
  relativeOrAbsolutePath: string
): string {
  const absRoot = path.resolve(workspaceRoot);
  const resolved = path.resolve(absRoot, relativeOrAbsolutePath);

  if (!isSubPath(absRoot, resolved)) {
    throw new PathTraversalError(
      `Path traversal detected: "${relativeOrAbsolutePath}" is outside workspace root "${absRoot}"`
    );
  }

  return resolved;
}
