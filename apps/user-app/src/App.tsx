import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNotificationSupport } from './hooks/useNotificationSupport.ts';
import { Header } from './components/Header.tsx';
import { SetupProgress } from './components/SetupProgress.tsx';
import { BrowserSupportCard } from './components/BrowserSupportCard.tsx';
import { PermissionCard } from './components/PermissionCard.tsx';
import { FirebaseStatusCard } from './components/FirebaseStatusCard.tsx';
import {
  DeviceRegistrationCard,
  type BackendRegistrationStatus,
} from './components/DeviceRegistrationCard.tsx';
import { NotificationActionCard } from './components/NotificationActionCard.tsx';
import { NotificationInbox } from './components/NotificationInbox.tsx';
import { appConfig } from './config/env.ts';
import { checkIsMessagingSupported } from './services/firebase.ts';
import { requestFcmToken, subscribeToForegroundMessages } from './services/messaging.ts';
import { registerDeviceWithBackend } from './services/api.ts';
import type { InboxMessage, TokenStatus } from './types/index.ts';
import './styles/dashboard.css';

const MAX_INBOX_MESSAGES = 20;

export const App: React.FC = () => {
  const capabilities = useNotificationSupport();

  const [isMessagingSupported, setIsMessagingSupported] = useState<boolean | null>(null);
  const [swRegistered, setSwRegistered] = useState<boolean>(false);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>('idle');
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);

  // Backend registration state
  const [backendStatus, setBackendStatus] = useState<BackendRegistrationStatus>('idle');
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [backendErrorMessage, setBackendErrorMessage] = useState<string | null>(null);

  // Guard against concurrent requests and race conditions on token changes
  const isRequestingTokenRef = useRef<boolean>(false);
  const isRegisteringBackendRef = useRef<boolean>(false);
  const currentTokenRef = useRef<string | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  // 1. Initial check for Firebase messaging support
  useEffect(() => {
    checkIsMessagingSupported().then((supported) => {
      setIsMessagingSupported(supported);
    });

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration('/').then((reg) => {
        if (reg && reg.active) {
          setSwRegistered(true);
        }
      });
    }
  }, []);

  // 2. Setup foreground message listener once
  useEffect(() => {
    if (!appConfig.isFirebaseConfigComplete) {
      return;
    }

    const unsubscribe = subscribeToForegroundMessages((incomingMessage) => {
      if (seenMessageIdsRef.current.has(incomingMessage.id)) {
        return;
      }
      seenMessageIdsRef.current.add(incomingMessage.id);
      setMessages((prev) => [incomingMessage, ...prev].slice(0, MAX_INBOX_MESSAGES));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 3. Helper to register a token with backend
  const syncTokenWithBackend = useCallback(async (tokenToRegister: string) => {
    if (isRegisteringBackendRef.current) {
      return;
    }

    isRegisteringBackendRef.current = true;
    setBackendStatus('saving');
    setBackendErrorMessage(null);

    const result = await registerDeviceWithBackend(tokenToRegister);

    // Verify token hasn't changed while request was in-flight
    if (currentTokenRef.current === tokenToRegister) {
      if (result.success && result.registrationId) {
        setBackendStatus('saved');
        setRegistrationId(result.registrationId);
        setBackendErrorMessage(null);
      } else {
        setBackendStatus('error');
        setBackendErrorMessage(result.error || 'Failed to register token with backend');
      }
    }

    isRegisteringBackendRef.current = false;
  }, []);

  // 4. User action: "Enable notifications"
  const handleEnableNotifications = useCallback(async () => {
    if (isRequestingTokenRef.current) {
      return;
    }

    setErrorMessage(null);
    setTokenStatus('loading');
    isRequestingTokenRef.current = true;

    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          const decision = await Notification.requestPermission();
          if (decision === 'denied') {
            throw new Error(
              'Notification permission was blocked in browser settings. Please allow notifications from site settings and try again.'
            );
          }
          if (decision === 'default') {
            throw new Error('Notification permission request was dismissed.');
          }
        } else if (Notification.permission === 'denied') {
          throw new Error(
            'Notifications are currently blocked for this site. Open site settings to allow notifications.'
          );
        }
      }

      const token = await requestFcmToken();
      setFcmToken(token);
      currentTokenRef.current = token;
      setTokenStatus('success');
      setSwRegistered(true);

      // Automatically sync new token to backend
      await syncTokenWithBackend(token);
    } catch (err: unknown) {
      setTokenStatus('error');
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      isRequestingTokenRef.current = false;
    }
  }, [syncTokenWithBackend]);

  // 5. User action: "Retry registration" (backend only)
  const handleRetryBackend = useCallback(async () => {
    if (fcmToken) {
      await syncTokenWithBackend(fcmToken);
    }
  }, [fcmToken, syncTokenWithBackend]);

  const handleClearInbox = useCallback(() => {
    setMessages([]);
    seenMessageIdsRef.current.clear();
  }, []);

  return (
    <main className="dashboard-container" id="user-app-root">
      <Header />
      <SetupProgress />

      <div className="cards-grid">
        <BrowserSupportCard capabilities={capabilities} />
        <PermissionCard
          permission={capabilities.permission}
          permissionLabel={capabilities.permissionLabel}
          isSecureContext={capabilities.isSecureContext}
        />
        <FirebaseStatusCard
          config={appConfig}
          isMessagingSupported={isMessagingSupported}
          swRegistered={swRegistered}
          tokenGenerated={Boolean(fcmToken)}
        />
        <DeviceRegistrationCard
          status={backendStatus}
          registrationId={registrationId}
          errorMessage={backendErrorMessage}
          tokenGenerated={Boolean(fcmToken)}
          onRetry={handleRetryBackend}
        />
      </div>

      <NotificationActionCard
        onEnableNotifications={handleEnableNotifications}
        onRetryBackend={handleRetryBackend}
        tokenStatus={tokenStatus}
        backendStatus={backendStatus}
        token={fcmToken}
        errorMessage={errorMessage}
        backendErrorMessage={backendErrorMessage}
        permission={capabilities.permission}
        isConfigComplete={appConfig.isFirebaseConfigComplete}
      />

      <NotificationInbox messages={messages} onClear={handleClearInbox} />
    </main>
  );
};

export default App;
