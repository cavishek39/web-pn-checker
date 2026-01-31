import webpush from 'web-push'
import Store from 'electron-store'
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto'

// Encrypted store for VAPID keys
const store = new Store({
  name: 'push-tester-config',
  encryptionKey: 'avishek-web-push-tester-v1',
})

export interface SavedConfig {
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
}

// Simple encryption for extra security on private key
const ENCRYPTION_KEY = scryptSync('avishek-push-tester', 'salt', 32)

function encrypt(text: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

function decrypt(encryptedText: string): string {
  try {
    const [ivHex, encrypted] = encryptedText.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const decipher = createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    return ''
  }
}

export function loadConfig(): SavedConfig {
  const saved = store.get('config') as SavedConfig | undefined
  if (saved?.vapid?.privateKey) {
    try {
      saved.vapid.privateKey = decrypt(saved.vapid.privateKey)
    } catch {
      // If decryption fails, clear the config
      store.delete('config')
      return {}
    }
  }
  return saved || {}
}

export function saveConfig(config: SavedConfig): void {
  const toSave = { ...config }
  if (toSave.vapid?.privateKey) {
    toSave.vapid = {
      ...toSave.vapid,
      privateKey: encrypt(toSave.vapid.privateKey),
    }
  }
  store.set('config', toSave)
}

interface PushRequest {
  subscription: {
    endpoint: string
    keys: {
      p256dh: string
      auth: string
    }
    expirationTime?: number | null
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
}

interface PushResult {
  success: boolean
  statusCode?: number
  message: string
  details?: string
}

// Error messages for common status codes
const ERROR_MESSAGES: Record<number, { message: string; details: string }> = {
  201: {
    message: 'Push notification sent successfully!',
    details: 'The push service accepted the notification.',
  },
  400: {
    message: 'Invalid request',
    details:
      'The subscription or payload format is incorrect. Check endpoint and keys.',
  },
  401: {
    message: 'Unauthorized - VAPID key mismatch',
    details:
      "The VAPID public key doesn't match the one used when creating the subscription.",
  },
  403: {
    message: 'Forbidden',
    details: 'The subscription has expired or the user has revoked permission.',
  },
  404: {
    message: 'Subscription not found',
    details:
      'The push subscription no longer exists. The user may have unsubscribed.',
  },
  410: {
    message: 'Subscription expired',
    details:
      'This push subscription is no longer valid. Request a new subscription from the browser.',
  },
  413: {
    message: 'Payload too large',
    details: 'The notification payload exceeds the size limit (4KB).',
  },
  429: {
    message: 'Too many requests',
    details: "You've sent too many notifications. Wait before sending more.",
  },
}

export async function sendPushNotification(
  request: PushRequest,
): Promise<PushResult> {
  try {
    // Validate VAPID keys
    if (!request.vapid.publicKey || !request.vapid.privateKey) {
      return {
        success: false,
        message: 'Missing VAPID keys',
        details: 'Both public and private VAPID keys are required.',
      }
    }

    // Ensure subject has mailto: prefix
    let subject = request.vapid.subject
    if (!subject.startsWith('mailto:')) {
      subject = `mailto:${subject}`
    }

    // Set VAPID details
    webpush.setVapidDetails(
      subject,
      request.vapid.publicKey,
      request.vapid.privateKey,
    )

    // Prepare subscription object
    const subscription = {
      endpoint: request.subscription.endpoint,
      keys: {
        p256dh: request.subscription.keys.p256dh,
        auth: request.subscription.keys.auth,
      },
    }

    // Send notification
    const result = await webpush.sendNotification(
      subscription,
      JSON.stringify(request.payload),
    )

    return {
      success: true,
      statusCode: result.statusCode,
      message: '✅ Push notification sent successfully!',
      details: `Status: ${result.statusCode} - The notification was delivered to the push service.`,
    }
  } catch (error: unknown) {
    const webPushError = error as {
      statusCode?: number
      body?: string
      message?: string
    }
    const statusCode = webPushError.statusCode

    if (statusCode && ERROR_MESSAGES[statusCode]) {
      return {
        success: false,
        statusCode,
        message: ERROR_MESSAGES[statusCode].message,
        details: ERROR_MESSAGES[statusCode].details,
      }
    }

    // Parse error body if available
    let errorDetails = webPushError.message || 'Unknown error occurred'
    if (webPushError.body) {
      try {
        const bodyJson = JSON.parse(webPushError.body)
        errorDetails = bodyJson.message || bodyJson.error || webPushError.body
      } catch {
        errorDetails = webPushError.body
      }
    }

    return {
      success: false,
      statusCode,
      message: 'Push notification failed',
      details: errorDetails,
    }
  }
}
