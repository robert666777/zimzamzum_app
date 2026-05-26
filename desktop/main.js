import { app, BrowserWindow, Menu, ipcMain, dialog, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import isDev from 'electron-is-dev';
import Store from 'electron-store';
import constants from './electron/utils/constants.js';
import { spawn, exec, execSync } from 'child_process';
import { generatePKCE } from './electron/utils/oauth.js';
import express from 'express';
import kill from 'tree-kill';
import url from 'url';
import http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { setupBackgroundMode, isBackgroundModeReady } from './electron/utils/wslSetup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store();

const ADMIN_PASSWORD = 'ZimZamZum@2024!SuperSecure';

const PLAN_DURATIONS = {
  free: 1,       // 1 jour de free trial
  starter: 30,   // 30 jours
  semester: 180, // 6 mois
  annual: 365    // 1 an
};

let mainWindow;
let overlayWindow;
let aiagentProcess;
let backgroundAuthWindow;
let bgAuthProcess;
let bgAgentWindow;
let bgSetupWindow;
let adminWindow;
let taskActiveOverlayWindow = null;
let readyToClose = false;

function ensureDeviceId() {
  let deviceId = store.get(constants.DEVICE_ID_STORE_KEY);
  if (!deviceId) {
    deviceId = uuidv4();
    store.set(constants.DEVICE_ID_STORE_KEY, deviceId);
    console.log(`[Device ID created]: ${deviceId}`);
  } else {
    console.log(`[Device ID exists]: ${deviceId}`);
  }
}


ipcMain.on('set-token', (_, token) => {
  store.set(constants.ACCESS_TOKEN_STORE_KEY, token);
  if (!overlayWindow) {
    createOverlayWindow();
  }
});

ipcMain.handle('get-token', () => store.get(constants.ACCESS_TOKEN_STORE_KEY));
ipcMain.on('delete-token', () => {
  store.delete(constants.ACCESS_TOKEN_STORE_KEY);
  hideTaskIndicatorWindow();
  if (overlayWindow) {
    overlayWindow.close();
  }
});
ipcMain.on('set-refresh-token', (_, token) => store.set(constants.REFRESH_TOKEN_STORE_KEY, token));
ipcMain.handle('get-refresh-token', () => store.get(constants.REFRESH_TOKEN_STORE_KEY));
ipcMain.on('delete-refresh-token', () => store.delete(constants.REFRESH_TOKEN_STORE_KEY));

ipcMain.handle('get-pending-payments', () => {
  return store.get('pendingPayments', []);
});

ipcMain.on('add-pending-payment', (_, payment) => {
  const payments = store.get('pendingPayments', []);
  payments.push(payment);
  store.set('pendingPayments', payments);
});

ipcMain.on('confirm-payment', (_, paymentId) => {
  const payments = store.get('pendingPayments', []);
  const updated = payments.map(p => 
    p.id === paymentId ? { ...p, status: 'confirmed', confirmedAt: new Date().toISOString() } : p
  );
  store.set('pendingPayments', updated);
  
  const payment = payments.find(p => p.id === paymentId);
  if (payment) {
    const userId = payment.userId || 'guest';
    store.set(`userPlan_${userId}`, {
      plan: payment.plan,
      startedAt: new Date().toISOString(),
      userId: userId,
      expiresAt: calculateExpirationDate(payment.plan)
    });
  }
});

function calculateExpirationDate(plan) {
  const duration = PLAN_DURATIONS[plan] || 1;
  const expiration = new Date();
  expiration.setDate(expiration.getDate() + duration);
  return expiration.toISOString();
}

ipcMain.handle('get-user-plan', (_, userId) => {
  const id = userId || 'guest';
  let userPlan = store.get(`userPlan_${id}`, null);
  
  if (!userPlan) {
    const startedAt = new Date().toISOString();
    const expiresAt = calculateExpirationDate('free');
    userPlan = { plan: 'free', startedAt, expiresAt, userId: id };
    store.set(`userPlan_${id}`, userPlan);
  }
  
  const isExpired = isPlanExpired(userPlan);
  return { ...userPlan, isExpired };
});

function isPlanExpired(userPlan) {
  if (!userPlan.expiresAt) return false;
  return new Date(userPlan.expiresAt) < new Date();
}

ipcMain.handle('check-plan-expired', (_, userId) => {
  const id = userId || 'guest';
  const userPlan = store.get(`userPlan_${id}`, null);
  if (!userPlan) return false;
  return isPlanExpired(userPlan);
});

ipcMain.handle('get-plan-countdown', (_, userId) => {
  const id = userId || 'guest';
  const userPlan = store.get(`userPlan_${id}`, null);
  if (!userPlan || !userPlan.expiresAt) {
    return { days: 0, hours: 0, minutes: 0, expired: true };
  }
  
  const now = new Date();
  const expires = new Date(userPlan.expiresAt);
  const diff = expires.getTime() - now.getTime();
  
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, expired: true };
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return { days, hours, minutes, expired: false };
});

