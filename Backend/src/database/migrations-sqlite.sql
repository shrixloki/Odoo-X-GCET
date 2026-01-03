-- Dayflow HRMS Database Schema - SQLite Version
-- Production-ready schema with all features

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('Employee', 'Admin', 'HR_Manager')),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Employees table for HR data
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    phone VARCHAR(20),
    address TEXT,
    department VARCHAR(100),
    designation VARCHAR(100),
    joining_date DATE NOT NULL,
    salary DECIMAL(12,2) DEFAULT 0,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    manager_id INTEGER REFERENCES employees(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    head_id INTEGER REFERENCES employees(id),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in_time TIME,
    check_out_time TIME,
    work_hours DECIMAL(5,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PRESENT' CHECK (status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'LATE')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, date)
);

-- Leave requests table
CREATE TABLE IF NOT EXISTS leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(50) NOT NULL CHECK (leave_type IN ('SICK', 'CASUAL', 'ANNUAL', 'MATERNITY', 'PATERNITY', 'EMERGENCY')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_requested INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approved_by INTEGER REFERENCES users(id),
    approval_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Salary structures table
CREATE TABLE IF NOT EXISTS salary_structures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    basic_salary DECIMAL(12,2) NOT NULL,
    allowances TEXT DEFAULT '{}', -- JSON as TEXT in SQLite
    deductions TEXT DEFAULT '{}', -- JSON as TEXT in SQLite
    effective_from DATE NOT NULL DEFAULT (date('now')),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Payroll table
CREATE TABLE IF NOT EXISTS payroll (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL CHECK (year >= 2020),
    basic_salary DECIMAL(12,2) NOT NULL,
    allowances DECIMAL(12,2) DEFAULT 0,
    gross_salary DECIMAL(12,2) NOT NULL,
    deductions DECIMAL(12,2) DEFAULT 0,
    net_salary DECIMAL(12,2) NOT NULL,
    working_days INTEGER NOT NULL,
    present_days INTEGER NOT NULL,
    leave_days INTEGER DEFAULT 0,
    overtime_hours DECIMAL(5,2) DEFAULT 0,
    overtime_amount DECIMAL(10,2) DEFAULT 0,
    attendance_summary TEXT DEFAULT '{}', -- JSON as TEXT
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'PAID')),
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
    approved_by INTEGER REFERENCES users(id),
    UNIQUE(employee_id, month, year)
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('CONTRACT', 'ID_PROOF', 'ADDRESS_PROOF', 'EDUCATION', 'EXPERIENCE', 'MEDICAL', 'OTHER')),
    document_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action VARCHAR(100) NOT NULL,
    performed_by INTEGER REFERENCES users(id),
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    old_values TEXT, -- JSON as TEXT
    new_values TEXT, -- JSON as TEXT
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('LEAVE_APPROVED', 'LEAVE_REJECTED', 'PAYROLL_GENERATED', 'DOCUMENT_UPLOADED', 'GENERAL')),
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Employee managers (reporting hierarchy)
CREATE TABLE IF NOT EXISTS employee_managers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    manager_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    effective_from DATE NOT NULL DEFAULT (date('now')),
    effective_to DATE,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, effective_from)
);

-- Shifts table
CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_period INTEGER DEFAULT 15, -- minutes
    break_duration INTEGER DEFAULT 60, -- minutes
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Employee shift assignments
CREATE TABLE IF NOT EXISTS employee_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    shift_id INTEGER REFERENCES shifts(id) ON DELETE CASCADE,
    effective_from DATE NOT NULL DEFAULT (date('now')),
    effective_to DATE,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, effective_from)
);

-- Leave policies table
CREATE TABLE IF NOT EXISTS leave_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    leave_type VARCHAR(50) NOT NULL CHECK (leave_type IN ('SICK', 'CASUAL', 'ANNUAL', 'MATERNITY', 'PATERNITY', 'EMERGENCY')),
    annual_limit INTEGER NOT NULL,
    carry_forward_allowed BOOLEAN DEFAULT 0,
    carry_forward_limit INTEGER DEFAULT 0,
    min_notice_days INTEGER DEFAULT 1,
    max_consecutive_days INTEGER,
    requires_approval BOOLEAN DEFAULT 1,
    approval_level VARCHAR(20) DEFAULT 'MANAGER' CHECK (approval_level IN ('MANAGER', 'HR', 'ADMIN')),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(leave_type)
);

