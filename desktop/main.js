import { app, BrowserWindow, Menu, ipcMain, dialog, screen, globalShortcut, powerMonitor } from 'electron';
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
import electronUpdater from 'electron-updater';
import fs from 'fs';
const { autoUpdater } = electronUpdater;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store();

// Admin password is now stored in backend .env file

// ---------------------------------------------------------------------------
// Auto-update configuration
// ---------------------------------------------------------------------------
function setupAutoUpdater() {
  if (isDev) {
    console.log('Auto-updates disabled in development mode');
    return;
  }

  // Configure auto-updater to use GitHub Releases
  autoUpdater.setFeedURL({
    provider: 'github',
    repo: 'zimzamzum_app',
    owner: 'robert666777',
    private: false,
    releaseType: 'release'
  });

  // Check for updates on app start
  autoUpdater.checkForUpdatesAndNotify();

  // Event: Update available
  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: 'New Update Available',
      message: `A new version ${info.version} is available!`,
      detail: 'The update will be downloaded automatically.',
      buttons: ['OK']
    });
  });

  // Event: Update downloaded
  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Downloaded',
      message: `Update ${info.version} has been downloaded!`,
      detail: 'Restart the application to install the update.',
      buttons: ['Restart Now', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  // Event: Error
  autoUpdater.on('error', (error) => {
    console.error('Auto-update error:', error);
    dialog.showMessageBox({
      type: 'error',
      title: 'Update Error',
      message: 'Failed to check for updates.',
      detail: error.message,
      buttons: ['OK']
    });
  });
}

// ---------------------------------------------------------------------------
// API helpers — centralised payment calls to the Railway PostgreSQL backend
// ---------------------------------------------------------------------------
const API_BASE_URL_STORE_KEY = '_NA_API_BASE_URL';

function getApiBaseUrl() {
  return 'http://localhost:8000';
}

function getUserIdFromStore() {
  const token = store.get(constants.ACCESS_TOKEN_STORE_KEY);
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.user_id === 'string' ? payload.user_id : null;
  } catch {
    return null;
  }
}

