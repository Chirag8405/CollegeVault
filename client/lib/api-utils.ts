// API utilities for consistent error handling and response parsing
// Developed by Chirag Poornamath

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public statusText?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Safely parse a response as JSON with proper error handling
 */
export async function parseJsonResponse<T = any>(response: Response): Promise<T> {
  // Prefer JSON when server declares it
  const contentType = response.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) {
        throw new ApiError(
          (data && (data.message || data.error)) || `HTTP Error: ${response.status} ${response.statusText}`,
          response.status,
          response.statusText
        );
      }
      return data as T;
    }

    const text = await response.text();
    if (!response.ok) {
      throw new ApiError(text || `HTTP Error: ${response.status} ${response.statusText}`, response.status, response.statusText);
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      // Not JSON, return as any with text
      return ({ message: text } as unknown) as T;
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError('Network error: Unable to connect to server');
    }
    throw new ApiError('Failed to process server response');
  }
}

/**
 * Create a standardized fetch wrapper with error handling
 */
export async function safeFetch<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options?.headers,
      },
    });

    return await parseJsonResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError('Network error: Unable to connect to server');
    }
    
    throw new ApiError('An unexpected error occurred');
  }
}

/**
 * Debounce function to prevent rapid API calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Retry wrapper for API calls
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Don't retry on client errors (4xx), only server errors (5xx) and network errors
      if (error instanceof ApiError && error.status && error.status < 500) {
        break;
      }
      
      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
    }
  }
  
  throw lastError!;
}

/**
 * Create authenticated headers with token
 */
export function createAuthHeaders(token: string): HeadersInit {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}
