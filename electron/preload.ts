import { contextBridge, ipcRenderer } from 'electron'

export interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  expirationTime?: number | null
}

export interface VapidConfig {
  publicKey: string
  privateKey: string
  subject: string
}

export interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: Record<string, unknown>
}

export interface PushResult {
  success: boolean
  statusCode?: number
  message: string
  details?: string
}

export interface SavedConfig {
  vapid?: VapidConfig
  lastSubscription?: PushSubscription
}

const electronAPI = {
  sendPush: (data: {
    subscription: PushSubscription
    vapid: VapidConfig
    payload: NotificationPayload
  }): Promise<PushResult> => ipcRenderer.invoke('send-push', data),

  loadConfig: (): Promise<SavedConfig> => ipcRenderer.invoke('load-config'),

  saveConfig: (config: SavedConfig): Promise<void> =>
    ipcRenderer.invoke('save-config', config),

  checkForUpdates: (): Promise<void> => ipcRenderer.invoke('check-for-updates'),

  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// Type declaration for renderer process
declare global {
  interface Window {
    electronAPI: typeof electronAPI
  }
}