async function apiRequest(method, path, body = null) {
  const baseUrl = getApiBaseUrl();
  const token = store.get(constants.ACCESS_TOKEN_STORE_KEY);
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(`${baseUrl}${path}`, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${method} ${path} failed (${response.status}): ${text}`);
  }
  return response.json();
}

const PLAN_DURATIONS = {
  free: 1,       // 1 jour de free trial
  starter: 30,   // 30 jours
  semester: 180, // 6 mois
  annual: 365    // 1 an
};

// Configuration du free plan (10 minutes/jour)
const DAILY_FREE_MINUTES = 10;

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
let taskStartTime = null; // Heure de début de la tâche pour le comptage des minutes
let freePlanTimer = null; // Timer pour arrêter l'agent à 10 minutes
let freePlanMinutesInterval = null;

function getInProgressTaskMinutes() {
  if (!taskStartTime) return 0;
  return Math.ceil((Date.now() - taskStartTime.getTime()) / 60000);
}

// ============================================================
// getUserPlanInfo - Vérifie le plan via le backend (source de vérité)
// puis fallback sur electron-store. Retourne { plan, canStart }.
// ============================================================
async function fetchWithTimeout(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// ============================================================
// Keep-alive — Ping léger du backend toutes les 12 minutes pour
// empêcher le spin-down de Render (free tier, 15 min d'inactivité).
// - Skip si l'utilisateur n'est pas connecté
// - Skip si l'écran est verrouillé ou l'app en arrière-plan long
// - Garde budget mensuel pour rester sous les 750h Render free
// ============================================================
const KEEPALIVE_INTERVAL_MS = 12 * 60 * 1000;        // 12 minutes (marge avant 15min Render)
const KEEPALIVE_TIMEOUT_MS = 5000;                   // 5s suffit, on veut juste un signal
const KEEPALIVE_STATE_KEY = '_NA_keepalive_state';   // clé electron-store
const KEEPALIVE_MONTH_BUDGET_MS = 18 * 60 * 60 * 1000; // 18h de "service awake" cumulé/mois (budget conservateur, marge vs 720h/mois)
const KEEPALIVE_AWAKE_DURATION_PER_PING_MS = 12 * 60 * 1000; // chaque ping "compte" comme 12 min de service actif (approximation)

let keepAliveTimer = null;
let lastBackendHotUntil = 0;

function _readKeepAliveState() {
  const state = store.get(KEEPALIVE_STATE_KEY, null);
  if (!state || typeof state !== 'object') {
    return { month: '', awakeMs: 0, lastPing: 0, lastSuccess: 0 };
  }
  return {
    month: String(state.month || ''),
    awakeMs: Number(state.awakeMs || 0),
    lastPing: Number(state.lastPing || 0),
    lastSuccess: Number(state.lastSuccess || 0),
  };
}

function _writeKeepAliveState(state) {
  store.set(KEEPALIVE_STATE_KEY, state);
}

function _currentMonthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function _shouldSkipKeepAlive() {
  // Pas connecté → pas la peine de pinger
  if (!store.get(constants.ACCESS_TOKEN_STORE_KEY)) {
    return 'not_logged_in';
  }
  // Écran verrouillé / app en sommeil profond → l'utilisateur ne s'en sert pas, on évite de gaspiller
  if (powerMonitor && powerMonitor.isSystemSuspended) return 'system_suspended';
  // On ne pinge pas en arrière-plan planant : l'utilisateur n'utilise pas l'app
  // Note : on garde quand même le ping si l'overlay est actif (l'agent travaille peut-être)
  if (BrowserWindow.getAllWindows().length === 0) return 'no_window';
  // Garde budget mensuel pour rester sous les 750h Render free
  const s = _readKeepAliveState();
  if (s.month !== _currentMonthKey()) return null; // nouveau mois, reset auto
  if (s.awakeMs >= KEEPALIVE_MONTH_BUDGET_MS) return 'monthly_budget_reached';
  return null;
}

async function _pingKeepAlive() {
  const skipReason = _shouldSkipKeepAlive();
  if (skipReason) {
    console.log(`[KeepAlive] Skipped (${skipReason})`);
    return false;
  }
  try {
    const resp = await fetchWithTimeout(
      `${getApiBaseUrl()}/health`,
      { method: 'GET' },
      KEEPALIVE_TIMEOUT_MS
    );
    const now = Date.now();
    const s = _readKeepAliveState();
    const month = _currentMonthKey();
    // Reset mensuel
    let nextState = { month, awakeMs: s.month === month ? s.awakeMs : 0, lastPing: now, lastSuccess: s.lastSuccess };
    if (resp.ok) {
      nextState.lastSuccess = now;
      nextState.awakeMs += KEEPALIVE_AWAKE_DURATION_PER_PING_MS;
      _writeKeepAliveState(nextState);
      // Notifie les appelants suivants que le backend est probablement chaud
      lastBackendHotUntil = now + 5 * 60 * 1000;
      console.log(`[KeepAlive] OK (budget: ${(nextState.awakeMs / 3600000).toFixed(1)}h / ${(KEEPALIVE_MONTH_BUDGET_MS / 3600000).toFixed(0)}h ce mois)`);
      return true;
    }
    _writeKeepAliveState(nextState);
    console.warn(`[KeepAlive] Backend returned ${resp.status}`);
    return false;
  } catch (err) {
    console.warn(`[KeepAlive] Ping failed: ${err.message}`);
    return false;
  }
}

function _isBackendKnownHot() {
  return Date.now() < lastBackendHotUntil;
}

function startKeepAlive() {
  if (keepAliveTimer) {
    console.log('[KeepAlive] Already running');
    return;
  }
  console.log(`[KeepAlive] Starting (interval ${KEEPALIVE_INTERVAL_MS / 60000} min, budget ${KEEPALIVE_MONTH_BUDGET_MS / 3600000}h/mois)`);
  // Premier ping immédiat au boot pour réveiller le service si nécessaire
  // puis à intervalle régulier
  _pingKeepAlive();
  keepAliveTimer = setInterval(_pingKeepAlive, KEEPALIVE_INTERVAL_MS);
  // Quand l'écran se rallume après une veille, on pinge tout de suite
  if (powerMonitor && powerMonitor.on) {
    powerMonitor.on('resume', () => {
      console.log('[KeepAlive] System resumed, pinging now');
      _pingKeepAlive();
    });
  }
}

function stopKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
    console.log('[KeepAlive] Stopped');
  }
}

async function getUserPlanInfo() {

  // ========================================
  // ÉTAPE 1 : Appeler le backend (source de vérité) avec retry
  // ========================================
  const token = store.get(constants.ACCESS_TOKEN_STORE_KEY);
  if (token) {
    // Si le keep-alive vient de pinger (<5min), le backend est très
    // probablement chaud → 1 essai suffit et timeout court
    const backendHot = _isBackendKnownHot();
    const maxRetries = backendHot ? 0 : 2;
    const timeoutMs = backendHot ? 5000 : 15000;
    if (backendHot) console.log('[getUserPlanInfo] Backend known hot, fast path');
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`[getUserPlanInfo] Retry ${attempt}/${maxRetries} in 2s...`);
        await new Promise(r => setTimeout(r, 2000));
      }
      try {
        const response = await fetchWithTimeout(`${getApiBaseUrl()}/apps/payments/user/plan`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }, timeoutMs);

        if (response.ok) {
          // Marquer le backend comme chaud pour les prochains appels
          lastBackendHotUntil = Date.now() + 5 * 60 * 1000;
          const data = await response.json();
          const planId = data.plan_id || 'free';

          console.log(`[getUserPlanInfo] Backend says plan = "${planId}"`);

          // Mettre à jour le store pour que le fallback soit à jour
          if (paidPlans.includes(planId)) {
            store.set(`userPlan_${userId}`, {
              plan: planId,
              expiresAt: data.expires_at || null,
              updatedAt: new Date().toISOString(),
            });
            return { plan: planId, canStart: true, isPaid: true };
          }

          // Plan = free → vérifier les minutes quotidiennes
          console.log(`[getUserPlanInfo] Free plan detected - checking daily minutes...`);
          const freePlanResetKey = 'free_plan_last_reset_date';
          const today = new Date().toDateString();
          const lastResetDate = store.get(freePlanResetKey, '');
          if (lastResetDate !== today) {
            return { plan: 'free', canStart: true, isPaid: false };
          }
          const snapshot = getFreePlanMinutesSnapshot();
          console.log(`[getUserPlanInfo] Free plan: ${snapshot.used}/${snapshot.total} min used, ${snapshot.remaining} remaining`);
          return { plan: 'free', canStart: snapshot.remaining > 0, isPaid: false };
        } else {
          console.warn(`[getUserPlanInfo] Backend returned ${response.status}`);
          lastError = new Error(`HTTP ${response.status}`);
        }
      } catch (backendError) {
        console.error(`[getUserPlanInfo] Attempt ${attempt + 1} failed: ${backendError.message}`);
        lastError = backendError;
      }
    }
    if (lastError) {
      console.warn(`[getUserPlanInfo] All ${maxRetries + 1} attempts failed, falling back to local check`);
    }
  }

  // ========================================
  // ÉTAPE 2 : Fallback - vérifier electron-store
  // ========================================
  const rawPayments = store.get('pendingPayments', []);
  const payments = Array.isArray(rawPayments) ? rawPayments : [];
  const confirmedPayment = payments.find(p => {
    if (typeof p !== 'object' || !p) return false;
    return p.userId === userId && p.status === 'confirmed';
  });
  if (confirmedPayment && confirmedPayment.plan && paidPlans.includes(confirmedPayment.plan)) {
    console.log(`[getUserPlanInfo] Found confirmed payment in store: ${confirmedPayment.plan}`);
    return { plan: confirmedPayment.plan, canStart: true, isPaid: true };
  }

  const planKey = userId ? `userPlan_${userId}` : null;
  if (planKey) {
    const storedPlanRaw = store.get(planKey, null);
    if (storedPlanRaw && typeof storedPlanRaw === 'object' && storedPlanRaw.plan && paidPlans.includes(storedPlanRaw.plan)) {
      const expiresAt = storedPlanRaw.expiresAt;
      const now = new Date();
      const expiry = expiresAt ? new Date(expiresAt) : null;
      if (!expiry || expiry > now) {
        console.log(`[getUserPlanInfo] Found valid paid plan in store: ${storedPlanRaw.plan}`);
        return { plan: storedPlanRaw.plan, canStart: true, isPaid: true };
      }
    }
  }

  // Free plan → vérifier les minutes quotidiennes
  const freePlanResetKey = 'free_plan_last_reset_date';
  const today = new Date().toDateString();
  const lastResetDate = store.get(freePlanResetKey, '');
  if (lastResetDate !== today) {
    return { plan: 'free', canStart: true, isPaid: false };
  }
  const snapshot = getFreePlanMinutesSnapshot();
  console.log(`[getUserPlanInfo] Free plan (store fallback): ${snapshot.used}/${snapshot.total} min used, ${snapshot.remaining} remaining`);
  return { plan: 'free', canStart: snapshot.remaining > 0, isPaid: false };
}

// Alias pour compatibilité (certains appels peuvent utiliser l'ancien nom)
const canStartTaskSync = getUserPlanInfo;

function getStoredDailyUsedMinutes() {
  const userId = getUserIdFromStore();
  const freePlanMinutesKey = 'free_plan_daily_used_minutes';
  const freePlanResetKey = 'free_plan_last_reset_date';
  const today = new Date().toDateString();
  const lastResetDate = store.get(freePlanResetKey, '');

  if (lastResetDate !== today) {
    return 0;
  }

  return store.get(freePlanMinutesKey, 0);
}

function getFreePlanMinutesSnapshot() {
  const userId = getUserIdFromStore();
  const freePlanMinutesKey = 'free_plan_daily_used_minutes';
  const freePlanResetKey = 'free_plan_last_reset_date';
  const storedUsed = store.get(freePlanMinutesKey, 0);
  const inProgress = getInProgressTaskMinutes();
  const used = storedUsed + inProgress;
  const remaining = Math.max(0, DAILY_FREE_MINUTES - used);
  return { used, remaining, total: DAILY_FREE_MINUTES };
}

function broadcastFreePlanMinutesUpdate() {
  const snapshot = getFreePlanMinutesSnapshot();
  mainWindow?.webContents.send('free-plan-minutes-updated', snapshot);
  overlayWindow?.webContents.send('free-plan-minutes-updated', snapshot);
}

function startFreePlanMinutesTicker() {
  if (freePlanMinutesInterval) return;
  broadcastFreePlanMinutesUpdate();
  freePlanMinutesInterval = setInterval(broadcastFreePlanMinutesUpdate, 10000);
}

function stopFreePlanMinutesTicker() {
  if (freePlanMinutesInterval) {
    clearInterval(freePlanMinutesInterval);
    freePlanMinutesInterval = null;
  }
  broadcastFreePlanMinutesUpdate();
}

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
  // Démarre le keep-alive maintenant que l'utilisateur est connecté
  startKeepAlive();
});

ipcMain.handle('get-token', () => store.get(constants.ACCESS_TOKEN_STORE_KEY));
ipcMain.on('delete-token', () => {
  store.delete(constants.ACCESS_TOKEN_STORE_KEY);
  hideTaskIndicatorWindow();
  if (overlayWindow) {
    overlayWindow.close();
  }
  // Stoppe le keep-alive car plus personne n'en a besoin
  stopKeepAlive();
});
ipcMain.on('set-refresh-token', (_, token) => store.set(constants.REFRESH_TOKEN_STORE_KEY, token));
ipcMain.handle('get-refresh-token', () => store.get(constants.REFRESH_TOKEN_STORE_KEY));
ipcMain.on('delete-refresh-token', () => store.delete(constants.REFRESH_TOKEN_STORE_KEY));

ipcMain.handle('get-pending-payments', async () => {
  return store.get('pendingPayments', []);
});

ipcMain.handle('add-pending-payment', (_, payment) => {
  const payments = store.get('pendingPayments', []);
  payment.id = Date.now();
  payment.status = 'pending';
  payments.push(payment);
  store.set('pendingPayments', payments);
  return payment;
});

ipcMain.handle('confirm-payment', (_, paymentId) => {
  const payments = store.get('pendingPayments', []);
  const idx = payments.findIndex(p => p.id === paymentId);
  if (idx !== -1) {
    payments[idx].status = 'confirmed';
    payments[idx].confirmedAt = new Date().toISOString();
    store.set('pendingPayments', payments);
    const userPlan = { plan: payments[idx].plan, startedAt: payments[idx].confirmedAt, expiresAt: calculateExpirationDate(payments[idx].plan) };
    store.set(`userPlan_${payments[idx].userId}`, userPlan);
    return payments[idx];
  }
  return null;
});

function calculateExpirationDate(plan) {
  const duration = PLAN_DURATIONS[plan] || 1;
  const expiration = new Date();
  expiration.setDate(expiration.getDate() + duration);
  return expiration.toISOString();
}

ipcMain.handle('get-user-plan', async (_, userId) => {
  const id = userId || 'guest';
  const userPlan = store.get(`userPlan_${id}`, null);
  if (userPlan) {
    return { ...userPlan, isExpired: isPlanExpired(userPlan) };
  }
  // Default free plan with 1-day trial
  const expiresAt = calculateExpirationDate('free');
  return { plan: 'free', startedAt: new Date().toISOString(), expiresAt, userId: id, isExpired: false };
});

// ------------------------------
// Free Plan Minutes Management
// ------------------------------

ipcMain.handle('get-remaining-minutes', () => {
  const userId = getUserIdFromStore();
  const freePlanMinutesKey = 'free_plan_daily_used_minutes';
  const freePlanResetKey = 'free_plan_last_reset_date';
  const today = new Date().toDateString();
  const lastResetDate = store.get(freePlanResetKey, '');

  if (lastResetDate !== today) {
    store.set(freePlanMinutesKey, 0);
    store.set(freePlanResetKey, today);
  }

  return getFreePlanMinutesSnapshot().remaining;
});

ipcMain.handle('can-start-task', () => {
  const userId = getUserIdFromStore();
  const freePlanResetKey = 'free_plan_last_reset_date';
  const today = new Date().toDateString();
  const lastResetDate = store.get(freePlanResetKey, '');

  if (lastResetDate !== today) {
    return true;
  }

  return getFreePlanMinutesSnapshot().remaining > 0;
});

ipcMain.handle('add-used-minutes', (_, minutes) => {
  const userId = getUserIdFromStore();
  const freePlanMinutesKey = 'free_plan_daily_used_minutes';
  const freePlanResetKey = 'free_plan_last_reset_date';
  const today = new Date().toDateString();
  const lastResetDate = store.get(freePlanResetKey, '');
  
  if (lastResetDate !== today) {
    store.set(freePlanMinutesKey, 0);
    store.set(freePlanResetKey, today);
  }
  
  const currentUsed = store.get(freePlanMinutesKey, 0);
  store.set(freePlanMinutesKey, currentUsed + minutes);
  return true;
});

ipcMain.handle('get-daily-free-minutes', () => {
  return DAILY_FREE_MINUTES;
});

ipcMain.handle('get-locale', async () => {
  try {
    const locale = await mainWindow?.webContents.executeJavaScript(
      `localStorage.getItem('neuralagent.locale')`
    );
    if (locale) return locale;
  } catch (e) {
    // ignore
  }
  return store.get('neuralagent.locale', 'en');
});

ipcMain.on('set-locale', (_, locale) => {
  store.set('neuralagent.locale', locale);
});

ipcMain.handle('get-used-minutes', () => {
  const userId = getUserIdFromStore();
  const freePlanMinutesKey = 'free_plan_daily_used_minutes';
  const freePlanResetKey = 'free_plan_last_reset_date';
  const today = new Date().toDateString();
  const lastResetDate = store.get(freePlanResetKey, '');

  if (lastResetDate !== today) {
    store.set(freePlanMinutesKey, 0);
    store.set(freePlanResetKey, today);
  }

  return getFreePlanMinutesSnapshot().used;
});

function isPlanExpired(userPlan) {
  if (!userPlan.expiresAt) return false;
  return new Date(userPlan.expiresAt) < new Date();
}

ipcMain.handle('check-plan-expired', async (_, userId) => {
  const id = userId || 'guest';
  const userPlan = store.get(`userPlan_${id}`, null);
  if (!userPlan) return false;
  return isPlanExpired(userPlan);
});

ipcMain.handle('get-plan-countdown', async (_, userId) => {
  const id = userId || 'guest';
  let userPlan = store.get(`userPlan_${id}`, null);
  
  if (!userPlan || !userPlan.expiresAt) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);
    userPlan = { 
      plan: 'free', 
      expiresAt: expiresAt.toISOString(),
      userId: id 
    };
    store.set(`userPlan_${id}`, userPlan);
  }
  
  const now = new Date();
  const expires = new Date(userPlan.expiresAt);
  const diff = expires.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, expired: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { days, hours, minutes, expired: false };
});

ipcMain.handle('extend-plan-by-days', async (_, userId, daysToAdd) => {
  // This operation is admin-only on the backend; here we just return the
  // current plan info after the extension would have been applied server-side.
  // For now, fall back to local store extension so existing callers don't break.
  const id = userId || 'guest';
  let userPlan = store.get(`userPlan_${id}`, null);
  if (!userPlan) {
    const expiresAt = calculateExpirationDate('free');
    userPlan = { plan: 'free', startedAt: new Date().toISOString(), expiresAt, userId: id };
  }
  const currentExpires = new Date(userPlan.expiresAt);
  currentExpires.setDate(currentExpires.getDate() + daysToAdd);
  userPlan.expiresAt = currentExpires.toISOString();
  store.set(`userPlan_${id}`, userPlan);
  return userPlan;
});

ipcMain.on('set-user-plan', (_, planData) => {
  // Keep local store in sync as a cache/fallback
  const userId = planData.userId || 'guest';
  store.set(`userPlan_${userId}`, planData);
});

ipcMain.handle('verify-admin-password', async (_, password) => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/apps/auth/verify-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const result = await response.json();
    return result.valid || false;
  } catch (error) {
    console.error('Error verifying admin password:', error);
    return false;
  }
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

ipcMain.on('set-api-base-url', (_, apiBaseUrl) => {
  store.set(API_BASE_URL_STORE_KEY, apiBaseUrl);
  console.log(`[API Base URL set]: ${apiBaseUrl}`);
});

ipcMain.handle('get-api-base-url', () => getApiBaseUrl());

ipcMain.on('launch-ai-agent', async (_, baseURL, threadId, backgroundMode) => {
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  console.log('[launch-ai-agent] START');
  console.log('[launch-ai-agent] baseURL:', baseURL);
  console.log('[launch-ai-agent] threadId:', threadId);
  console.log('[launch-ai-agent] backgroundMode:', backgroundMode);
  console.log('[launch-ai-agent] mainWindow exists:', !!mainWindow, mainWindow?.isDestroyed());
  console.log('[launch-ai-agent] overlayWindow exists:', !!overlayWindow, overlayWindow?.isDestroyed());

  // Vérifier le plan via le backend (source de vérité) - récupère toutes les infos en un seul appel
  const planInfo = await getUserPlanInfo();
  console.log(`[launch-ai-agent] Plan: ${planInfo.plan}, canStart: ${planInfo.canStart}, isPaid: ${planInfo.isPaid}`);

  if (!planInfo.canStart) {
    console.log('[launch-ai-agent] BLOCKED: Free plan limit');
    mainWindow?.webContents.send('free-plan-limit-reached');
    overlayWindow?.webContents.send('free-plan-limit-reached');
    return;
  }

  console.log('[launch-ai-agent] Plan check OK, proceeding...');
  const userId = getUserIdFromStore();

  if (!planInfo.isPaid) {
    // Free plan: track minutes and auto-stop at limit (cumulatif)
    taskStartTime = new Date();
    startFreePlanMinutesTicker();
    
    // Calculer les minutes restantes pour cette session
    const freePlanMinutesKey = 'free_plan_daily_used_minutes';
    const storedUsed = store.get(freePlanMinutesKey, 0);
    const remainingMinutes = Math.max(0, DAILY_FREE_MINUTES - storedUsed);
    console.log(`[Free Plan] Used: ${storedUsed}min, Remaining for this task: ${remainingMinutes}min`);
    
    freePlanTimer = setTimeout(() => {
      console.log('[Free Plan Limit Reached]: Stopping agent (cumulative daily limit)');
      if (aiagentProcess) {
        aiagentProcess.kill('SIGTERM');
      }
    }, remainingMinutes * 60 * 1000);
  }

  // Persist the API base URL so payment helpers can reach the backend
  store.set(API_BASE_URL_STORE_KEY, baseURL);
  store.set(constants.LAST_BACKGROUND_MODE_VALUE, backgroundMode.toString());

  if (!backgroundMode) {
    const agentPath = isDev
      ? path.join(__dirname, 'agent_build', isWindows ? 'agent.exe' : 'agent')
      : path.join(process.resourcesPath, 'app.asar.unpacked', 'agent_build', isWindows ? 'agent.exe' : 'agent');

    console.log('[Agent] Trying to spawn agent at:', agentPath);
    console.log('[Agent] File exists:', fs.existsSync(agentPath));

    if (!fs.existsSync(agentPath)) {
      console.error('[Agent ERROR] agent.exe not found at:', agentPath);
      mainWindow?.webContents.send('trigger-cancel-all-tasks');
      mainWindow?.webContents.send('show-error-message', 'Desktop agent (agent.exe) not found. Please rebuild the agent or check the agent_build folder.');
      return;
    }

    console.log('[launch-ai-agent] Spawning agent.exe...');
    aiagentProcess = spawn(agentPath, [], {
      env: {
        NEURALAGENT_API_URL: baseURL,
        NEURALAGENT_THREAD_ID: threadId,
        NEURALAGENT_USER_ACCESS_TOKEN: store.get(constants.ACCESS_TOKEN_STORE_KEY),
      },
    });
    console.log('[launch-ai-agent] Agent spawned, PID:', aiagentProcess.pid);
    console.log('[launch-ai-agent] Minimizing mainWindow...');
    mainWindow?.minimize();
    console.log('[launch-ai-agent] Minimize done');
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

  console.log('[launch-ai-agent] Sending ai-agent-launch IPC to windows...');
  mainWindow?.webContents.send('ai-agent-launch', threadId);
  overlayWindow?.webContents.send('ai-agent-launch', threadId);
  console.log('[launch-ai-agent] IPC sent, showing task indicator...');
  showTaskIndicatorWindow();
  console.log('[launch-ai-agent] Task indicator shown, expanding overlay...');
  expandMinimizeOverlay(true, false);
  console.log('[launch-ai-agent] DONE');

  aiagentProcess.stdout.on('data', (data) => console.log(`[Agent stdout]: ${data}`));
  aiagentProcess.stderr.on('data', (data) => console.error(`[Agent stderr]: ${data}`));

  aiagentProcess.on('error', err => {
    console.error('❌  Agent process failed to start:', err);
    mainWindow?.webContents.send('trigger-cancel-all-tasks');
  });

  aiagentProcess.on('exit', (code, signal) => {
    console.log(`[Agent exited with code ${code}]`);
    
    // Arrêter le timer de free plan si il existe
    if (freePlanTimer) {
      clearTimeout(freePlanTimer);
      freePlanTimer = null;
    }
    
    // Calculer et ajouter les minutes utilisées pour le free plan
    if (taskStartTime) {
      const taskEndTime = new Date();
      const durationMinutes = Math.max(1, Math.round((taskEndTime - taskStartTime) / 60000));
      console.log(`[Task Duration]: ${durationMinutes} minutes`);
      
      // Enregistrer les minutes utilisées (compteur global pour tous les free accounts)
      const today = new Date().toDateString();
      const freePlanMinutesKey = 'free_plan_daily_used_minutes';
      const freePlanResetKey = 'free_plan_last_reset_date';
      const lastResetDate = store.get(freePlanResetKey, '');
      
      if (lastResetDate !== today) {
        store.set(freePlanMinutesKey, 0);
        store.set(freePlanResetKey, today);
      }
      
      const currentUsed = store.get(freePlanMinutesKey, 0);
      store.set(freePlanMinutesKey, currentUsed + durationMinutes);
      console.log(`[Free Plan Minutes Used]: ${currentUsed + durationMinutes}/${DAILY_FREE_MINUTES} (shared across all free accounts)`);
      
      taskStartTime = null;
      stopFreePlanMinutesTicker();
    }
    
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

  // Keep-alive : ping léger toutes les 12 min pour empêcher le
  // spin-down de Render free tier. Démarre uniquement si user connecté.
  if (store.get(constants.ACCESS_TOKEN_STORE_KEY)) {
    startKeepAlive();
  }

  // Setup auto-updates
  setupAutoUpdater();

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
  stopKeepAlive();
  if (aiagentProcess && !aiagentProcess.killed) {
    kill(aiagentProcess.pid, 'SIGKILL', (err) => {
      if (err) console.error('❌ Failed to kill agent:', err);
      else console.log('[Agent stopped on app exit]');
    });
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  stopKeepAlive();
  globalShortcut.unregisterAll();
});