ipcMain.handle('extend-plan-by-days', (_, userId, daysToAdd) => {
  const id = userId || 'guest';
  let userPlan = store.get(`userPlan_${id}`, null);
  
  if (!userPlan) {
    const startedAt = new Date().toISOString();
    const expiresAt = calculateExpirationDate('free');
    userPlan = { plan: 'free', startedAt, expiresAt, userId: id };
  }
  
  // Étendre la date d'expiration
  const currentExpires = new Date(userPlan.expiresAt);
  currentExpires.setDate(currentExpires.getDate() + daysToAdd);
  userPlan.expiresAt = currentExpires.toISOString();
  
  store.set(`userPlan_${id}`, userPlan);
  return userPlan;
});

ipcMain.on('set-user-plan', (_, planData) => {
  const userId = planData.userId || 'guest';
  store.set(`userPlan_${userId}`, planData);
});

ipcMain.handle('verify-admin-password', (_, password) => {
  return password === ADMIN_PASSWORD;
});

ipcMain.on('expand-overlay', (_, hasSuggestions) => {
  console.log("[Main Process] Received 'expand-overlay' IPC message.");
  expandMinimizeOverlay(true, hasSuggestions);
});

ipcMain.handle('get-last-background-mode-value', () => store.get(constants.LAST_BACKGROUND_MODE_VALUE));
ipcMain.handle('get-last-thinking-mode-value', () => store.get(constants.LAST_THINKING_MODE_VALUE));
ipcMain.on('set-last-thinking-mode-value', (_, lastThinkingModeValue) => store.set(constants.LAST_THINKING_MODE_VALUE, lastThinkingModeValue));

// Handle MINIMIZE request
ipcMain.on('minimize-overlay', () => {
  console.log("[Main Process] Received 'minimize-overlay' IPC message.");
  expandMinimizeOverlay(false);
});

ipcMain.on('open-thread-in-main', (_, threadId) => {
  expandMinimizeOverlay(false);
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('navigate-to-thread', threadId);
  }
});

ipcMain.handle('check-background-ready', () => {
  return isBackgroundModeReady();
});

ipcMain.handle('start-background-setup', async () => {
  // Prevent duplicate windows
  if (bgSetupWindow && !bgSetupWindow.isDestroyed()) {
    bgSetupWindow.focus();
    return;
  }

  bgSetupWindow = new BrowserWindow({
    width: 600,
    height: 300,
    title: 'Setting up Background Mode',
    resizable: false,
    modal: true,
    icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'electron', 'preload.js'),
      contextIsolation: true,
    },
  });

  const bgSetupUrl = isDev
    ? 'http://localhost:6763/#/background-setup'
    : `file://${path.join(__dirname, 'neuralagent-app', 'build', 'index.html')}#/background-setup`;

  bgSetupWindow.loadURL(bgSetupUrl);

  bgSetupWindow.on('closed', () => {
    bgSetupWindow = null;
  });

  const defaultErr = 'Setup Failed: Please ensure you have Windows 10 or higher and that virtualization is enabled in BIOS.';

  let result = { success: false, error: defaultErr };

  try {
    result = await setupBackgroundMode({
      onStatus: (msg) => {
        if (!bgSetupWindow?.isDestroyed()) {
          bgSetupWindow.webContents.send('setup-status', msg);
        }
      },
      onProgress: (pct) => {
        if (!bgSetupWindow?.isDestroyed()) {
          bgSetupWindow.webContents.send('setup-progress', pct);
        }
      },
    });
  } catch (err) {
    console.error('❌ Setup failed:', err);
    result = {
      success: false,
      error: err?.message || defaultErr,
    };
  }

  if (bgSetupWindow && !bgSetupWindow.isDestroyed()) {
    bgSetupWindow.webContents.send('setup-complete', result);
  }

  if (result.success) {
    launchBackgroundAuthWindow();
  }

  return result;
});


