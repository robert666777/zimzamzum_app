// User-specific localStorage utilities
// This ensures data is isolated per user

export const getUserStorageKey = (key, user) => {
  if (!user || !user.id) {
    console.warn('User not available, using generic key:', key);
    return key;
  }
  return `${key}_user_${user.id}`;
};

export const getUserStorageItem = (key, user) => {
  const userKey = getUserStorageKey(key, user);
  return localStorage.getItem(userKey);
};

export const setUserStorageItem = (key, user, value) => {
  const userKey = getUserStorageKey(key, user);
  localStorage.setItem(userKey, value);
};

export const removeUserStorageItem = (key, user) => {
  const userKey = getUserStorageKey(key, user);
  localStorage.removeItem(userKey);
};

// Generic storage keys
export const STORAGE_KEYS = {
  PLATFORMS: 'neuralagent.platforms.v1',
  AUTOMATIONS: 'neuralagent.automations.v1',
  SCHEDULED_TASKS: 'neuralagent.scheduled.v1',
  THREADS: 'neuralagent.threads.v1',
  PENDING_PAYMENTS: 'pendingPayments',
  SCHEDULED_TASK_CONTENT: 'scheduled-task-content',
  PENDING_SCHEDULED_TASK: 'pending-scheduled-task',
};

/** Set on signup; cleared after product tour completes or is dismissed. */
export const PRODUCT_TOUR_SESSION_KEY = 'zimzamzum.show_product_tour';
