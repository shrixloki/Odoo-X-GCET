// Simulation Data Manager - Persists all demo/simulation data to localStorage

import { DEMO_USERS, DEMO_INVITATIONS } from './demoData';

const STORAGE_PREFIX = 'hrms_sim_';

export const SIM_KEYS = {
  EMPLOYEES: `${STORAGE_PREFIX}employees`,
  ATTENDANCE: `${STORAGE_PREFIX}attendance`,
  LEAVE_REQUESTS: `${STORAGE_PREFIX}leave_requests`,
  PAYROLL: `${STORAGE_PREFIX}payroll`,
  INVITATIONS: `${STORAGE_PREFIX}invitations`,
  TODAY_CHECKIN: `${STORAGE_PREFIX}today_checkin`,
};

// Employee type
export interface SimEmployee {
  id: number;
  full_name: string;
  email: string;
  department: string;
  designation: string;
  role: string;
  status: string;
  join_date: string;
  phone?: string;
  address?: string;
}

// Attendance type
export interface SimAttendance {
  id: number;
  employee_id: number;
  employee_name: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
}

// Leave request type
export interface SimLeaveRequest {
  id: number;
  employee_id: number;
  employee_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}

// Payroll type
export interface SimPayroll {
  id: number;
  employee_id: number;
  employee_name: string;
  month: string;
  year: number;
  basic_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  status: string;
  payment_date: string;
}

// Invitation type
export interface SimInvitation {
  id: number;
  from: string;
  type: 'team_join' | 'project_invite' | 'role_change';
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

// Initialize default data if not exists
function initializeIfEmpty<T>(key: string, defaultData: T[]): T[] {
  const stored = localStorage.getItem(key);
  if (!stored) {
    localStorage.setItem(key, JSON.stringify(defaultData));
    return defaultData;
  }
  return JSON.parse(stored);
}

// Get default employees from demo users
function getDefaultEmployees(): SimEmployee[] {
  return DEMO_USERS.map(u => ({
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    department: u.department,
    designation: u.designation,
    role: u.role,
    status: 'Active',
    join_date: '2024-01-15'
  }));
}

// Get default attendance
function getDefaultAttendance(): SimAttendance[] {
  const today = new Date().toISOString().split('T')[0];
  return DEMO_USERS.map((u, i) => ({
    id: i + 1,
    employee_id: u.id,
    employee_name: u.full_name,
    date: today,
    check_in: null,
    check_out: null,
    status: 'ABSENT'
  }));
}

// Get default leave requests
function getDefaultLeaveRequests(): SimLeaveRequest[] {
  return [
    {
      id: 1,
      employee_id: 3,
      employee_name: 'Mike Chen',
      leave_type: 'Annual',
      start_date: '2026-01-10',
      end_date: '2026-01-12',
      days_requested: 3,
      reason: 'Family vacation',
      status: 'PENDING',
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      employee_id: 2,
      employee_name: 'Sarah Williams',
      leave_type: 'Sick',
      start_date: '2026-01-05',
      end_date: '2026-01-05',
      days_requested: 1,
      reason: 'Medical appointment',
      status: 'APPROVED',
      created_at: new Date().toISOString()
    }
  ];
}

// Get default payroll
function getDefaultPayroll(): SimPayroll[] {
  return DEMO_USERS.map((u, i) => ({
    id: i + 1,
    employee_id: u.id,
    employee_name: u.full_name,
    month: 'December',
    year: 2025,
    basic_salary: 5000 + (i * 1500),
    allowances: 500 + (i * 100),
    deductions: 300 + (i * 50),
    net_salary: 5200 + (i * 1550),
    status: 'Paid',
    payment_date: '2025-12-31'
  }));
}

// Simulation Data Manager
class SimulationDataManager {
  // Employees
  getEmployees(): SimEmployee[] {
    return initializeIfEmpty(SIM_KEYS.EMPLOYEES, getDefaultEmployees());
  }

  addEmployee(employee: Omit<SimEmployee, 'id'>): SimEmployee {
    const employees = this.getEmployees();
    const newId = Math.max(...employees.map(e => e.id), 0) + 1;
    const newEmployee = { ...employee, id: newId };
    employees.push(newEmployee);
    localStorage.setItem(SIM_KEYS.EMPLOYEES, JSON.stringify(employees));
    
    // Also add to attendance
    const attendance = this.getAttendance();
    const today = new Date().toISOString().split('T')[0];
    attendance.push({
      id: Math.max(...attendance.map(a => a.id), 0) + 1,
      employee_id: newId,
      employee_name: employee.full_name,
      date: today,
      check_in: null,
      check_out: null,
      status: 'ABSENT'
    });
    localStorage.setItem(SIM_KEYS.ATTENDANCE, JSON.stringify(attendance));
    
    return newEmployee;
  }

