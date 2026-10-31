import { appConfig } from '../config/env.ts';

export interface DeviceRegisterApiResponse {
  status: 'registered';
  registration_id: string;
}

export interface RegisterResult {
  success: boolean;
  registrationId?: string;
  error?: string;
}

const REQUEST_TIMEOUT_MS = 8000;
const MAX_REGISTRATION_RETRIES = 2;

async function waitDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send an FCM registration token to the FastAPI backend.
 * Uses AbortController to enforce a reasonable timeout and includes automatic retry
 * for transient network or backend connection issues.
 */
export async function registerDeviceWithBackend(
  token: string,
  platform: 'web' | 'android' = 'web',
  maxRetries: number = MAX_REGISTRATION_RETRIES
): Promise<RegisterResult> {
  const baseUrl = appConfig.apiBaseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/api/devices/register`;

  let lastError = 'Failed to register token with backend.';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          platform,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `Server returned status ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData && typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          }
        } catch {
          // Non-JSON error body (e.g. proxy or 502/503 HTML)
        }

        // Retry only on server error 502/503/504
        if (response.status >= 500 && attempt < maxRetries) {
          lastError = errorMessage;
          await waitDelay(1000 * (attempt + 1));
          continue;
        }

        return { success: false, error: errorMessage };
      }

      const data = (await response.json()) as DeviceRegisterApiResponse;

      if (data.status === 'registered' && typeof data.registration_id === 'string') {
        return {
          success: true,
          registrationId: data.registration_id,
        };
      }

      return {
        success: false,
        error: 'Backend response did not match expected registration contract.',
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          lastError = 'Connection timed out while reaching backend. Please verify FastAPI is running.';
        } else {
          lastError = `Could not connect to backend at ${baseUrl}. Ensure FastAPI is started.`;
        }
      } else {
        lastError = 'An unexpected network error occurred.';
      }

      if (attempt < maxRetries) {
        await waitDelay(1000 * (attempt + 1));
        continue;
      }
    }
  }

  return {
    success: false,
    error: lastError,
  };
}

/**
 * Unregister a device token from the backend (marks token inactive in MongoDB).
 */
export async function unregisterDeviceWithBackend(token: string): Promise<RegisterResult> {
  const baseUrl = appConfig.apiBaseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/api/devices/unregister`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `Server returned status ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData && typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        }
      } catch {
        // Non-JSON error body
      }
      return { success: false, error: errorMessage };
    }

    return { success: true };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return {
          success: false,
          error: 'Connection timed out while unregistering token.',
        };
      }
      return {
        success: false,
        error: `Could not reach backend at ${baseUrl}.`,
      };
    }
    return {
      success: false,
      error: 'An unexpected network error occurred during unregistration.',
    };
  }
}

