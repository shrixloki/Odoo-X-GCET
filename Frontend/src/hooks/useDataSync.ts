import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { storage, CACHE_KEYS } from '@/lib/storage';

interface DataSyncOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
  onError?: (error: Error) => void;
  onSuccess?: (data: any) => void;
}

export function useDataSync(options: DataSyncOptions = {}) {
  const {
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds
    onError,
    onSuccess
  } = options;

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync data with server
  const syncData = useCallback(async (forceRefresh: boolean = false) => {
    if (!isOnline && !forceRefresh) {
      return { success: false, error: 'Offline - using cached data' };
    }

    try {
      setSyncStatus('syncing');
      const result = await apiClient.getDashboardData(forceRefresh) as { success: boolean; data?: any; error?: string };
      
      if (result.success) {
        setLastSync(new Date());
        setSyncStatus('idle');
        onSuccess?.(result.data);
      } else {
        setSyncStatus('error');
        onError?.(new Error(result.error || 'Sync failed'));
      }
      
      return result;
    } catch (error) {
      setSyncStatus('error');
      onError?.(error as Error);
      return { success: false, error: (error as Error).message };
    }
  }, [isOnline, onError, onSuccess]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh || !isOnline) return;

    const interval = setInterval(() => {
      syncData(false);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, isOnline, refreshInterval, syncData]);

  // Sync when coming back online
  useEffect(() => {
    if (isOnline && syncStatus === 'error') {
      syncData(false);
    }
  }, [isOnline, syncStatus, syncData]);

  return {
    isOnline,
    lastSync,
    syncStatus,
    syncData
  };
}

// Hook for specific data types
export function useEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getEmployees(forceRefresh);
      
      if (response.success) {
        setEmployees(response.data);
      } else {
        setError(response.error || 'Failed to fetch employees');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  return {
    employees,
    loading,
    error,
    refresh: () => fetchEmployees(true)
  };
}

export function useLeaveRequests() {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaveRequests = useCallback(async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getLeaveRequests(forceRefresh);
      
      if (response.success) {
        setLeaveRequests(response.data);
      } else {
        setError(response.error || 'Failed to fetch leave requests');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaveRequests();
  }, [fetchLeaveRequests]);

  return {
    leaveRequests,
    loading,
    error,
    refresh: () => fetchLeaveRequests(true)
  };
}

export function useAttendance() {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAttendance = useCallback(async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getAttendance(forceRefresh);
      
      if (response.success) {
        setAttendance(response.data);
      } else {
        setError(response.error || 'Failed to fetch attendance');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  return {
    attendance,
    loading,
    error,
    refresh: () => fetchAttendance(true)
  };
}