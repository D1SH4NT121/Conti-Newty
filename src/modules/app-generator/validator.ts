export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /child_process/i, message: 'Forbidden import or reference to child_process' },
  { pattern: /\bexecSync\b|\bexec\(/i, message: 'Forbidden execution of shell commands' },
  { pattern: /\bprocess\.exit\b/i, message: 'Forbidden process termination attempt' },
  { pattern: /\bprocess\.kill\b/i, message: 'Forbidden process kill signal' },
  { pattern: /\bprocess\.env\b/i, message: 'Direct process.env access not allowed in sandbox' }
];

export function validateGeneratedCode(files: Record<string, string>): ValidationResult {
  const errors: string[] = [];

  if (!files || Object.keys(files).length === 0) {
    errors.push('No files provided in generated app');
    return { valid: false, errors };
  }

  // Check file paths for path traversal
  for (const filename of Object.keys(files)) {
    if (filename.includes('..') || filename.startsWith('/') || filename.startsWith('\\')) {
      errors.push(`Invalid file path with traversal detected: "${filename}"`);
    }

    const content = files[filename];
    for (const rule of FORBIDDEN_PATTERNS) {
      if (rule.pattern.test(content)) {
        errors.push(`File "${filename}" violates security rule: ${rule.message}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
