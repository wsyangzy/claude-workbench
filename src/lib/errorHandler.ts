/**
 * Enhanced error handling system for Claude CLI integration
 * Provides user-friendly error messages, retry logic, and graceful degradation
 */

export interface ErrorDetails {
  code: string;
  message: string;
  userMessage: string;
  recoverable: boolean;
  retryable: boolean;
  actions?: ErrorAction[];
}

export interface ErrorAction {
  label: string;
  action: () => void | Promise<void>;
  primary?: boolean;
}

export type ErrorCode = 
  | 'CLAUDE_NOT_FOUND'
  | 'CLAUDE_NOT_EXECUTABLE'
  | 'CLAUDE_VERSION_MISMATCH'
  | 'CLAUDE_PERMISSION_DENIED'
  | 'CLAUDE_NETWORK_ERROR'
  | 'CLAUDE_TIMEOUT'
  | 'CLAUDE_PROCESS_ERROR'
  | 'CLAUDE_CONFIG_ERROR'
  | 'SYSTEM_PATH_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Enhanced error class with user-friendly details
 */
export class ClaudeError extends Error {
  public readonly code: ErrorCode;
  public readonly userMessage: string;
  public readonly recoverable: boolean;
  public readonly retryable: boolean;
  public readonly actions: ErrorAction[];
  public readonly originalError?: Error;

  constructor(
    code: ErrorCode,
    message: string,
    userMessage: string,
    options: {
      recoverable?: boolean;
      retryable?: boolean;
      actions?: ErrorAction[];
      originalError?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'ClaudeError';
    this.code = code;
    this.userMessage = userMessage;
    this.recoverable = options.recoverable ?? true;
    this.retryable = options.retryable ?? false;
    this.actions = options.actions ?? [];
    this.originalError = options.originalError;
  }
}

/**
 * Parse error messages and categorize them appropriately
 */
export function parseClaudeError(error: unknown): ClaudeError {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  // Claude CLI not found
  if (lowerMessage.includes('claude cli not found') || 
      lowerMessage.includes('no such file or directory') ||
      lowerMessage.includes('command not found') ||
      lowerMessage.includes('not recognized as an internal or external command')) {
    return new ClaudeError(
      'CLAUDE_NOT_FOUND',
      message,
      'Claude CLI is not installed or not found in your system PATH.',
      {
        recoverable: true,
        retryable: false,
        actions: [
          {
            label: 'Install Claude CLI',
            action: () => { window.open('https://docs.anthropic.com/claude/docs/claude-cli', '_blank'); },
            primary: true
          },
          {
            label: 'Select Custom Path',
            action: () => {
              // This will be handled by the calling component
              window.dispatchEvent(new CustomEvent('open-claude-settings'));
            }
          }
        ]
      }
    );
  }

  // Permission denied
  if (lowerMessage.includes('permission denied') || 
      lowerMessage.includes('access is denied') ||
      lowerMessage.includes('eacces')) {
    return new ClaudeError(
      'CLAUDE_PERMISSION_DENIED',
      message,
      'Permission denied when trying to execute Claude CLI. Please check file permissions.',
      {
        recoverable: true,
        retryable: true,
        actions: [
          {
            label: 'Run as Administrator',
            action: () => {
              // Suggestion for Windows
              console.log('Please try running the application as Administrator');
            }
          }
        ]
      }
    );
  }

  // Network/connection errors
  if (lowerMessage.includes('network') || 
      lowerMessage.includes('connection') ||
      lowerMessage.includes('timeout') ||
      lowerMessage.includes('enotfound') ||
      lowerMessage.includes('econnrefused')) {
    return new ClaudeError(
      'CLAUDE_NETWORK_ERROR',
      message,
      'Network connection error. Please check your internet connection and try again.',
      {
        recoverable: true,
        retryable: true
      }
    );
  }

  // Process execution errors
  if (lowerMessage.includes('spawning') || 
      lowerMessage.includes('process') ||
      lowerMessage.includes('exit code')) {
    return new ClaudeError(
      'CLAUDE_PROCESS_ERROR',
      message,
      'Failed to start or communicate with Claude CLI process.',
      {
        recoverable: true,
        retryable: true,
        actions: [
          {
            label: 'Check Claude Installation',
            action: () => {
              window.dispatchEvent(new CustomEvent('validate-claude-installation'));
            }
          }
        ]
      }
    );
  }

  // Configuration errors
  if (lowerMessage.includes('config') || 
      lowerMessage.includes('settings') ||
      lowerMessage.includes('invalid') ||
      lowerMessage.includes('malformed')) {
    return new ClaudeError(
      'CLAUDE_CONFIG_ERROR',
      message,
      'Claude CLI configuration error. Please check your settings.',
      {
        recoverable: true,
        retryable: false,
        actions: [
          {
            label: 'Open Settings',
            action: () => {
              window.dispatchEvent(new CustomEvent('open-claude-settings'));
            },
            primary: true
          }
        ]
      }
    );
  }

  // PATH related errors
  if (lowerMessage.includes('path') && 
      (lowerMessage.includes('not found') || lowerMessage.includes('invalid'))) {
    return new ClaudeError(
      'SYSTEM_PATH_ERROR',
      message,
      'System PATH configuration issue. Claude CLI may not be properly installed.',
      {
        recoverable: true,
        retryable: false,
        actions: [
          {
            label: 'Check Installation Guide',
            action: () => { window.open('https://docs.anthropic.com/claude/docs/claude-cli#installation', '_blank'); }
          }
        ]
      }
    );
  }

  // Generic unknown error
  return new ClaudeError(
    'UNKNOWN_ERROR',
    message,
    'An unexpected error occurred. Please try again or contact support if the problem persists.',
    {
      recoverable: true,
      retryable: true,
      originalError: error instanceof Error ? error : undefined
    }
  );
}

/**
 * Retry mechanism with exponential backoff
 */
export class RetryHandler {
  private maxRetries: number;
  private baseDelay: number;
  private maxDelay: number;