ipcMain.handle('get-suggestions', async (_, baseURL) => {
  // Suggestor disabled - return empty suggestions to avoid errors
  return { suggestions: [] };
});

ipcMain.on('test-scheduled-task', (_, task) => {
  console.log('[Scheduler] Test task received:', task);
  triggerScheduledTask(task);
});

ipcMain.handle('get-pending-scheduled-task', () => {
  const pendingTask = store.get('pending-scheduled-task');
  console.log('[Scheduler] Getting pending task:', pendingTask ? 'found' : 'none');
  return pendingTask ? JSON.parse(pendingTask) : null;
});

ipcMain.on('clear-pending-scheduled-task', () => {
  store.delete('pending-scheduled-task');
  console.log('[Scheduler] Pending task cleared');
});

ipcMain.on('launch-ai-agent', async (_, baseURL, threadId, backgroundMode) => {
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  store.set(constants.LAST_BACKGROUND_MODE_VALUE, backgroundMode.toString());

  if (!backgroundMode) {
    aiagentProcess = spawn(isWindows ? './aiagent/venv/Scripts/python' : './aiagent/venv/bin/python', ['./aiagent/main.py'], {
      env: {
        NEURALAGENT_API_URL: baseURL,
        NEURALAGENT_THREAD_ID: threadId,
        NEURALAGENT_USER_ACCESS_TOKEN: store.get(constants.ACCESS_TOKEN_STORE_KEY),
        PYTHONUTF8: '1',
      },
    });

    // const agentPath = isDev
    // ? path.join(__dirname, 'agent_build', isWindows ? 'agent.exe' : 'agent')
    // : path.join(process.resourcesPath, isWindows ? 'agent.exe' : 'agent');

    // aiagentProcess = spawn(agentPath, [], {
    //   env: {
    //     NEURALAGENT_API_URL: baseURL,
    //     NEURALAGENT_THREAD_ID: threadId,
    //     NEURALAGENT_USER_ACCESS_TOKEN: store.get(constants.ACCESS_TOKEN_STORE_KEY),
    //   },
    // });
    mainWindow?.minimize();
  } else {
    // VERY IMPORTANT
    const envVars = {
      NEURALAGENT_API_URL: baseURL, // 'http://192.168.8.101:8000',
      NEURALAGENT_THREAD_ID: threadId,
      NEURALAGENT_USER_ACCESS_TOKEN: store.get(constants.ACCESS_TOKEN_STORE_KEY),
      SKIP_LLM_API_KEY_VERIFICATION: 'true',
      PYTHONUTF8: '1',
    };

    const shellCommand = Object.entries(envVars)
      .map(([k, v]) => `${k}="${v}"`).join(' ') + ' bash /agent/launch_bg_agent.sh';

    aiagentProcess = spawn('wsl', ['-d', 'NeuralOS', '--', 'bash', '-c', shellCommand]);

    launchBackgroundAgentWindow();
  }

  mainWindow?.webContents.send('ai-agent-launch', threadId);
  overlayWindow?.webContents.send('ai-agent-launch', threadId);
  showTaskIndicatorWindow();
  expandMinimizeOverlay(true, false);

  aiagentProcess.stdout.on('data', (data) => console.log(`[Agent stdout]: ${data}`));
  aiagentProcess.stderr.on('data', (data) => console.error(`[Agent stderr]: ${data}`));

  aiagentProcess.on('error', err => {
    console.error('❌  Agent process failed to start:', err);
    mainWindow?.webContents.send('trigger-cancel-all-tasks');
  });

  aiagentProcess.on('exit', (code, signal) => {
    console.log(`[Agent exited with code ${code}]`);
    if (bgAgentWindow) {
      bgAgentWindow.close();
    }
    cleanupBGAgent();
    if (mainWindow?.isMinimized()) {
      mainWindow.restore();
    }
    if (mainWindow) {
      mainWindow.focus();
    }
    mainWindow?.webContents.send('ai-agent-exit');
    overlayWindow?.webContents.send('ai-agent-exit');
    hideTaskIndicatorWindow();

    if (code !== 0 || signal) {
      mainWindow?.webContents.send('trigger-cancel-all-tasks');
    }
    aiagentProcess = null;
  });
});

