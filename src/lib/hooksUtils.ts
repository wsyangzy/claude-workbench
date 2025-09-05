/**
 * Utility functions for hooks - extracted from HooksManager to avoid circular imports
 */

/**
 * Generate a unique ID for hooks
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Check for dangerous patterns in commands
 */
export function checkDangerousPatterns(command: string): string[] {
  const warnings: string[] = [];
  
  // Check for common dangerous patterns
  const dangerousPatterns = [
    { pattern: /rm\s+-rf/gi, warning: 'Potential destructive file deletion (rm -rf)' },
    { pattern: /sudo\s+rm/gi, warning: 'Elevated file deletion command' },
    { pattern: /format\s+[c-z]:/gi, warning: 'Disk formatting command' },
    { pattern: /del\s+\/[sqf]/gi, warning: 'Windows file deletion with force flags' },
    { pattern: /shutdown|halt|reboot/gi, warning: 'System shutdown/reboot command' },
    { pattern: /curl.*\|\s*(sh|bash|zsh)/gi, warning: 'Downloading and executing remote scripts' },
    { pattern: /wget.*\|\s*(sh|bash|zsh)/gi, warning: 'Downloading and executing remote scripts' }
  ];
  
  for (const { pattern, warning } of dangerousPatterns) {
    if (pattern.test(command)) {
      warnings.push(warning);
    }
  }
  
  return warnings;
}