-- Holidays table
CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    type VARCHAR(20) DEFAULT 'PUBLIC' CHECK (type IN ('PUBLIC', 'OPTIONAL', 'RESTRICTED')),
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, name)
);

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(20) DEFAULT 'STRING' CHECK (setting_type IN ('STRING', 'NUMBER', 'BOOLEAN', 'JSON')),
    description TEXT,
    is_editable BOOLEAN DEFAULT 1,
    updated_by INTEGER REFERENCES users(id),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Performance reviews table
CREATE TABLE IF NOT EXISTS performance_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    reviewer_id INTEGER REFERENCES employees(id),
    review_period_start DATE NOT NULL,
    review_period_end DATE NOT NULL,
    overall_rating DECIMAL(3,2) CHECK (overall_rating >= 1.0 AND overall_rating <= 5.0),
    goals_achievement DECIMAL(3,2),
    technical_skills DECIMAL(3,2),
    communication_skills DECIMAL(3,2),
    leadership_skills DECIMAL(3,2),
    feedback TEXT,
    employee_comments TEXT,
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'REVIEWED', 'APPROVED')),
    submitted_at DATETIME,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Employee leave balances table
CREATE TABLE IF NOT EXISTS employee_leave_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    allocated_days INTEGER NOT NULL DEFAULT 0,
    used_days INTEGER NOT NULL DEFAULT 0,
    carried_forward_days INTEGER NOT NULL DEFAULT 0,
    remaining_days INTEGER NOT NULL DEFAULT 0, -- Will be calculated in application
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, leave_type, year)
);

