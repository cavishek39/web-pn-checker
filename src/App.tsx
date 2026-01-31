import { useState, useEffect, useCallback } from 'react'
import './index.css'

interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

interface VapidConfig {
  publicKey: string
  privateKey: string
  subject: string
}

interface NotificationPayload {
  title: string
  body: string
  icon: string
  badge: string
  tag: string
}

interface PushResult {
  success: boolean
  statusCode?: number
  message: string
  details?: string
}

type TabType = 'subscription' | 'vapid' | 'payload'
type ThemeType = 'system' | 'light' | 'dark'

// Theme icons
const SunIcon = () => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
    <circle cx='12' cy='12' r='5' />
    <line x1='12' y1='1' x2='12' y2='3' />
    <line x1='12' y1='21' x2='12' y2='23' />
    <line x1='4.22' y1='4.22' x2='5.64' y2='5.64' />
    <line x1='18.36' y1='18.36' x2='19.78' y2='19.78' />
    <line x1='1' y1='12' x2='3' y2='12' />
    <line x1='21' y1='12' x2='23' y2='12' />
    <line x1='4.22' y1='19.78' x2='5.64' y2='18.36' />
    <line x1='18.36' y1='5.64' x2='19.78' y2='4.22' />
  </svg>
)

const MoonIcon = () => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
    <path d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' />
  </svg>
)