ipcMain.on('stop-ai-agent', () => {
  if (aiagentProcess && !aiagentProcess.killed) {
    kill(aiagentProcess.pid, 'SIGKILL', (err) => {
      if (err) console.error('❌ Failed to kill agent:', err);
      else console.log('[✅ Agent forcibly stopped]');
    });
  }
  aiagentProcess = null;
  cleanupBGAgent();
  hideTaskIndicatorWindow();
});

const GOOGLE_CLIENT_ID = '296264060339-jamhdgfckblr0qgq360t5ok4e1kede35.apps.googleusercontent.com';
const REDIRECT_URI = 'http://127.0.0.1:36478';

function openUrlInBrowser(targetUrl) {
  const platform = process.platform;
  const command =
    platform === 'win32'
      ? `start "" "${targetUrl}"`
      : platform === 'darwin'
      ? `open "${targetUrl}"`
      : `xdg-open "${targetUrl}"`;
  exec(command);
}

ipcMain.handle('login-with-google', async () => {
  const { codeVerifier, codeChallenge } = generatePKCE();

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=openid%20email%20profile` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256` +
    `&access_type=offline`;

  openUrlInBrowser(authUrl);

  const appExpress = express();

  return new Promise((resolve, reject) => {
    const server = appExpress.listen(36478, () => {
      console.log('Listening for Google OAuth callback...');
    });

    appExpress.get('/', (req, res) => {
      const code = req.query.code;
      if (!code) {
        res.send('Login failed.');
        server.close();
        return reject('No code received');
      }

      res.send('Login successful! You can close this window.');
      server.close();
      resolve({ code, codeVerifier });
    });
  });
});

const SCHEDULED_WORKFLOWS_KEY = 'neuralagent.scheduledWorkflows.v1';

const LAST_RUN_KEY_PREFIX = 'neuralagent.scheduledTaskLastRun.';

function shouldRunScheduledTask(task) {
  if (task.status !== 'active') {
    console.log(`[Scheduler] ${task.name}: Status is not active`);
    return false;
  }
  
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentSecond = now.getSeconds();
  const currentDay = now.getDay();
  
  if (task.frequency === 'every_hour') {
    if (currentMinute === 0) {
      const lastRun = store.get(LAST_RUN_KEY_PREFIX + task.id);
      if (lastRun) {
        const lastRunDate = new Date(lastRun);
        const hoursDiff = (now - lastRunDate) / (1000 * 60 * 60);
        if (hoursDiff < 1) {
          console.log(`[Scheduler] ${task.name}: Last run was ${hoursDiff.toFixed(1)}h ago, waiting 1h`);
          return false;
        }
      }
      return true;
    }
    return false;
  }
  
  if (!task.time) {
    console.log(`[Scheduler] ${task.name}: No time specified`);
    return false;
  }
  
  const [taskHour, taskMinute] = task.time.split(':').map(Number);
  
  console.log(`[Scheduler] Checking ${task.name}: Current ${currentHour}:${currentMinute}:${currentSecond}, Target ${taskHour}:${taskMinute}`);
  
  const isCorrectTime = (
    currentHour === taskHour && 
    currentMinute === taskMinute
  );
  
  if (!isCorrectTime) {
    console.log(`[Scheduler] ${task.name}: Not time yet (current ${currentHour}:${currentMinute} != target ${taskHour}:${taskMinute})`);
    return false;
  }
  
  // Vérifie qu'on exécute la tâche seulement une fois par minute
  const lastRun = store.get(LAST_RUN_KEY_PREFIX + task.id);
  if (lastRun) {
    const lastRunDate = new Date(lastRun);
    const secondsDiff = (now - lastRunDate) / 1000;
    if (secondsDiff < 30) {
      console.log(`[Scheduler] ${task.name}: Already ran recently (${secondsDiff.toFixed(0)}s ago)`);
      return false;
    }
  }
  
  if (task.frequency === 'daily') {
    console.log(`[Scheduler] ${task.name}: Should run now!`);
    return true;
  }
  
  if (task.frequency === 'specific_days') {
    const shouldRun = Array.isArray(task.daysOfWeek) && task.daysOfWeek.includes(currentDay);
    if (!shouldRun) {
      console.log(`[Scheduler] ${task.name}: Today (${currentDay}) is not in scheduled days`);
    }
    return shouldRun;
  }
  
  return false;
}

