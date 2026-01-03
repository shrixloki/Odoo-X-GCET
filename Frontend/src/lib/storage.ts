// Enhanced localStorage management with expiration and caching
interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry?: number; // in milliseconds
}

class StorageManager {
  private static instance: StorageManager;
  private readonly prefix = 'hrms_';
  private readonly defaultExpiry = 5 * 60 * 1000; // 5 minutes default

  private constructor() {}

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  // Set data with optional expiry
  set<T>(key: string, data: T, expiry?: number): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      expiry: expiry || this.defaultExpiry
    };
    
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(item));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  // Get data with expiry check
  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(this.prefix + key);
      if (!item) return null;

      const parsed: CacheItem<T> = JSON.parse(item);
      
      // Check if expired
      if (parsed.expiry && Date.now() - parsed.timestamp > parsed.expiry) {
        this.remove(key);
        return null;
      }

      return parsed.data;
    } catch (error) {
      console.warn('Failed to read from localStorage:', error);
      return null;
    }
  }

  // Remove specific item
  remove(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error);
    }
  }

  // Clear all HRMS data
  clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
    }
  }

  // Check if data exists and is not expired
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  // Get data age in milliseconds
  getAge(key: string): number | null {
    try {
      const item = localStorage.getItem(this.prefix + key);
      if (!item) return null;

      const parsed: CacheItem<any> = JSON.parse(item);
      return Date.now() - parsed.timestamp;
    } catch (error) {
      return null;
    }
  }

  // Refresh data (update timestamp)
  refresh(key: string): boolean {
    try {
      const item = localStorage.getItem(this.prefix + key);
      if (!item) return false;

      const parsed: CacheItem<any> = JSON.parse(item);
      parsed.timestamp = Date.now();
      
      localStorage.setItem(this.prefix + key, JSON.stringify(parsed));
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const storage = StorageManager.getInstance();

// Predefined cache keys
export const CACHE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER: 'user',
  EMPLOYEES: 'employees',
  LEAVE_REQUESTS: 'leave_requests',
  ATTENDANCE: 'attendance',
  PAYROLL: 'payroll',
  DEPARTMENTS: 'departments',
  DASHBOARD_DATA: 'dashboard_data',
  USER_PREFERENCES: 'user_preferences',
  NOTIFICATIONS: 'notifications'
} as const;

// Cache expiry times (in milliseconds)
export const CACHE_EXPIRY = {
  SHORT: 2 * 60 * 1000,      // 2 minutes
  MEDIUM: 5 * 60 * 1000,     // 5 minutes
  LONG: 15 * 60 * 1000,      // 15 minutes
  VERY_LONG: 60 * 60 * 1000, // 1 hour
  PERSISTENT: 0              // Never expires (until manually cleared)
} as const;