  updateEmployee(id: number, updates: Partial<SimEmployee>): SimEmployee | null {
    const employees = this.getEmployees();
    const index = employees.findIndex(e => e.id === id);
    if (index === -1) return null;
    employees[index] = { ...employees[index], ...updates };
    localStorage.setItem(SIM_KEYS.EMPLOYEES, JSON.stringify(employees));
    return employees[index];
  }

  deleteEmployee(id: number): boolean {
    const employees = this.getEmployees();
    const filtered = employees.filter(e => e.id !== id);
    if (filtered.length === employees.length) return false;
    localStorage.setItem(SIM_KEYS.EMPLOYEES, JSON.stringify(filtered));
    return true;
  }

  // Attendance
  getAttendance(): SimAttendance[] {
    return initializeIfEmpty(SIM_KEYS.ATTENDANCE, getDefaultAttendance());
  }

  checkIn(employeeId: number): SimAttendance | null {
    const attendance = this.getAttendance();
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString('en-US', { hour12: false });
    
    let record = attendance.find(a => a.employee_id === employeeId && a.date === today);
    
    if (!record) {
      const employees = this.getEmployees();
      const emp = employees.find(e => e.id === employeeId);
      if (!emp) return null;
      
      record = {
        id: Math.max(...attendance.map(a => a.id), 0) + 1,
        employee_id: employeeId,
        employee_name: emp.full_name,
        date: today,
        check_in: now,
        check_out: null,
        status: 'PRESENT'
      };
      attendance.push(record);
    } else {
      record.check_in = now;
      record.status = 'PRESENT';
    }
    
    localStorage.setItem(SIM_KEYS.ATTENDANCE, JSON.stringify(attendance));
    localStorage.setItem(SIM_KEYS.TODAY_CHECKIN + '_' + employeeId, JSON.stringify({ checkedIn: true, time: now }));
    return record;
  }

  checkOut(employeeId: number): SimAttendance | null {
    const attendance = this.getAttendance();
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString('en-US', { hour12: false });
    
    const record = attendance.find(a => a.employee_id === employeeId && a.date === today);
    if (!record) return null;
    
    record.check_out = now;
    record.status = 'COMPLETED';
    
    localStorage.setItem(SIM_KEYS.ATTENDANCE, JSON.stringify(attendance));
    localStorage.setItem(SIM_KEYS.TODAY_CHECKIN + '_' + employeeId, JSON.stringify({ checkedIn: false, checkedOut: true, checkOutTime: now }));
    return record;
  }

  getTodayStatus(employeeId: number): { checkedIn: boolean; checkedOut: boolean; checkInTime?: string; checkOutTime?: string } {
    const stored = localStorage.getItem(SIM_KEYS.TODAY_CHECKIN + '_' + employeeId);
    if (stored) {
      return JSON.parse(stored);
    }
    return { checkedIn: false, checkedOut: false };
  }

  // Leave Requests
  getLeaveRequests(): SimLeaveRequest[] {
    return initializeIfEmpty(SIM_KEYS.LEAVE_REQUESTS, getDefaultLeaveRequests());
  }

  addLeaveRequest(request: Omit<SimLeaveRequest, 'id' | 'created_at'>): SimLeaveRequest {
    const requests = this.getLeaveRequests();
    const newRequest = {
      ...request,
      id: Math.max(...requests.map(r => r.id), 0) + 1,
      created_at: new Date().toISOString()
    };
    requests.push(newRequest);
    localStorage.setItem(SIM_KEYS.LEAVE_REQUESTS, JSON.stringify(requests));
    return newRequest;
  }

  approveLeaveRequest(id: number): SimLeaveRequest | null {
    const requests = this.getLeaveRequests();
    const request = requests.find(r => r.id === id);
    if (!request) return null;
    request.status = 'APPROVED';
    localStorage.setItem(SIM_KEYS.LEAVE_REQUESTS, JSON.stringify(requests));
    return request;
  }

  rejectLeaveRequest(id: number): SimLeaveRequest | null {
    const requests = this.getLeaveRequests();
    const request = requests.find(r => r.id === id);
    if (!request) return null;
    request.status = 'REJECTED';
    localStorage.setItem(SIM_KEYS.LEAVE_REQUESTS, JSON.stringify(requests));
    return request;
  }

  // Payroll
  getPayroll(): SimPayroll[] {
    return initializeIfEmpty(SIM_KEYS.PAYROLL, getDefaultPayroll());
  }

  generatePayroll(month: string, year: number): SimPayroll[] {
    const employees = this.getEmployees();
    const payroll = this.getPayroll();
    
    const newPayrolls: SimPayroll[] = employees.map((emp, i) => ({
      id: Math.max(...payroll.map(p => p.id), 0) + i + 1,
      employee_id: emp.id,
      employee_name: emp.full_name,
      month,
      year,
      basic_salary: 5000 + (i * 1500),
      allowances: 500 + (i * 100),
      deductions: 300 + (i * 50),
      net_salary: 5200 + (i * 1550),
      status: 'Pending',
      payment_date: ''
    }));
    
    payroll.push(...newPayrolls);
    localStorage.setItem(SIM_KEYS.PAYROLL, JSON.stringify(payroll));
    return newPayrolls;
  }