function triggerScheduledTask(task) {
  store.set(LAST_RUN_KEY_PREFIX + task.id, new Date().toISOString());
  
  const fullTaskDetails = `${task.description || task.name || 'No description'}
  
Platform: ${task.platformName || task.platformId || 'None'}
Login URL: ${task.platformLoginUrl || 'None'}
Username: ${task.platformUsername || 'None'}
Password: ${task.platformPassword ? '••••••••' : 'None'}`;
  
  const taskToExecute = {
    task: fullTaskDetails,
    background_mode: task.backgroundMode || false,
    extended_thinking_mode: false,
  };
  
  console.log(`[Scheduler] Task content preview: ${fullTaskDetails.substring(0, 100)}...`);
  
  if (mainWindow) {
    console.log('[Scheduler] Sending to frontend via IPC');
    mainWindow.webContents.send('scheduled-task-ready', taskToExecute);
  }
  
  console.log(`[Scheduler] Task triggered successfully: ${task.name}`);
}

let schedulerInterval = null;

function startScheduler() {
  if (schedulerInterval) return;
  
  schedulerInterval = setInterval(() => {
    try {
      const raw = store.get(SCHEDULED_WORKFLOWS_KEY);
      if (!raw) {
        console.log('[Scheduler] No tasks found in electron-store');
        return;
      }
      
      const tasks = JSON.parse(raw);
      if (!Array.isArray(tasks)) {
        console.log('[Scheduler] Tasks is not an array');
        return;
      }
      
      console.log(`[Scheduler] Checking ${tasks.length} tasks...`);
      
      tasks.forEach(task => {
        if (shouldRunScheduledTask(task)) {
          triggerScheduledTask(task);
        }
      });
    } catch (error) {
      console.error('[Scheduler] Error checking scheduled tasks:', error);
    }
  }, 1000);
}

function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

ipcMain.on('schedule-task-triggered', (_, taskData) => {
  triggerScheduledTask(taskData);
});

ipcMain.on('sync-scheduled-tasks', (_, tasks) => {
  try {
    store.set(SCHEDULED_WORKFLOWS_KEY, JSON.stringify(tasks));
    console.log(`[Scheduler] Synced ${tasks.length} tasks`);
  } catch (error) {
    console.error('[Scheduler] Failed to sync tasks:', error);
  }
});

ipcMain.on('test-scheduled-task', (_, task) => {
  console.log(`[Scheduler] Test running task: ${task.name}`);
  triggerScheduledTask(task);
});

