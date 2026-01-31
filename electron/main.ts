import {
  app,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  Menu,
  dialog,
  shell,
} from 'electron'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'
import {
  sendPushNotification,
  SavedConfig,
  loadConfig,
  saveConfig,
} from './push-service'

let mainWindow: BrowserWindow | null = null

// Configure auto-updater
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

function setupAutoUpdater() {
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...')
  })

  autoUpdater.on('update-available', (info) => {
    dialog
      .showMessageBox(mainWindow!, {
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available!`,
        detail: 'Would you like to download it now?',
        buttons: ['Download', 'Later'],
        defaultId: 0,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate()
          dialog.showMessageBox(mainWindow!, {
            type: 'info',
            title: 'Downloading Update',
            message: 'The update is being downloaded in the background.',
            detail: "You will be notified when it's ready to install.",
          })
        }
      })
  })

  autoUpdater.on('update-not-available', () => {
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'No Updates',
      message: "You're running the latest version!",
      detail: `Current version: ${app.getVersion()}`,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    dialog
      .showMessageBox(mainWindow!, {
        type: 'info',
        title: 'Update Ready',
        message: `Version ${info.version} has been downloaded.`,
        detail:
          'The update will be installed when you restart the app. Would you like to restart now?',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall()
        }
      })
  })

  autoUpdater.on('error', (error) => {
    console.error('Auto-updater error:', error)
    dialog
      .showMessageBox(mainWindow!, {
        type: 'error',
        title: 'Update Error',
        message: 'Failed to check for updates',
        detail:
          error.message ||
          'Please try again later or download manually from GitHub.',
        buttons: ['Open GitHub Releases', 'OK'],
        defaultId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          shell.openExternal(
            'https://github.com/cavishek39/web-pn-checker/releases',
          )
        }
      })
  })
}

function createAppMenu() {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Check for Updates...',
                click: () => {
                  autoUpdater.checkForUpdates()
                },
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }]
          : [{ role: 'close' as const }]),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'GitHub Repository',
          click: () => {
            shell.openExternal('https://github.com/cavishek39/web-pn-checker')
          },
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal(
              'https://github.com/cavishek39/web-pn-checker/issues',
            )
          },
        },
        { type: 'separator' as const },
        {
          label: 'Check for Updates...',
          click: () => {
            autoUpdater.checkForUpdates()
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

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
  createAppMenu()
  createWindow()
  setupAutoUpdater()

  // Check for updates on startup (only in production)
  if (!process.env.VITE_DEV_SERVER_URL) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(console.error)
    }, 3000)
  }

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

ipcMain.handle('check-for-updates', async () => {
  return autoUpdater.checkForUpdates()
})

ipcMain.handle('get-app-version', async () => {
  return app.getVersion()
})
