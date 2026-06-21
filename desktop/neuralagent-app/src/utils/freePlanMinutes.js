/**
 * Module pour gérer les minutes du free plan via Electron IPC
 * Utilise le processus principal d'Electron pour accéder à electron-store
 */

/**
 * Get the remaining minutes for the free plan
 * @returns {Promise<number>} Remaining minutes
 */
export async function getRemainingMinutes() {
  if (window.electronAPI?.getRemainingMinutes) {
    try {
      return await window.electronAPI.getRemainingMinutes();
    } catch (error) {
      console.error('Error getting remaining minutes:', error);
      return 10;
    }
  }
  return 10;
}

/**
 * Check if the user can start a task
 * @returns {Promise<boolean>} True if the user has remaining minutes
 */
export async function canStartTask() {
  if (window.electronAPI?.canStartTask) {
    try {
      return await window.electronAPI.canStartTask();
    } catch (error) {
      console.error('Error checking if can start task:', error);
      return true;
    }
  }
  return true;
}

/**
 * Add used minutes to the daily count
 * @param {number} minutes - Minutes to add
 * @returns {Promise<void>}
 */
export async function addUsedMinutes(minutes) {
  if (window.electronAPI?.addUsedMinutes) {
    try {
      await window.electronAPI.addUsedMinutes(minutes);
    } catch (error) {
      console.error('Error adding used minutes:', error);
    }
  }
}

/**
 * Get the daily free minutes limit
 * @returns {Promise<number>} Daily free minutes limit
 */
export async function getDailyFreeMinutes() {
  if (window.electronAPI?.getDailyFreeMinutes) {
    try {
      return await window.electronAPI.getDailyFreeMinutes();
    } catch (error) {
      console.error('Error getting daily free minutes:', error);
      return 10;
    }
  }
  return 10;
}

/**
 * Get the used minutes today (includes in-progress task time)
 * @returns {Promise<number>} Used minutes today
 */
export async function getUsedMinutes() {
  if (window.electronAPI?.getUsedMinutes) {
    try {
      return await window.electronAPI.getUsedMinutes();
    } catch (error) {
      console.error('Error getting used minutes:', error);
      return 0;
    }
  }
  return 0;
}

/**
 * Load used + daily limit for free plan UI
 * @returns {Promise<{ used: number, daily: number, remaining: number }>}
 */
export async function getFreePlanMinutesSnapshot() {
  const [used, daily, remaining] = await Promise.all([
    getUsedMinutes(),
    getDailyFreeMinutes(),
    getRemainingMinutes(),
  ]);
  return { used, daily, remaining };
}

/**
 * Subscribe to free plan minute updates from the main process
 * @param {(data: { used: number, remaining: number, total: number }) => void} callback
 */
export function onFreePlanMinutesUpdated(callback) {
  if (window.electronAPI?.onFreePlanMinutesUpdated) {
    window.electronAPI.onFreePlanMinutesUpdated(callback);
  }
}