-- Attendance rules table
CREATE TABLE IF NOT EXISTS attendance_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('LATE_MARK', 'HALF_DAY', 'OVERTIME', 'MINIMUM_HOURS')),
    rule_value TEXT NOT NULL, -- JSON as TEXT
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_salary_structures_employee ON salary_structures(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_employee_period ON payroll(employee_id, year, month);
CREATE INDEX IF NOT EXISTS idx_documents_employee ON documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- Insert default data

-- Insert default departments
INSERT OR IGNORE INTO departments (name, description) VALUES 
('Human Resources', 'HR Department'),
('Information Technology', 'IT Department'),
('Finance', 'Finance Department'),
('Operations', 'Operations Department'),
('Sales', 'Sales Department'),
('Marketing', 'Marketing Department');

-- Insert default shifts
INSERT OR IGNORE INTO shifts (name, start_time, end_time, grace_period) VALUES 
('General Shift', '09:00:00', '18:00:00', 15),
('Morning Shift', '08:00:00', '17:00:00', 15),
('Evening Shift', '14:00:00', '23:00:00', 15),
('Night Shift', '22:00:00', '07:00:00', 15);

-- Insert default leave policies
INSERT OR IGNORE INTO leave_policies (leave_type, annual_limit, carry_forward_allowed, carry_forward_limit, min_notice_days) VALUES 
('ANNUAL', 21, 1, 5, 7),
('SICK', 12, 0, 0, 0),
('CASUAL', 12, 0, 0, 1),
('MATERNITY', 180, 0, 0, 30),
('PATERNITY', 15, 0, 0, 15),
('EMERGENCY', 5, 0, 0, 0);

-- Insert default system settings
INSERT OR IGNORE INTO system_settings (setting_key, setting_value, setting_type, description, is_editable) VALUES 
('WORKING_HOURS_PER_DAY', '8', 'NUMBER', 'Standard working hours per day', 1),
('WORKING_DAYS_PER_WEEK', '5', 'NUMBER', 'Standard working days per week', 1),
('PAYROLL_CUTOFF_DATE', '25', 'NUMBER', 'Monthly payroll cutoff date', 1),
('LATE_MARK_THRESHOLD', '15', 'NUMBER', 'Minutes after which employee is marked late', 1),
('HALF_DAY_THRESHOLD', '4', 'NUMBER', 'Minimum hours for full day attendance', 1),
('OVERTIME_THRESHOLD', '8', 'NUMBER', 'Hours after which overtime is calculated', 1),
('COMPANY_NAME', 'Dayflow Technologies', 'STRING', 'Company name', 1),
('COMPANY_ADDRESS', 'Tech Park, Innovation City', 'STRING', 'Company address', 1),
('LEAVE_APPROVAL_REQUIRED', 'true', 'BOOLEAN', 'Whether leave requests require approval', 1),
('AUTO_APPROVE_SICK_LEAVE', 'false', 'BOOLEAN', 'Auto approve sick leave requests', 1);

-- Insert default attendance rules
INSERT OR IGNORE INTO attendance_rules (rule_name, rule_type, rule_value) VALUES 
('Late Mark Rule', 'LATE_MARK', '{"threshold_minutes": 15, "penalty": "LATE_MARK"}'),
('Half Day Rule', 'HALF_DAY', '{"minimum_hours": 4, "action": "HALF_DAY"}'),
('Overtime Rule', 'OVERTIME', '{"threshold_hours": 8, "multiplier": 1.5}'),
('Minimum Hours Rule', 'MINIMUM_HOURS', '{"minimum_hours": 8, "action": "FULL_DAY"}');

-- Insert default admin user (password: admin123)
INSERT OR IGNORE INTO users (employee_id, email, password_hash, full_name, role) 
VALUES ('ADMIN001', 'admin@dayflow.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/hL.BoqjO6', 'System Administrator', 'Admin');

-- Insert admin employee record
INSERT OR IGNORE INTO employees (user_id, phone, address, department, designation, joining_date, salary)
SELECT u.id, '+1234567890', 'Head Office', 'Information Technology', 'System Admin', date('now'), 100000.00
FROM users u WHERE u.email = 'admin@dayflow.com';

-- Create some sample employees for testing
INSERT OR IGNORE INTO users (employee_id, email, password_hash, full_name, role) VALUES 
('EMP001', 'john.doe@dayflow.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/hL.BoqjO6', 'John Doe', 'Employee'),
('EMP002', 'jane.smith@dayflow.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/hL.BoqjO6', 'Jane Smith', 'Employee'),
('HR001', 'hr.manager@dayflow.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/hL.BoqjO6', 'HR Manager', 'HR_Manager');

INSERT OR IGNORE INTO employees (user_id, phone, address, department, designation, joining_date, salary)
SELECT u.id, '+1234567891', '123 Main St', 'Information Technology', 'Software Developer', '2024-01-15', 75000.00
FROM users u WHERE u.email = 'john.doe@dayflow.com';

INSERT OR IGNORE INTO employees (user_id, phone, address, department, designation, joining_date, salary)
SELECT u.id, '+1234567892', '456 Oak Ave', 'Human Resources', 'HR Executive', '2024-02-01', 65000.00
FROM users u WHERE u.email = 'jane.smith@dayflow.com';

INSERT OR IGNORE INTO employees (user_id, phone, address, department, designation, joining_date, salary)
SELECT u.id, '+1234567893', '789 Pine St', 'Human Resources', 'HR Manager', '2023-12-01', 85000.00
FROM users u WHERE u.email = 'hr.manager@dayflow.com';

-- Insert some sample holidays
INSERT OR IGNORE INTO holidays (name, date, type, description) VALUES 
('New Year Day', '2024-01-01', 'PUBLIC', 'New Year celebration'),
('Independence Day', '2024-08-15', 'PUBLIC', 'Independence Day celebration'),
('Gandhi Jayanti', '2024-10-02', 'PUBLIC', 'Gandhi Jayanti celebration'),
('Christmas', '2024-12-25', 'PUBLIC', 'Christmas celebration');