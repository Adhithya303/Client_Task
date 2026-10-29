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

/**
 * Send an FCM registration token to the FastAPI backend.
 * Uses AbortController to enforce a reasonable timeout and never exposes raw server errors.
 */
export async function registerDeviceWithBackend(token: string): Promise<RegisterResult> {
  const baseUrl = appConfig.apiBaseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/api/devices/register`;

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
        platform: 'web',
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
        return {
          success: false,
          error: 'Connection timed out while reaching backend. Please verify FastAPI is running.',
        };
      }
      return {
        success: false,
        error: `Could not connect to backend at ${baseUrl}. Ensure FastAPI is started.`,
      };
    }
    return {
      success: false,
      error: 'An unexpected network error occurred.',
    };
  }
}
