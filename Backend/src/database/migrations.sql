-- Dayflow HRMS Database Schema
-- Phase 1 - Core HR Operations

-- Create database (run manually)
-- CREATE DATABASE dayflow_hrms;

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('EMPLOYEE', 'ADMIN')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employees table for HR data
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    department VARCHAR(100),
    designation VARCHAR(100),
    joining_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in TIME,
    check_out TIME,
    status VARCHAR(20) DEFAULT 'PRESENT' CHECK (status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'LATE')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, date)
);

-- Leave requests table
CREATE TABLE IF NOT EXISTS leave_requests (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(50) NOT NULL CHECK (leave_type IN ('SICK', 'CASUAL', 'ANNUAL', 'MATERNITY', 'PATERNITY', 'EMERGENCY')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    admin_comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);

-- Phase 2 Extensions: Payroll & Operational Intelligence

-- Salary structures table
CREATE TABLE IF NOT EXISTS salary_structures (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    basic_salary DECIMAL(12,2) NOT NULL,
    allowances JSONB DEFAULT '{}',
    deductions JSONB DEFAULT '{}',
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payroll table
CREATE TABLE IF NOT EXISTS payroll (
    id SERIAL PRIMARY KEY,
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
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'PAID')),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    approved_by INTEGER REFERENCES users(id),
    UNIQUE(employee_id, month, year)
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('CONTRACT', 'ID_PROOF', 'ADDRESS_PROOF', 'EDUCATION', 'EXPERIENCE', 'MEDICAL', 'OTHER')),
    document_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    performed_by INTEGER REFERENCES users(id),
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('LEAVE_APPROVED', 'LEAVE_REJECTED', 'PAYROLL_GENERATED', 'DOCUMENT_UPLOADED', 'GENERAL')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Additional indexes for Phase 2
CREATE INDEX IF NOT EXISTS idx_salary_structures_employee ON salary_structures(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_structures_active ON salary_structures(employee_id, is_active);
CREATE INDEX IF NOT EXISTS idx_payroll_employee_period ON payroll(employee_id, year, month);
CREATE INDEX IF NOT EXISTS idx_payroll_status ON payroll(status);
CREATE INDEX IF NOT EXISTS idx_documents_employee ON documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- Phase 3 Extensions: Enterprise, Scale & Configuration

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    head_id INTEGER REFERENCES employees(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employee managers (reporting hierarchy)
CREATE TABLE IF NOT EXISTS employee_managers (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    manager_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, effective_from)
);

-- Shifts table
CREATE TABLE IF NOT EXISTS shifts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_period INTEGER DEFAULT 15, -- minutes
    break_duration INTEGER DEFAULT 60, -- minutes
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employee shift assignments
CREATE TABLE IF NOT EXISTS employee_shifts (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    shift_id INTEGER REFERENCES shifts(id) ON DELETE CASCADE,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, effective_from)
);

-- Leave policies table
CREATE TABLE IF NOT EXISTS leave_policies (
    id SERIAL PRIMARY KEY,
    leave_type VARCHAR(50) NOT NULL CHECK (leave_type IN ('SICK', 'CASUAL', 'ANNUAL', 'MATERNITY', 'PATERNITY', 'EMERGENCY')),
    annual_limit INTEGER NOT NULL,
    carry_forward_allowed BOOLEAN DEFAULT false,
    carry_forward_limit INTEGER DEFAULT 0,
    min_notice_days INTEGER DEFAULT 1,
    max_consecutive_days INTEGER,
    requires_approval BOOLEAN DEFAULT true,
    approval_level VARCHAR(20) DEFAULT 'MANAGER' CHECK (approval_level IN ('MANAGER', 'HR', 'ADMIN')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(leave_type)
);

-- Holidays table
CREATE TABLE IF NOT EXISTS holidays (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    type VARCHAR(20) DEFAULT 'PUBLIC' CHECK (type IN ('PUBLIC', 'OPTIONAL', 'RESTRICTED')),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, name)
);

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(20) DEFAULT 'STRING' CHECK (setting_type IN ('STRING', 'NUMBER', 'BOOLEAN', 'JSON')),
    description TEXT,
    is_editable BOOLEAN DEFAULT true,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance reviews table
CREATE TABLE IF NOT EXISTS performance_reviews (
    id SERIAL PRIMARY KEY,
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
    submitted_at TIMESTAMP,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employee leave balances table
CREATE TABLE IF NOT EXISTS employee_leave_balances (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    allocated_days INTEGER NOT NULL DEFAULT 0,
    used_days INTEGER NOT NULL DEFAULT 0,
    carried_forward_days INTEGER NOT NULL DEFAULT 0,
    remaining_days INTEGER GENERATED ALWAYS AS (allocated_days + carried_forward_days - used_days) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, leave_type, year)
);