const createAppMenu = () => {
  const template = [
    {
      label: 'App',
      submenu: [
        {
          label: 'Background Mode Authentication',
          click: () => {
            if ((aiagentProcess && !aiagentProcess.killed) || (bgAuthProcess && !bgAuthProcess.killed)) {
              return;
            }
            launchBackgroundAuthWindow();
          },
        },
        {
          label: 'Admin Panel',
          click: () => {
            launchAdminWindow();
          },
        },
        {
          label: 'Logout',
          click: () => {
            if (overlayWindow) {
              overlayWindow.close();
            }
            mainWindow?.webContents.send('trigger-logout');
          },
        },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'togglefullscreen' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

function startBackgroundAuthServices() {
  bgAuthProcess = spawn('wsl', ['-d', 'NeuralOS', '--', 'bash', '/agent/background_mode_authentication.sh']);

  bgAuthProcess.stdout.on('data', data => {
    console.log(`[BG Auth]: ${data.toString()}`);
  });

  bgAuthProcess.stderr.on('data', data => {
    console.error(`[BG Auth ERROR]: ${data.toString()}`);
  });
}

function cleanupBackgroundAuthServices() {
  try {
    execSync('wsl -d NeuralOS -- bash /agent/background_mode_authentication_cleanup.sh');
    console.log('[BG Auth]: Cleanup script executed.');
  } catch (err) {
    console.error('[BG Auth]: Cleanup failed:', err);
  }

  if (bgAuthProcess) {
    if (!bgAuthProcess.killed) {
      bgAuthProcess.kill('SIGKILL');
    }
  }
  bgAuthProcess = null;
}

function cleanupBGAgent() {
  try {
    execSync('wsl -d NeuralOS -- bash /agent/stop_bg_agent.sh');
    console.log('[BG Agent]: Cleanup script executed.');
  } catch (err) {
    // Ignore WSL errors for users without WSL/NeuralOS setup
    if (!err.message.includes('wsl: unknown distribution') && !err.message.includes('No such file or directory')) {
      console.error('[BG Agent]: Cleanup failed:', err);
    }
  }

  if (aiagentProcess) {
    if (!aiagentProcess.killed) {
      aiagentProcess.kill('SIGKILL');
    }
  }
}

function waitForNoVNCPortReady(port, timeout = 10000, interval = 300) {
  const deadline = Date.now() + timeout;

  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get({ hostname: '127.0.0.1', port, path: '/', timeout: 1000 }, (res) => {
        res.destroy();
        resolve(true); // Port is ready
      });

      req.on('error', (err) => {
        if (Date.now() > deadline) return reject(new Error('Timed out waiting for noVNC'));
        setTimeout(check, interval);
      });

      req.end();
    };

    check();
  });
}

function launchBackgroundAuthWindow() {
  if (backgroundAuthWindow) return;

  startBackgroundAuthServices();

  waitForNoVNCPortReady(39742, 20000)
    .then(() => {
      backgroundAuthWindow = new BrowserWindow({
        width: 1350,
        height: 780,
        title: 'NeuralAgent Background Auth',
        icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          preload: path.join(__dirname, 'electron', 'preload.js'),
        },
      });

      const reactURL = isDev
        ? 'http://localhost:6763/#/background-auth'
        : `file://${path.join(__dirname, 'neuralagent-app', 'build', 'index.html')}#/background-auth`;

      backgroundAuthWindow.loadURL(reactURL);

      backgroundAuthWindow.on('closed', () => {
        cleanupBackgroundAuthServices();
        backgroundAuthWindow = null;
      });
    })
    .catch((err) => {
      console.error('❌ noVNC failed to start:', err);
      cleanupBackgroundAuthServices();
    });
}

function launchBackgroundAgentWindow() {
  if (bgAgentWindow) return;

  waitForNoVNCPortReady(39742, 20000)
    .then(() => {
      bgAgentWindow = new BrowserWindow({
        width: 1350,
        height: 780,
        title: 'NeuralAgent Background Task',
        icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          preload: path.join(__dirname, 'electron', 'preload.js'),
        },
      });

      const reactURL = isDev
        ? 'http://localhost:6763/#/background-task'
        : `file://${path.join(__dirname, 'neuralagent-app', 'build', 'index.html')}#/background-task`;

      bgAgentWindow.loadURL(reactURL);

      bgAgentWindow.on('closed', () => {
        bgAgentWindow = null;
      });
    })
    .catch((err) => {
      console.error('noVNC failed to start:', err);
    });
}

