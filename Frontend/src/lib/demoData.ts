// Demo Data Manager - Provides demo user profiles and authentication for demo mode

export interface DemoUser {
  id: number;
  email: string;
  password: string;
  full_name: string;
  role: 'Admin' | 'HR_Manager' | 'Employee';
  department: string;
  designation: string;
}

// Exactly 3 demo profiles
export const DEMO_USERS: DemoUser[] = [
  {
    id: 1,
    email: 'admin@demo.com',
    password: 'demo123',
    full_name: 'Alex Johnson',
    role: 'Admin',
    department: 'Management',
    designation: 'System Administrator'
  },
  {
    id: 2,
    email: 'hr@demo.com',
    password: 'demo123',
    full_name: 'Sarah Williams',
    role: 'HR_Manager',
    department: 'Human Resources',
    designation: 'HR Manager'
  },
  {
    id: 3,
    email: 'employee@demo.com',
    password: 'demo123',
    full_name: 'Mike Chen',
    role: 'Employee',
    department: 'Engineering',
    designation: 'Software Developer'
  }
];

// Sample invitations for demo
export const DEMO_INVITATIONS = [
  {
    id: 1,
    from: 'Sarah Williams',
    type: 'team_join' as const,
    message: 'You have been invited to join the HR Team',
    status: 'pending' as const,
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    from: 'Alex Johnson',
    type: 'project_invite' as const,
    message: 'Join the Q1 Performance Review project',
    status: 'pending' as const,
    createdAt: new Date().toISOString()
  }
];

export const DEMO_STORAGE_KEYS = {
  IS_DEMO_MODE: 'hrms_demo_mode',
  DEMO_USER: 'hrms_demo_user',
  INVITATIONS: 'hrms_demo_invitations'
};

// Authenticate with demo credentials
export function authenticateDemo(email: string, password: string): DemoUser | null {
  const user = DEMO_USERS.find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );
  return user || null;
}

// Get demo user by role
export function getDemoUserByRole(role: 'Admin' | 'HR_Manager' | 'Employee'): DemoUser | null {
  return DEMO_USERS.find(u => u.role === role) || null;
}

// Get all demo users
export function getDemoUsers(): DemoUser[] {
  return DEMO_USERS;
}

// Check if email is a demo email
export function isDemoEmail(email: string): boolean {
  return DEMO_USERS.some(u => u.email.toLowerCase() === email.toLowerCase());
}

// Clear all demo data from storage
export function clearDemoData(): void {
  Object.values(DEMO_STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
}

// Initialize demo data
export function initializeDemoData(): void {
  clearDemoData();
  localStorage.setItem(DEMO_STORAGE_KEYS.INVITATIONS, JSON.stringify(DEMO_INVITATIONS));
}