const SystemIcon = () => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
    <rect x='2' y='3' width='20' height='14' rx='2' ry='2' />
    <line x1='8' y1='21' x2='16' y2='21' />
    <line x1='12' y1='17' x2='12' y2='21' />
  </svg>
)

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('subscription')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PushResult | null>(null)
  const [saveVapid, setSaveVapid] = useState(true)
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [theme, setTheme] = useState<ThemeType>('system')

  // Form state
  const [subscription, setSubscription] = useState<PushSubscription>({
    endpoint: '',
    keys: { p256dh: '', auth: '' },
  })

  const [vapid, setVapid] = useState<VapidConfig>({
    publicKey: '',
    privateKey: '',
    subject: '',
  })

  const [payload, setPayload] = useState<NotificationPayload>({
    title: 'Test Notification',
    body: 'Web push token is working! 🎉',
    icon: '',
    badge: '',
    tag: '',
  })

  // Get effective theme based on system preference
  const getEffectiveTheme = useCallback(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }
    return theme
  }, [theme])

  // Apply theme to document
  useEffect(() => {
    const applyTheme = () => {
      const effectiveTheme = getEffectiveTheme()
      document.documentElement.setAttribute('data-theme', effectiveTheme)
    }

    applyTheme()

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme()
      }
    }
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, getEffectiveTheme])

  // Load saved theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as ThemeType | null
    if (savedTheme && ['system', 'light', 'dark'].includes(savedTheme)) {
      setTheme(savedTheme)
    }
  }, [])

  // Cycle through themes: system -> light -> dark -> system
  const cycleTheme = () => {
    const nextTheme: ThemeType =
      theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
    setTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)
  }

  // Get current theme icon
  const getThemeIcon = () => {
    if (theme === 'system') return <SystemIcon />
    if (theme === 'light') return <SunIcon />
    return <MoonIcon />
  }

  // Load saved config on mount
  useEffect(() => {
    const loadSavedConfig = async () => {
      try {
        const config = await window.electronAPI.loadConfig()
        if (config.vapid) {
          setVapid(config.vapid)
        }
        if (config.lastSubscription) {
          setSubscription(config.lastSubscription)
        }
        setConfigLoaded(true)
      } catch (error) {
        console.error('Failed to load config:', error)
        setConfigLoaded(true)
      }
    }
    loadSavedConfig()
  }, [])

  // Parse JSON subscription
  const handleJsonPaste = useCallback(() => {
    navigator.clipboard.readText().then((text) => {
      try {
        const json = JSON.parse(text)
        if (json.endpoint && json.keys) {
          setSubscription({
            endpoint: json.endpoint,
            keys: {
              p256dh: json.keys.p256dh || '',
              auth: json.keys.auth || '',
            },
          })
          setResult({
            success: true,
            message: 'Subscription parsed successfully!',
            details: 'Endpoint and keys have been filled in.',
          })
          setTimeout(() => setResult(null), 3000)
        } else {
          throw new Error('Invalid subscription format')
        }
      } catch {
        setResult({
          success: false,
          message: 'Invalid JSON format',
          details:
            'Make sure the clipboard contains a valid push subscription object.',
        })
      }
    })
  }, [])

  // Send push notification
  const handleSend = async () => {
    setLoading(true)
    setResult(null)

    try {
      // Validate inputs
      if (!subscription.endpoint) {
        throw new Error('Endpoint is required')
      }
      if (!subscription.keys.p256dh || !subscription.keys.auth) {
        throw new Error('p256dh and auth keys are required')
      }
      if (!vapid.publicKey || !vapid.privateKey) {
        throw new Error('VAPID public and private keys are required')
      }
      if (!vapid.subject) {
        throw new Error('Subject (email) is required')
      }
      if (!payload.title) {
        throw new Error('Notification title is required')
      }

      // Save config if enabled
      if (saveVapid) {
        await window.electronAPI.saveConfig({
          vapid,
          lastSubscription: subscription,
        })
      }

      // Send notification
      const response = await window.electronAPI.sendPush({
        subscription,
        vapid,
        payload: {
          title: payload.title,
          body: payload.body,
          icon: payload.icon || undefined,
          badge: payload.badge || undefined,
          tag: payload.tag || undefined,
        },
      })

      setResult(response)
    } catch (error) {
      setResult({
        success: false,
        message: 'Validation Error',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setLoading(false)
    }
  }

  // Check if form is valid
  const isValid =
    subscription.endpoint &&
    subscription.keys.p256dh &&
    subscription.keys.auth &&
    vapid.publicKey &&
    vapid.privateKey &&
    vapid.subject &&
    payload.title

  return (
    <div className='app'>
      <header className='header'>
        <h1>Avishek Web Push Tester</h1>
        <p>Test your push notification tokens</p>
        <button
          className='theme-toggle'
          onClick={cycleTheme}
          title={`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`}>
          {getThemeIcon()}
        </button>
      </header>

      <main className='content'>
        {/* Tabs */}
        <div className='tabs'>
          <button
            className={`tab ${activeTab === 'subscription' ? 'active' : ''}`}
            onClick={() => setActiveTab('subscription')}>
            Token
          </button>
          <button
            className={`tab ${activeTab === 'vapid' ? 'active' : ''}`}
            onClick={() => setActiveTab('vapid')}>
            VAPID
          </button>
          <button
            className={`tab ${activeTab === 'payload' ? 'active' : ''}`}
            onClick={() => setActiveTab('payload')}>
            Payload
          </button>
        </div>

        {/* Subscription Tab */}
        {activeTab === 'subscription' && (
          <div className='card fade-in'>
            <div className='section'>
              <div className='section-title'>
                <svg
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'>
                  <path d='M15 7h3a5 5 0 0 1 5 5 5 5 0 0 1-5 5h-3m-6 0H6a5 5 0 0 1-5-5 5 5 0 0 1 5-5h3' />
                  <line x1='8' y1='12' x2='16' y2='12' />
                </svg>
                Push Subscription
                <button className='json-paste-btn' onClick={handleJsonPaste}>
                  📋 Paste JSON
                </button>
              </div>

              <div className='form-group'>
                <label>Endpoint URL</label>
                <textarea
                  value={subscription.endpoint}
                  onChange={(e) =>
                    setSubscription((s) => ({ ...s, endpoint: e.target.value }))
                  }
                  placeholder='https://fcm.googleapis.com/fcm/send/...'
                  rows={3}
                />
              </div>

              <div className='form-group'>
                <label>p256dh Key</label>
                <input
                  type='text'
                  value={subscription.keys.p256dh}
                  onChange={(e) =>
                    setSubscription((s) => ({
                      ...s,
                      keys: { ...s.keys, p256dh: e.target.value },
                    }))
                  }
                  placeholder='Public key from subscription'
                />
              </div>

              <div className='form-group'>
                <label>Auth Secret</label>
                <input
                  type='text'
                  value={subscription.keys.auth}
                  onChange={(e) =>
                    setSubscription((s) => ({
                      ...s,
                      keys: { ...s.keys, auth: e.target.value },
                    }))
                  }
                  placeholder='Auth key from subscription'
                />
              </div>
            </div>
          </div>
        )}

        {/* VAPID Tab */}
        {activeTab === 'vapid' && (
          <div className='card fade-in'>
            <div className='section'>
              <div className='section-title'>
                <svg
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'>
                  <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
                  <path d='M7 11V7a5 5 0 0 1 10 0v4' />
                </svg>
                VAPID Configuration
                {configLoaded && vapid.publicKey && (
                  <span className='saved-indicator'>✓ Loaded</span>
                )}
              </div>

              <div className='form-group'>
                <label>Public Key</label>
                <textarea
                  value={vapid.publicKey}
                  onChange={(e) =>
                    setVapid((v) => ({ ...v, publicKey: e.target.value }))
                  }
                  placeholder='Your VAPID public key'
                  rows={2}
                />
              </div>

              <div className='form-group'>
                <label>Private Key</label>
                <div className='input-with-icon'>
                  <input
                    type={showPrivateKey ? 'text' : 'password'}
                    value={vapid.privateKey}
                    onChange={(e) =>
                      setVapid((v) => ({ ...v, privateKey: e.target.value }))
                    }
                    placeholder='Your VAPID private key'
                  />
                  <span
                    className='input-icon'
                    onClick={() => setShowPrivateKey(!showPrivateKey)}>
                    {showPrivateKey ? '🙈' : '👁️'}
                  </span>
                </div>
              </div>

              <div className='form-group'>
                <label>Subject (Email)</label>
                <input
                  type='email'
                  value={vapid.subject}
                  onChange={(e) =>
                    setVapid((v) => ({ ...v, subject: e.target.value }))
                  }
                  placeholder='mailto:your-email@example.com'
                />
                <p className='helper-text'>
                  Must be a mailto: URL or a https:// URL
                </p>
              </div>

              <div className='checkbox-group'>
                <input
                  type='checkbox'
                  id='saveVapid'
                  checked={saveVapid}
                  onChange={(e) => setSaveVapid(e.target.checked)}
                />
                <label htmlFor='saveVapid'>
                  Save VAPID keys locally (encrypted)
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Payload Tab */}
        {activeTab === 'payload' && (
          <div className='card fade-in'>
            <div className='section'>
              <div className='section-title'>
                <svg
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'>
                  <path d='M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0' />
                </svg>
                Notification Content
              </div>

              <div className='form-group'>
                <label>Title *</label>
                <input
                  type='text'
                  value={payload.title}
                  onChange={(e) =>
                    setPayload((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder='Notification title'
                />
              </div>

              <div className='form-group'>
                <label>Body</label>
                <textarea
                  value={payload.body}
                  onChange={(e) =>
                    setPayload((p) => ({ ...p, body: e.target.value }))
                  }
                  placeholder='Notification message body'
                  rows={2}
                />
              </div>

              <div className='form-group'>
                <label>Icon URL</label>
                <input
                  type='url'
                  value={payload.icon}
                  onChange={(e) =>
                    setPayload((p) => ({ ...p, icon: e.target.value }))
                  }
                  placeholder='https://example.com/icon.png'
                />
              </div>

              <div className='form-group'>
                <label>Badge URL</label>
                <input
                  type='url'
                  value={payload.badge}
                  onChange={(e) =>
                    setPayload((p) => ({ ...p, badge: e.target.value }))
                  }
                  placeholder='https://example.com/badge.png'
                />
              </div>

              <div className='form-group'>
                <label>Tag</label>
                <input
                  type='text'
                  value={payload.tag}
                  onChange={(e) =>
                    setPayload((p) => ({ ...p, tag: e.target.value }))
                  }
                  placeholder='notification-tag'
                />
                <p className='helper-text'>
                  Used to replace existing notifications with the same tag
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Send Button */}
        <button
          className={`send-btn ${loading ? 'loading' : ''}`}
          onClick={handleSend}
          disabled={loading || !isValid}>
          {loading ? (
            <>
              <span className='spinner'></span>
              Sending...
            </>
          ) : (
            <>🚀 Send Test Notification</>
          )}
        </button>

        {/* Result */}
        {result && (
          <div className={`result ${result.success ? 'success' : 'error'}`}>
            <div className='result-header'>
              <div className='result-icon'>
                {result.success ? (
                  <svg
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='3'>
                    <polyline points='20 6 9 17 4 12' />
                  </svg>
                ) : (
                  <svg
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='3'>
                    <line x1='18' y1='6' x2='6' y2='18' />
                    <line x1='6' y1='6' x2='18' y2='18' />
                  </svg>
                )}
              </div>
              <span className='result-message'>{result.message}</span>
            </div>
            {result.details && (
              <p className='result-details'>{result.details}</p>
            )}
            {result.statusCode && (
              <span className='result-status'>
                Status Code: {result.statusCode}
              </span>
            )}
          </div>
        )}
      </main>

      <div className='footer'>
        <span>v1.0.0</span>
        <span className='theme-label'>
          {theme === 'system' ? (
            <SystemIcon />
          ) : theme === 'light' ? (
            <SunIcon />
          ) : (
            <MoonIcon />
          )}
          {theme}
        </span>
      </div>
    </div>
  )
}

export default App
