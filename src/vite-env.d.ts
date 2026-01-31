/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    sendPush: (data: {
      subscription: {
        endpoint: string
        keys: {
          p256dh: string
          auth: string
        }
      }
      vapid: {
        publicKey: string
        privateKey: string
        subject: string
      }
      payload: {
        title: string
        body: string
        icon?: string
        badge?: string
        tag?: string
        data?: Record<string, unknown>
      }
    }) => Promise<{
      success: boolean
      statusCode?: number
      message: string
      details?: string
    }>
    loadConfig: () => Promise<{
      vapid?: {
        publicKey: string
        privateKey: string
        subject: string
      }
      lastSubscription?: {
        endpoint: string
        keys: {
          p256dh: string
          auth: string
        }
      }
    }>
    saveConfig: (config: {
      vapid?: {
        publicKey: string
        privateKey: string
        subject: string
      }
      lastSubscription?: {
        endpoint: string
        keys: {
          p256dh: string
          auth: string
        }
      }
    }) => Promise<void>
  }
}
