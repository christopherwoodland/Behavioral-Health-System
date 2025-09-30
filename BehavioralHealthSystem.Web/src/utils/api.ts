/**
 * Common API utility functions and types
 * Consolidates repeated API call patterns and error handling
 */

// Common API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export interface ApiError {
  message: string;
  statusCode?: number;
  details?: any;
}

// Common fetch configuration
export interface FetchConfig extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

// Default fetch configuration
const DEFAULT_CONFIG: FetchConfig = {
  timeout: 30000, // 30 seconds
  retries: 3,
  retryDelay: 1000, // 1 second
  headers: {
    'Content-Type': 'application/json',
  },
};

// Timeout utility
const withTimeout = (promise: Promise<Response>, timeout: number): Promise<Response> => {
  return Promise.race([
    promise,
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    ),
  ]);
};

// Retry utility
const withRetry = async <T>(
  operation: () => Promise<T>,
  retries: number,
  delay: number
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(operation, retries - 1, delay);
    }
    throw error;
  }
};

// Enhanced fetch function with timeout and retry
export const fetchWithConfig = async (
  url: string,
  config: FetchConfig = {}
): Promise<Response> => {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const { timeout, retries, retryDelay, ...fetchConfig } = mergedConfig;

  const operation = () => withTimeout(fetch(url, fetchConfig), timeout!);

  return withRetry(operation, retries!, retryDelay!);
};

// Generic API call wrapper
export const apiCall = async <T>(
  url: string,
  config: FetchConfig = {}
): Promise<ApiResponse<T>> => {
  try {
    const response = await fetchWithConfig(url, config);
    
    // Handle non-2xx responses
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: errorText || `HTTP ${response.status}: ${response.statusText}`,
        statusCode: response.status,
      };
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    let data: T;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = (await response.text()) as unknown as T;
    }

    return {
      success: true,
      data,
      statusCode: response.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

// GET request helper
export const apiGet = async <T>(
  url: string,
  config: Omit<FetchConfig, 'method' | 'body'> = {}
): Promise<ApiResponse<T>> => {
  return apiCall<T>(url, { ...config, method: 'GET' });
};

// POST request helper
export const apiPost = async <T, TBody = any>(
  url: string,
  body?: TBody,
  config: Omit<FetchConfig, 'method' | 'body'> = {}
): Promise<ApiResponse<T>> => {
  return apiCall<T>(url, {
    ...config,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
};

// PUT request helper
export const apiPut = async <T, TBody = any>(
  url: string,
  body?: TBody,
  config: Omit<FetchConfig, 'method' | 'body'> = {}
): Promise<ApiResponse<T>> => {
  return apiCall<T>(url, {
    ...config,
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
};

// DELETE request helper
export const apiDelete = async <T>(
  url: string,
  config: Omit<FetchConfig, 'method' | 'body'> = {}
): Promise<ApiResponse<T>> => {
  return apiCall<T>(url, { ...config, method: 'DELETE' });
};

// File upload helper
export const uploadFile = async (
  url: string,
  file: File,
  additionalData: Record<string, any> = {},
  config: Omit<FetchConfig, 'method' | 'body'> = {}
): Promise<ApiResponse<any>> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    // Add additional form data
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
    });

    // Create headers without Content-Type to let browser set it with boundary for FormData
    const uploadConfig = { ...config };
    if (uploadConfig.headers) {
      const headers = { ...uploadConfig.headers } as Record<string, string>;
      delete headers['Content-Type'];
      uploadConfig.headers = headers;
    }
    
    return apiCall(url, {
      ...uploadConfig,
      method: 'POST',
      body: formData,
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'File upload failed',
    };
  }
};

// Batch API calls helper
export const apiBatch = async <T>(
  requests: Array<{ url: string; config?: FetchConfig }>,
  concurrent: boolean = false
): Promise<Array<ApiResponse<T>>> => {
  if (concurrent) {
    // Execute all requests concurrently
    const promises = requests.map(({ url, config }) => apiCall<T>(url, config));
    return Promise.all(promises);
  } else {
    // Execute requests sequentially
    const results: Array<ApiResponse<T>> = [];
    for (const { url, config } of requests) {
      const result = await apiCall<T>(url, config);
      results.push(result);
      
      // Stop on first error (optional behavior)
      if (!result.success) {
        break;
      }
    }
    return results;
  }
};

// URL building helpers
export const buildUrl = (base: string, path: string, params?: Record<string, any>): string => {
  const baseUrl = base.endsWith('/') ? base.slice(0, -1) : base;
  const fullPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${fullPath}`;

  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    return `${url}?${searchParams.toString()}`;
  }

  return url;
};

// Query string helpers
export const serializeQuery = (params: Record<string, any>): string => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach(item => searchParams.append(key, String(item)));
      } else {
        searchParams.append(key, String(value));
      }
    }
  });
  return searchParams.toString();
};

// Error handling utilities
export const isNetworkError = (error: ApiError): boolean => {
  return error.message.includes('fetch') || 
         error.message.includes('network') || 
         error.message.includes('timeout');
};

export const isServerError = (error: ApiError): boolean => {
  return error.statusCode ? error.statusCode >= 500 : false;
};

export const isClientError = (error: ApiError): boolean => {
  return error.statusCode ? error.statusCode >= 400 && error.statusCode < 500 : false;
};

// Response status helpers
export const isSuccessResponse = <T>(response: ApiResponse<T>): response is ApiResponse<T> & { success: true; data: T } => {
  return response.success === true && response.data !== undefined;
};

export const isErrorResponse = <T>(response: ApiResponse<T>): response is ApiResponse<T> & { success: false; error: string } => {
  return response.success === false && response.error !== undefined;
};

// Common API endpoints builder
export class ApiEndpoints {
  constructor(private baseUrl: string) {}

  // Group management endpoints
  groups = {
    list: () => buildUrl(this.baseUrl, '/api/groups'),
    create: () => buildUrl(this.baseUrl, '/api/groups'),
    get: (id: string) => buildUrl(this.baseUrl, `/api/groups/${id}`),
    update: (id: string) => buildUrl(this.baseUrl, `/api/groups/${id}`),
    delete: (id: string) => buildUrl(this.baseUrl, `/api/groups/${id}`),
    checkName: (name: string) => buildUrl(this.baseUrl, '/api/groups/check-name', { name }),
  };

  // File upload endpoints
  files = {
    upload: () => buildUrl(this.baseUrl, '/api/files/upload'),
    status: (id: string) => buildUrl(this.baseUrl, `/api/files/${id}/status`),
    download: (id: string) => buildUrl(this.baseUrl, `/api/files/${id}/download`),
  };

  // Prediction endpoints
  predictions = {
    create: () => buildUrl(this.baseUrl, '/api/predictions'),
    get: (id: string) => buildUrl(this.baseUrl, `/api/predictions/${id}`),
    list: (params?: Record<string, any>) => buildUrl(this.baseUrl, '/api/predictions', params),
  };

  // Session endpoints
  sessions = {
    create: () => buildUrl(this.baseUrl, '/api/sessions'),
    get: (id: string) => buildUrl(this.baseUrl, `/api/sessions/${id}`),
    update: (id: string) => buildUrl(this.baseUrl, `/api/sessions/${id}`),
    delete: (id: string) => buildUrl(this.baseUrl, `/api/sessions/${id}`),
    list: (params?: Record<string, any>) => buildUrl(this.baseUrl, '/api/sessions', params),
  };

  // Health check endpoints
  health = {
    check: () => buildUrl(this.baseUrl, '/api/health'),
    detailed: () => buildUrl(this.baseUrl, '/api/health/detailed'),
  };
}