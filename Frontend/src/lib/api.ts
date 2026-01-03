import { storage, CACHE_KEYS, CACHE_EXPIRY } from './storage';
import { simData } from './simulationData';

const API_BASE_URL = 'http://localhost:3000/api';

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.token = storage.get(CACHE_KEYS.AUTH_TOKEN);
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Network error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  private async cachedRequest(endpoint: string, cacheKey: string, expiry: number = CACHE_EXPIRY.MEDIUM, options: RequestInit = {}) {
    const cached = storage.get(cacheKey);
    if (cached && options.method !== 'POST' && options.method !== 'PUT' && options.method !== 'DELETE') {
      return cached;
    }

    const response = await this.request(endpoint, options);
    if (response.success) {
      storage.set(cacheKey, response, expiry);
    }
    
    return response;
  }

  async login(email: string, password: string) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success && response.data.accessToken) {
      this.token = response.data.accessToken;
      storage.set(CACHE_KEYS.AUTH_TOKEN, this.token, CACHE_EXPIRY.PERSISTENT);
      storage.set(CACHE_KEYS.USER, response.data.user, CACHE_EXPIRY.PERSISTENT);
    }

    return response;
  }

  logout() {
    this.token = null;
    storage.clear();
  }

  async getEmployees(forceRefresh: boolean = false) {
    if (forceRefresh) storage.remove(CACHE_KEYS.EMPLOYEES);
    return this.cachedRequest('/admin/employees', CACHE_KEYS.EMPLOYEES, CACHE_EXPIRY.MEDIUM);
  }

  async createEmployee(data: any) {
    const response = await this.request('/admin/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.success) storage.remove(CACHE_KEYS.EMPLOYEES);
    return response;
  }

  async getLeaveRequests(forceRefresh: boolean = false) {
    if (forceRefresh) storage.remove(CACHE_KEYS.LEAVE_REQUESTS);
    return this.cachedRequest('/admin/leave-requests', CACHE_KEYS.LEAVE_REQUESTS, CACHE_EXPIRY.SHORT);
  }

  async submitLeaveRequest(data: any) {
    const response = await this.request('/leave/request', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.success) storage.remove(CACHE_KEYS.LEAVE_REQUESTS);
    return response;
  }

  async approveLeaveRequest(id: number, data: any) {
    const response = await this.request(`/admin/leave/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (response.success) storage.remove(CACHE_KEYS.LEAVE_REQUESTS);
    return response;
  }

  async rejectLeaveRequest(id: number, data: any) {
    const response = await this.request(`/admin/leave/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (response.success) storage.remove(CACHE_KEYS.LEAVE_REQUESTS);
    return response;
  }

  async getAttendance(forceRefresh: boolean = false) {
    if (forceRefresh) storage.remove(CACHE_KEYS.ATTENDANCE);
    return this.cachedRequest('/admin/attendance', CACHE_KEYS.ATTENDANCE, CACHE_EXPIRY.SHORT);
  }

  async checkIn(data: any) {
    try {
      const response = await this.request('/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (response.success) storage.remove(CACHE_KEYS.ATTENDANCE);
      return response;
    } catch (error) {
      // Fallback to simulation
      const user = this.getCurrentUser() as { id: number } | null;
      if (user?.id) {
        simData.checkIn(user.id);
        return { success: true, message: 'Checked in successfully' };
      }
      throw error;
    }
  }

  async checkOut(data: any) {
    try {
      const response = await this.request('/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (response.success) storage.remove(CACHE_KEYS.ATTENDANCE);
      return response;
    } catch (error) {
      // Fallback to simulation
      const user = this.getCurrentUser() as { id: number } | null;
      if (user?.id) {
        simData.checkOut(user.id);
        return { success: true, message: 'Checked out successfully' };
      }
      throw error;
    }
  }

  async getPayroll(forceRefresh: boolean = false) {
    if (forceRefresh) storage.remove(CACHE_KEYS.PAYROLL);
    return this.cachedRequest('/admin/payroll', CACHE_KEYS.PAYROLL, CACHE_EXPIRY.LONG);
  }

  async generatePayroll(data: any) {
    const response = await this.request('/admin/payroll/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.success) storage.remove(CACHE_KEYS.PAYROLL);
    return response;
  }

  async getDashboardData(forceRefresh: boolean = false) {
    if (forceRefresh) storage.remove(CACHE_KEYS.DASHBOARD_DATA);
    
    const cached = storage.get(CACHE_KEYS.DASHBOARD_DATA);
    if (cached && !forceRefresh) return cached;

    try {
      const [employeesRes, leaveRes, attendanceRes] = await Promise.all([
        this.getEmployees(),
        this.getLeaveRequests(),
        this.getAttendance()
      ]);

      const dashboardData = {
        success: true,
        data: {
          employees: employeesRes.success ? employeesRes.data : [],
          leaveRequests: leaveRes.success ? leaveRes.data : [],
          attendance: attendanceRes.success ? attendanceRes.data : []
        }
      };

      storage.set(CACHE_KEYS.DASHBOARD_DATA, dashboardData, CACHE_EXPIRY.SHORT);
      return dashboardData;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // Get today's check-in/check-out status for an employee
  getTodayStatus(employeeId: number): { checkedIn: boolean; checkedOut: boolean; checkInTime?: string; checkOutTime?: string } {
    return simData.getTodayStatus(employeeId);
  }

  // Export payroll to CSV
  exportPayrollCSV(data: any[]) {
    simData.exportToCSV(data, 'payroll');
  }

  // Export payslip
  exportPayslip(payroll: any) {
    simData.exportPayslip(payroll);
  }

  getCurrentUser() {
    return storage.get(CACHE_KEYS.USER);
  }

  isAuthenticated() {
    return !!this.token && !!storage.get(CACHE_KEYS.USER);
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
