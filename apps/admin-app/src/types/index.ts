export interface FirebaseAdminStatus {
  state: 'initialized' | 'unavailable' | string
  reason: string | null
  message: string | null
}

export interface AdminStatus {
  backend: string
  mongodb: string
  firebase_admin: FirebaseAdminStatus
  notice: string
}

export interface DeviceItem {
  registration_id: string
  platform: string
  token_suffix: string
  created_at: string
  last_seen_at: string
  is_active: boolean
}

export interface DeviceListResponse {
  devices: DeviceItem[]
  total: number
  limit: number
  offset: number
}

export interface SendNotificationRequest {
  registration_id: string
  title: string
  body: string
}

export interface SendNotificationResponse {
  status: 'accepted'
  message_id: string
  registration_id: string
}

export interface SendHistoryItem {
  id: string
  registrationId: string
  deviceSuffix: string
  title: string
  body: string
  status: 'accepted' | 'failed'
  messageId?: string
  error?: string
  timestamp: string
}
