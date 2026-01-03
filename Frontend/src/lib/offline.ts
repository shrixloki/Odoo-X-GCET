// Offline functionality utilities
import { storage, CACHE_KEYS } from './storage';

export class OfflineManager {
  private static instance: OfflineManager;
  private onlineCallbacks: (() => void)[] = [];
  private offlineCallbacks: (() => void)[] = [];

  private constructor() {
    this.setupEventListeners();
  }

  static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    return OfflineManager.instance;
  }

  private setupEventListeners() {
    window.addEventListener('online', () => {
      console.log('App is back online');
      this.onlineCallbacks.forEach(callback => callback());
    });

    window.addEventListener('offline', () => {
      console.log('App is offline');
      this.offlineCallbacks.forEach(callback => callback());
    });
  }

  onOnline(callback: () => void) {
    this.onlineCallbacks.push(callback);
  }

  onOffline(callback: () => void) {
    this.offlineCallbacks.push(callback);
  }

  isOnline(): boolean {
    return navigator.onLine;
  }

  // Queue actions to perform when back online
  queueAction(action: string, data: any) {
    const queue = storage.get('offline_queue') || [];
    queue.push({
      id: Date.now(),
      action,
      data,
      timestamp: new Date().toISOString()
    });
    storage.set('offline_queue', queue);
  }

  // Process queued actions when back online
  async processQueue() {
    const queue = storage.get('offline_queue') || [];
    if (queue.length === 0) return;

    console.log(`Processing ${queue.length} queued actions`);
    
    for (const item of queue) {
      try {
        await this.processQueuedAction(item);
      } catch (error) {
        console.error('Failed to process queued action:', error);
      }
    }

    // Clear the queue
    storage.remove('offline_queue');
  }

  private async processQueuedAction(item: any) {
    // This would be implemented based on your specific API actions
    // For now, just log the action
    console.log('Processing queued action:', item);
  }

  // Get offline status info
  getOfflineInfo() {
    const queue = storage.get('offline_queue') || [];
    return {
      isOnline: this.isOnline(),
      queuedActions: queue.length,
      lastOnline: storage.get('last_online_time'),
      cacheSize: this.getCacheSize()
    };
  }

  private getCacheSize(): number {
    let size = 0;
    for (let key in localStorage) {
      if (key.startsWith('hrms_')) {
        size += localStorage[key].length;
      }
    }
    return size;
  }

  // Mark when we were last online
  markOnline() {
    storage.set('last_online_time', new Date().toISOString());
  }
}

export const offlineManager = OfflineManager.getInstance();