function createWindow() {
  if (mainWindow) return;
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const startURL = isDev
    ? 'http://localhost:6763'
    : url.format({
        pathname: path.join(__dirname, 'neuralagent-app', 'build', 'index.html'),
        protocol: 'file:',
        slashes: true,
      });

  mainWindow.loadURL(startURL);

  mainWindow.on('close', async (e) => {
    if (readyToClose) return;

    e.preventDefault();
    if (mainWindow?.webContents) {
      mainWindow?.webContents.send('trigger-cancel-all-tasks');
    }

    ipcMain.once('cancel-all-tasks-done', () => {
      readyToClose = true;
      mainWindow.close();
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;

    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.close();
    }

    hideTaskIndicatorWindow();
    if (taskActiveOverlayWindow && !taskActiveOverlayWindow.isDestroyed()) {
      taskActiveOverlayWindow.close();
    }
    
    if (adminWindow && !adminWindow.isDestroyed()) {
      adminWindow.close();
    }
    if (bgAgentWindow && !bgAgentWindow.isDestroyed()) {
      bgAgentWindow.close();
    }
    if (bgSetupWindow && !bgSetupWindow.isDestroyed()) {
      bgSetupWindow.close();
    }
    if (backgroundAuthWindow && !backgroundAuthWindow.isDestroyed()) {
      backgroundAuthWindow.close();
    }
  });
}

function createTaskActiveOverlayWindow() {
  if (taskActiveOverlayWindow && !taskActiveOverlayWindow.isDestroyed()) return;

  const { bounds } = screen.getPrimaryDisplay();

  taskActiveOverlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    focusable: false,
    show: false,
    hasShadow: false,
    thickFrame: false,
    fullscreenable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const overlayPath = path.join(__dirname, 'electron', 'task-active-overlay.html');
  taskActiveOverlayWindow.loadFile(overlayPath);

  taskActiveOverlayWindow.webContents.on('did-finish-load', () => {
    if (taskActiveOverlayWindow && !taskActiveOverlayWindow.isDestroyed()) {
      taskActiveOverlayWindow.setBackgroundColor('#00000000');
    }
  });

  taskActiveOverlayWindow.on('closed', () => {
    taskActiveOverlayWindow = null;
  });
}

function revealTaskActiveOverlay() {
  if (!taskActiveOverlayWindow || taskActiveOverlayWindow.isDestroyed()) return;

  const { bounds } = screen.getPrimaryDisplay();
  taskActiveOverlayWindow.setBounds({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  });
  taskActiveOverlayWindow.setBackgroundColor('#00000000');
  taskActiveOverlayWindow.setAlwaysOnTop(true, 'screen-saver');
  taskActiveOverlayWindow.setIgnoreMouseEvents(true, { forward: true });
  taskActiveOverlayWindow.showInactive();
}

function showTaskIndicatorWindow() {
  if (!taskActiveOverlayWindow || taskActiveOverlayWindow.isDestroyed()) {
    createTaskActiveOverlayWindow();
  }
  if (!taskActiveOverlayWindow) return;

  if (taskActiveOverlayWindow.webContents.isLoading()) {
    taskActiveOverlayWindow.webContents.once('did-finish-load', revealTaskActiveOverlay);
  } else {
    revealTaskActiveOverlay();
  }
}

function hideTaskIndicatorWindow() {
  if (taskActiveOverlayWindow && !taskActiveOverlayWindow.isDestroyed()) {
    taskActiveOverlayWindow.hide();
  }
}

function createOverlayWindow() {
  if (overlayWindow) return;

  const windowWidth = 60;
  const windowHeight = 60;
  const margin = 25;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;

  const xPos = screenWidth - windowWidth - margin;
  const yPos = screenHeight - windowHeight - margin;

  overlayWindow = new BrowserWindow({
    width: 60,
    height: 60,
    x: xPos,
    y: yPos,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const overlayURL = isDev
    ? 'http://localhost:6763/#/overlay'
    : `file://${path.join(__dirname, 'neuralagent-app', 'build', 'index.html')}#/overlay`;

  overlayWindow.loadURL(overlayURL);

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function expandMinimizeOverlay(expanded, hasSuggestions = false) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;

  const W = expanded ? 350 : 60;
  const H = expanded ? (hasSuggestions ? 380 : 60) : 60;
  const M = 25;
  const { width: SW, height: SH } = screen.getPrimaryDisplay().workArea;
  const X = SW - W - M;
  const Y = SH - H - M;

  overlayWindow.setBounds({ x: X, y: Y, width: W, height: H }, true);
}

function launchAdminWindow() {
  if (adminWindow && !adminWindow.isDestroyed()) {
    adminWindow.focus();
    return;
  }

  adminWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    title: 'Admin - Pending Payments',
    icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'electron', 'preload.js'),
    },
  });

  const adminURL = isDev
    ? 'file://' + path.join(__dirname, 'admin.html')
    : `file://${path.join(__dirname, 'admin.html')}`;

  adminWindow.loadURL(adminURL);

  adminWindow.on('closed', () => {
    adminWindow = null;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  ensureDeviceId();
  createWindow();
  if (store.get(constants.ACCESS_TOKEN_STORE_KEY)) {
    createOverlayWindow();
  }
  createAppMenu();
  startScheduler();
  
  // Register global shortcut for Admin Panel: Ctrl+Shift+A
  const ret = globalShortcut.register('CommandOrControl+Shift+A', () => {
    launchAdminWindow();
  });
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      createOverlayWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopScheduler();
  if (aiagentProcess && !aiagentProcess.killed) {
    kill(aiagentProcess.pid, 'SIGKILL', (err) => {
      if (err) console.error('❌ Failed to kill agent:', err);
      else console.log('[Agent stopped on app exit]');
    });
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
