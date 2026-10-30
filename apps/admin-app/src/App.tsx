import { useCallback, useState } from 'react'
import { Header } from './components/Header.tsx'
import { ConnectCard } from './components/ConnectCard.tsx'
import { StatusCard } from './components/StatusCard.tsx'
import { DeviceListCard } from './components/DeviceListCard.tsx'
import { ComposerCard } from './components/ComposerCard.tsx'
import { SendHistoryCard } from './components/SendHistoryCard.tsx'
import {
  ApiError,
  fetchDevices,
  sendNotification,
  verifyAdminKey,
} from './services/api.ts'
import type {
  AdminStatus,
  DeviceItem,
  DeviceListResponse,
  SendHistoryItem,
  SendNotificationResponse,
} from './types/index.ts'

const PAGE_LIMIT = 10
const MAX_HISTORY = 15

export function App() {
  // In-memory admin key - NEVER saved to localStorage/sessionStorage/cookies
  const [adminKey, setAdminKey] = useState<string | null>(null)
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  // Device list state
  const [deviceData, setDeviceData] = useState<DeviceListResponse | null>(null)
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [devicesError, setDevicesError] = useState<string | null>(null)
  const [pageOffset, setPageOffset] = useState(0)
  const [selectedDevice, setSelectedDevice] = useState<DeviceItem | null>(null)

  // Status refresh loading
  const [statusLoading, setStatusLoading] = useState(false)

  // Send state & session history
  const [isSending, setIsSending] = useState(false)
  const [sendHistory, setSendHistory] = useState<SendHistoryItem[]>([])

  // Disconnect handler: clears all in-memory keys and application state
  const handleDisconnect = useCallback((reasonMessage?: string) => {
    setAdminKey(null)
    setAdminStatus(null)
    setDeviceData(null)
    setSelectedDevice(null)
    setSendHistory([])
    setPageOffset(0)
    setConnectError(reasonMessage || null)
  }, [])

  // Device fetch helper
  const loadDevices = useCallback(
    async (key: string, offset: number) => {
      setDevicesLoading(true)
      setDevicesError(null)
      try {
        const result = await fetchDevices(key, PAGE_LIMIT, offset)
        setDeviceData(result)
        setPageOffset(offset)

        // If previously selected device is in the new page, keep it synced
        if (selectedDevice) {
          const matching = result.devices.find(
            (d) => d.registration_id === selectedDevice.registration_id
          )
          if (matching) {
            setSelectedDevice(matching)
          }
        }
      } catch (err: unknown) {
        if (err instanceof ApiError && err.isAuthError) {
          handleDisconnect('Admin session expired or rejected. Please re-enter your key.')
          return
        }
        setDevicesError(err instanceof Error ? err.message : String(err))
      } finally {
        setDevicesLoading(false)
      }
    },
    [handleDisconnect, selectedDevice]
  )

  // Connect handler
  const handleConnect = async (key: string) => {
    setIsConnecting(true)
    setConnectError(null)

    try {
      const status = await verifyAdminKey(key)
      setAdminKey(key)
      setAdminStatus(status)
      // Automatically load initial page of devices
      await loadDevices(key, 0)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to connect to backend.'
      setConnectError(message)
    } finally {
      setIsConnecting(false)
    }
  }

  // Refresh status
  const handleRefreshStatus = async () => {
    if (!adminKey) return
    setStatusLoading(true)
    try {
      const status = await verifyAdminKey(adminKey)
      setAdminStatus(status)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.isAuthError) {
        handleDisconnect('Admin session rejected during status refresh.')
        return
      }
    } finally {
      setStatusLoading(false)
    }
  }

  // Refresh devices
  const handleRefreshDevices = () => {
    if (!adminKey) return
    loadDevices(adminKey, pageOffset)
  }

  // Handle page change
  const handlePageChange = (newOffset: number) => {
    if (!adminKey) return
    loadDevices(adminKey, newOffset)
  }

  // Send notification handler
  const handleSendNotification = async (payload: {
    registration_id: string
    title: string
    body: string
  }): Promise<SendNotificationResponse> => {
    if (!adminKey) {
      throw new Error('Not connected to backend.')
    }

    setIsSending(true)
    const targetSuffix = selectedDevice?.token_suffix || payload.registration_id.slice(-6)
    const historyId = `send_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const nowTime = new Date().toLocaleTimeString()

    try {
      const response = await sendNotification(adminKey, payload)

      // Add to session history
      setSendHistory((prev) => [
        {
          id: historyId,
          registrationId: payload.registration_id,
          deviceSuffix: targetSuffix,
          title: payload.title,
          body: payload.body,
          status: 'accepted',
          messageId: response.message_id,
          timestamp: nowTime,
        },
        ...prev.slice(0, MAX_HISTORY - 1),
      ])

      return response
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)

      // Add failed attempt to history
      setSendHistory((prev) => [
        {
          id: historyId,
          registrationId: payload.registration_id,
          deviceSuffix: targetSuffix,
          title: payload.title,
          body: payload.body,
          status: 'failed',
          error: errorMsg,
          timestamp: nowTime,
        },
        ...prev.slice(0, MAX_HISTORY - 1),
      ])

      // If token was reported unregistered (410), refresh devices so it displays as inactive
      if (err instanceof ApiError && err.status === 410) {
        loadDevices(adminKey, pageOffset)
      }

      // If auth was rejected (401), disconnect
      if (err instanceof ApiError && err.isAuthError) {
        handleDisconnect('Admin key rejected during dispatch.')
      }

      throw err
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="admin-container">
      <Header
        isConnected={adminKey !== null}
        onDisconnect={() => handleDisconnect()}
      />

      {!adminKey ? (
        <ConnectCard
          onConnect={handleConnect}
          isConnecting={isConnecting}
          error={connectError}
        />
      ) : (
        <main>
          {/* Status Section */}
          <StatusCard
            status={adminStatus}
            isLoading={statusLoading}
            onRefresh={handleRefreshStatus}
          />

          {/* Registered Devices Section */}
          <DeviceListCard
            deviceData={deviceData}
            isLoading={devicesLoading}
            error={devicesError}
            selectedDevice={selectedDevice}
            onSelectDevice={(device) => setSelectedDevice(device)}
            onRefresh={handleRefreshDevices}
            pageLimit={PAGE_LIMIT}
            pageOffset={pageOffset}
            onPageChange={handlePageChange}
          />

          {/* Notification Composer Section */}
          <ComposerCard
            selectedDevice={selectedDevice}
            onSend={handleSendNotification}
            isSending={isSending}
          />

          {/* Send History Section */}
          <SendHistoryCard
            history={sendHistory}
            onClearHistory={() => setSendHistory([])}
          />
        </main>
      )}
    </div>
  )
}
export default App
