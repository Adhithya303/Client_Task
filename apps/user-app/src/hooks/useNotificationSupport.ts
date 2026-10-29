import { useState, useEffect, useCallback } from 'react';
import type { BrowserCapability, PermissionState } from '../types';

export function getPermissionLabel(permission: PermissionState): string {
  switch (permission) {
    case 'default':
      return 'Not requested';
    case 'granted':
      return 'Granted';
    case 'denied':
      return 'Blocked';
    case 'unsupported':
    default:
      return 'Not supported';
  }
}

export function useNotificationSupport(): BrowserCapability {
  const evaluateCapabilities = useCallback((): BrowserCapability => {
    const hasNotificationApi = typeof window !== 'undefined' && 'Notification' in window;
    const hasServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    const isSecureContext = typeof window !== 'undefined' && Boolean(window.isSecureContext);

    let permission: PermissionState = 'unsupported';
    if (hasNotificationApi) {
      permission = Notification.permission as PermissionState;
    }

    const isFullyCapable = hasNotificationApi && hasServiceWorker && isSecureContext;

    return {
      hasNotificationApi,
      hasServiceWorker,
      isSecureContext,
      isFullyCapable,
      permission,
      permissionLabel: getPermissionLabel(permission),
    };
  }, []);

  const [capabilities, setCapabilities] = useState<BrowserCapability>(evaluateCapabilities);

  useEffect(() => {
    const update = () => {
      setCapabilities(evaluateCapabilities());
    };

    // Re-check when window regains focus (e.g. user updated site settings in browser chrome)
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);

    // If Permissions API is available, attach onchange listener
    let permissionStatus: PermissionStatus | null = null;
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions
        .query({ name: 'notifications' as PermissionName })
        .then((status) => {
          permissionStatus = status;
          status.onchange = update;
        })
        .catch(() => {
          // Permissions query not supported for 'notifications' in some browsers (e.g. older Safari)
        });
    }

    return () => {
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, [evaluateCapabilities]);

  return capabilities;
}