-- Attendance rules table
CREATE TABLE IF NOT EXISTS attendance_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('LATE_MARK', 'HALF_DAY', 'OVERTIME', 'MINIMUM_HOURS')),
    rule_value JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Additional indexes for Phase 3
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
CREATE INDEX IF NOT EXISTS idx_employee_managers_employee ON employee_managers(employee_id, is_active);
CREATE INDEX IF NOT EXISTS idx_employee_managers_manager ON employee_managers(manager_id, is_active);
CREATE INDEX IF NOT EXISTS idx_shifts_active ON shifts(is_active);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_employee ON employee_shifts(employee_id, is_active);
CREATE INDEX IF NOT EXISTS idx_leave_policies_type ON leave_policies(leave_type, is_active);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date, is_active);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_employee ON performance_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_reviewer ON performance_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_employee_leave_balances_employee_year ON employee_leave_balances(employee_id, year);
CREATE INDEX IF NOT EXISTS idx_attendance_rules_type ON attendance_rules(rule_type, is_active);

-- Insert default departments
INSERT INTO departments (name, description) VALUES 
('Human Resources', 'HR Department'),
('Information Technology', 'IT Department'),
('Finance', 'Finance Department'),
('Operations', 'Operations Department'),
('Sales', 'Sales Department'),
('Marketing', 'Marketing Department')
ON CONFLICT (name) DO NOTHING;

-- Insert default shifts
INSERT INTO shifts (name, start_time, end_time, grace_period) VALUES 
('General Shift', '09:00:00', '18:00:00', 15),
('Morning Shift', '08:00:00', '17:00:00', 15),
('Evening Shift', '14:00:00', '23:00:00', 15),
('Night Shift', '22:00:00', '07:00:00', 15)
ON CONFLICT DO NOTHING;

-- Insert default leave policies
INSERT INTO leave_policies (leave_type, annual_limit, carry_forward_allowed, carry_forward_limit, min_notice_days) VALUES 
('ANNUAL', 21, true, 5, 7),
('SICK', 12, false, 0, 0),
('CASUAL', 12, false, 0, 1),
('MATERNITY', 180, false, 0, 30),
('PATERNITY', 15, false, 0, 15),
('EMERGENCY', 5, false, 0, 0)
ON CONFLICT (leave_type) DO NOTHING;

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_editable) VALUES 
('WORKING_HOURS_PER_DAY', '8', 'NUMBER', 'Standard working hours per day', true),
('WORKING_DAYS_PER_WEEK', '5', 'NUMBER', 'Standard working days per week', true),
('PAYROLL_CUTOFF_DATE', '25', 'NUMBER', 'Monthly payroll cutoff date', true),
('LATE_MARK_THRESHOLD', '15', 'NUMBER', 'Minutes after which employee is marked late', true),
('HALF_DAY_THRESHOLD', '4', 'NUMBER', 'Minimum hours for full day attendance', true),
('OVERTIME_THRESHOLD', '8', 'NUMBER', 'Hours after which overtime is calculated', true),
('COMPANY_NAME', 'Dayflow Technologies', 'STRING', 'Company name', true),
('COMPANY_ADDRESS', 'Tech Park, Innovation City', 'STRING', 'Company address', true),
('LEAVE_APPROVAL_REQUIRED', 'true', 'BOOLEAN', 'Whether leave requests require approval', true),
('AUTO_APPROVE_SICK_LEAVE', 'false', 'BOOLEAN', 'Auto approve sick leave requests', true)
ON CONFLICT (setting_key) DO NOTHING;

-- Insert default attendance rules
INSERT INTO attendance_rules (rule_name, rule_type, rule_value) VALUES 
('Late Mark Rule', 'LATE_MARK', '{"threshold_minutes": 15, "penalty": "LATE_MARK"}'),
('Half Day Rule', 'HALF_DAY', '{"minimum_hours": 4, "action": "HALF_DAY"}'),
('Overtime Rule', 'OVERTIME', '{"threshold_hours": 8, "multiplier": 1.5}'),
('Minimum Hours Rule', 'MINIMUM_HOURS', '{"minimum_hours": 8, "action": "FULL_DAY"}')
ON CONFLICT DO NOTHING;

-- Insert default admin user (password: admin123)
INSERT INTO users (employee_id, email, password_hash, role) 
VALUES ('ADMIN001', 'admin@dayflow.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/hL.BoqjO6', 'ADMIN')
ON CONFLICT (email) DO NOTHING;

INSERT INTO employees (user_id, full_name, phone, address, department, designation, joining_date)
SELECT u.id, 'System Administrator', '+1234567890', 'Head Office', 'Information Technology', 'System Admin', CURRENT_DATE
FROM users u WHERE u.email = 'admin@dayflow.com'
ON CONFLICT DO NOTHING;