  constructor(maxRetries = 3, baseDelay = 1000, maxDelay = 10000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
  }

  async execute<T>(
    operation: () => Promise<T>,
    shouldRetry: (error: unknown) => boolean = () => true
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry on the last attempt or if error is not retryable
        if (attempt === this.maxRetries || !shouldRetry(error)) {
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = Math.min(
          this.baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
          this.maxDelay
        );

        console.warn(`Operation failed (attempt ${attempt + 1}/${this.maxRetries + 1}), retrying in ${delay}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}

/**
 * Enhanced API wrapper with error handling and retry logic
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: {
    retryable?: boolean;
    retryHandler?: RetryHandler;
    fallback?: (...args: T) => Promise<R>;
  } = {}
): (...args: T) => Promise<R> {
  const retryHandler = options.retryHandler ?? new RetryHandler();

  return async (...args: T): Promise<R> => {
    const operation = () => fn(...args);

    try {
      if (options.retryable) {
        return await retryHandler.execute(operation, (error) => {
          const claudeError = parseClaudeError(error);
          return claudeError.retryable;
        });
      } else {
        return await operation();
      }
    } catch (error) {
      const claudeError = parseClaudeError(error);
      
      // Try fallback if available
      if (options.fallback && claudeError.recoverable) {
        try {
          console.warn('Primary operation failed, trying fallback:', claudeError.message);
          return await options.fallback(...args);
        } catch (fallbackError) {
          // If fallback also fails, throw the original error
          console.error('Fallback also failed:', fallbackError);
        }
      }

      // Re-throw as ClaudeError for consistent handling
      throw claudeError;
    }
  };
}

/**
 * Get user-friendly error message for display
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ClaudeError) {
    return error.userMessage;
  }
  
  const claudeError = parseClaudeError(error);
  return claudeError.userMessage;
}

/**
 * Check if an error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  if (error instanceof ClaudeError) {
    return error.recoverable;
  }
  
  const claudeError = parseClaudeError(error);
  return claudeError.recoverable;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ClaudeError) {
    return error.retryable;
  }
  
  const claudeError = parseClaudeError(error);
  return claudeError.retryable;
}

/**
 * Get available actions for an error
 */
export function getErrorActions(error: unknown): ErrorAction[] {
  if (error instanceof ClaudeError) {
    return error.actions;
  }
  
  const claudeError = parseClaudeError(error);
  return claudeError.actions;
}