  // Invitations
  getInvitations(): SimInvitation[] {
    return initializeIfEmpty(SIM_KEYS.INVITATIONS, DEMO_INVITATIONS.map(inv => ({
      ...inv,
      status: 'pending' as const
    })));
  }

  acceptInvitation(id: number): SimInvitation | null {
    const invitations = this.getInvitations();
    const invitation = invitations.find(i => i.id === id);
    if (!invitation) return null;
    invitation.status = 'accepted';
    localStorage.setItem(SIM_KEYS.INVITATIONS, JSON.stringify(invitations));
    return invitation;
  }

  rejectInvitation(id: number): SimInvitation | null {
    const invitations = this.getInvitations();
    const invitation = invitations.find(i => i.id === id);
    if (!invitation) return null;
    invitation.status = 'rejected';
    localStorage.setItem(SIM_KEYS.INVITATIONS, JSON.stringify(invitations));
    return invitation;
  }

  // Export to CSV
  exportToCSV(data: any[], filename: string): void {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // Export payroll to PDF-like format (HTML that can be printed)
  exportPayslip(payroll: SimPayroll): void {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Payslip - ${payroll.employee_name}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
    .company { font-size: 24px; font-weight: bold; color: #2563eb; }
    .title { font-size: 18px; margin-top: 10px; }
    .details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
    .section { background: #f5f5f5; padding: 15px; border-radius: 8px; }
    .section-title { font-weight: bold; margin-bottom: 10px; color: #333; }
    .row { display: flex; justify-content: space-between; padding: 5px 0; }
    .earnings { border-left: 3px solid #22c55e; }
    .deductions { border-left: 3px solid #ef4444; }
    .total { background: #2563eb; color: white; padding: 20px; border-radius: 8px; text-align: center; margin-top: 20px; }
    .total-amount { font-size: 32px; font-weight: bold; }
    .footer { text-align: center; margin-top: 40px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">Dayflow HRMS</div>
    <div class="title">Salary Slip - ${payroll.month} ${payroll.year}</div>
  </div>
  
  <div class="details">
    <div class="section">
      <div class="section-title">Employee Details</div>
      <div class="row"><span>Name:</span><span>${payroll.employee_name}</span></div>
      <div class="row"><span>Employee ID:</span><span>EMP-${String(payroll.employee_id).padStart(4, '0')}</span></div>
      <div class="row"><span>Pay Period:</span><span>${payroll.month} ${payroll.year}</span></div>
      <div class="row"><span>Payment Date:</span><span>${payroll.payment_date || 'Pending'}</span></div>
    </div>
    <div class="section">
      <div class="section-title">Payment Summary</div>
      <div class="row"><span>Status:</span><span>${payroll.status}</span></div>
      <div class="row"><span>Payment Method:</span><span>Bank Transfer</span></div>
    </div>
  </div>
  
  <div class="details">
    <div class="section earnings">
      <div class="section-title">Earnings</div>
      <div class="row"><span>Basic Salary</span><span>$${payroll.basic_salary.toLocaleString()}</span></div>
      <div class="row"><span>Allowances</span><span>$${payroll.allowances.toLocaleString()}</span></div>
      <div class="row" style="border-top: 1px solid #ccc; margin-top: 10px; padding-top: 10px; font-weight: bold;">
        <span>Gross Earnings</span><span>$${(payroll.basic_salary + payroll.allowances).toLocaleString()}</span>
      </div>
    </div>
    <div class="section deductions">
      <div class="section-title">Deductions</div>
      <div class="row"><span>Tax</span><span>$${Math.round(payroll.deductions * 0.6).toLocaleString()}</span></div>
      <div class="row"><span>Insurance</span><span>$${Math.round(payroll.deductions * 0.4).toLocaleString()}</span></div>
      <div class="row" style="border-top: 1px solid #ccc; margin-top: 10px; padding-top: 10px; font-weight: bold;">
        <span>Total Deductions</span><span>$${payroll.deductions.toLocaleString()}</span>
      </div>
    </div>
  </div>
  
  <div class="total">
    <div>Net Salary</div>
    <div class="total-amount">$${payroll.net_salary.toLocaleString()}</div>
  </div>
  
  <div class="footer">
    <p>This is a computer-generated payslip and does not require a signature.</p>
    <p>Generated on ${new Date().toLocaleDateString()}</p>
  </div>
</body>
</html>`;
    
    const blob = new Blob([html], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Payslip_${payroll.employee_name.replace(/\s+/g, '_')}_${payroll.month}_${payroll.year}.html`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // Clear all simulation data
  clearAll(): void {
    Object.values(SIM_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    // Clear individual checkin keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(SIM_KEYS.TODAY_CHECKIN)) {
        localStorage.removeItem(key);
      }
    }
  }
}

export const simData = new SimulationDataManager();
