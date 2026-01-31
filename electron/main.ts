import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { join } from 'path'
import {
  sendPushNotification,
  SavedConfig,
  loadConfig,
  saveConfig,
} from './push-service'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  // Follow system theme preference
  nativeTheme.themeSource = 'system'

  mainWindow = new BrowserWindow({
    width: 420,
    height: 680,
    minWidth: 380,
    minHeight: 600,
    maxWidth: 500,
    maxHeight: 800,
    resizable: true,
    frame: true,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // Set window title
  mainWindow.setTitle('Avishek Web Push Tester')

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Handlers
ipcMain.handle(
  'send-push',
  async (
    _event,
    data: {
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
    },
  ) => {
    return await sendPushNotification(data)
  },
)

ipcMain.handle('load-config', async () => {
  return loadConfig()
})

ipcMain.handle('save-config', async (_event, config: SavedConfig) => {
  return saveConfig(config)
})
