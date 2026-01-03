# Dayflow HRMS Backend - Phase 3

A production-ready, enterprise-grade backend for Human Resource Management System (HRMS) called Dayflow. Phase-3 transforms the system into an enterprise-ready HR platform with organizational hierarchy, configurable policies, and scalable infrastructure.

## 🎯 Phase-3 Overview

"Phase-3 transforms Dayflow into an enterprise-ready HR platform with organizational hierarchy, configurable policies, and scalable infrastructure."

## 🏗️ Three-Phase Architecture

- **Phase-1** → Core HR foundation
- **Phase-2** → Payroll & operational intelligence  
- **Phase-3** → Enterprise scalability & configurability

## 🚀 Features

### Core System (Phase 1)
- RESTful API design
- JWT-based authentication
- Role-based authorization (EMPLOYEE, ADMIN)
- PostgreSQL database
- Secure password handling
- Clean separation of routes, controllers, services, and models

### Authentication & Authorization
- Secure login/signup
- JWT token generation with role embedding
- Password encryption using bcrypt
- Protected routes with middleware

### Employee Management
- Employee profile management
- Dashboard with statistics
- Admin employee CRUD operations

### Attendance System
- Check-in/check-out functionality
- Automatic status calculation (PRESENT, ABSENT, LATE, HALF_DAY)
- One check-in per day rule
- Attendance history tracking

### Leave Management
- Leave application system
- Multiple leave types (SICK, CASUAL, ANNUAL, etc.)
- Admin approval/rejection workflow
- Overlapping leave validation

### Payroll Processing (Phase 2)
- Salary structure management
- Automated payroll generation
- Attendance-based salary calculation
- Bulk payroll processing
- Payroll approval workflow
- Payroll analytics and summaries

### Reports & Exports (Phase 2)
- Attendance reports with filtering
- Leave reports with analytics
- Payroll reports and summaries
- Export to PDF and CSV formats
- Dashboard reports for quick insights

### Document Management (Phase 2)
- Secure file upload and storage
- Multiple document types support
- Role-based document access
- Document metadata tracking
- File download with security checks

### Notifications (Phase 2)
- Database-driven notification system
- Leave approval/rejection notifications
- Payroll generation notifications
- Document upload notifications
- Bulk notification support

### Audit Logging (Phase 2)
- Comprehensive audit trail
- User action tracking
- Entity change logging
- IP address and user agent tracking
- Audit analytics and reporting

### Organizational Structure (Phase 3)
- Department management
- Manager-employee relationships
- Hierarchical access control
- Organization chart visualization
- Team management capabilities

### Advanced Shift Management (Phase 3)
- Multiple shift configurations
- Shift assignment to employees
- Grace period and break management
- Overtime calculation
- Shift-based attendance rules

### Policy Configuration (Phase 3)
- Configurable leave policies
- Holiday management
- Working days calculation
- Policy-based leave validation
- Annual leave balance management

### System Settings (Phase 3)
- Centralized configuration management
- Category-based settings
- Import/export configurations
- Runtime setting updates
- Default setting initialization

### Performance Management (Phase 3)
- Performance review system
- Multi-criteria rating system
- Review workflow management
- Performance analytics
- Annual review cycles

### Enterprise Features (Phase 3)
- Centralized logging with Winston
- Docker containerization
- Production-ready configuration
- Health monitoring
- Scalable architecture
- Environment-based configs

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT
- **Validation**: Joi
- **Security**: Helmet, CORS, Rate Limiting
- **Password Hashing**: bcryptjs
- **File Upload**: Multer
- **PDF Generation**: PDFKit
- **CSV Export**: csv-writer
- **Date Handling**: Moment.js
- **Logging**: Winston
- **Compression**: Compression
- **Containerization**: Docker
- **Process Management**: Node.js Cluster (optional)

## 🐳 Docker Deployment

### Quick Start with Docker Compose
```bash
# Clone and setup
git clone <repository-url>
cd dayflow-hrms-backend

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f dayflow-app

# Stop services
docker-compose down
```

### Manual Docker Build
```bash
# Build image
docker build -t dayflow-hrms .

# Run container
docker run -p 3000:3000 --env-file .env dayflow-hrms
```

## 🔧 Installation

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- Docker & Docker Compose (optional)
- npm or yarn

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dayflow-hrms-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=dayflow_hrms
   DB_USER=postgres
   DB_PASSWORD=your_password
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRES_IN=24h
   PORT=3000
   NODE_ENV=development
   BCRYPT_ROUNDS=12
   LOG_LEVEL=info
   ```

4. **Database setup**
   ```bash
   # Create database (run in PostgreSQL)
   CREATE DATABASE dayflow_hrms;
   
   # Run migrations
   npm run migrate
   ```

5. **Initialize Phase 3 setup**
   ```bash
   npm run setup-phase3
   ```

6. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication Endpoints

#### POST /auth/login
Login with email and password.
```json
{
  "email": "admin@dayflow.com",
  "password": "admin123"
}
```

#### POST /auth/signup
Register a new employee account.
```json
{
  "employee_id": "EMP001",
  "email": "john@example.com",
  "password": "password123",
  "full_name": "John Doe",
  "phone": "+1234567890",
  "address": "123 Main St",
  "department": "Engineering",
  "designation": "Software Developer",
  "joining_date": "2024-01-15"
}
```

#### POST /auth/logout
Logout (client-side token removal).

### Employee Endpoints

#### GET /employee/profile
Get employee profile (requires authentication).

#### PUT /employee/profile
Update employee profile (limited fields).

#### GET /employee/dashboard
Get employee dashboard with statistics.

### Admin Endpoints

#### GET /admin/employees
Get all employees (admin only).

#### POST /admin/employees
Create new employee (admin only).

#### PUT /admin/employees/:id
Update employee (admin only).

#### DELETE /admin/employees/:id
Delete employee (admin only).

### Attendance Endpoints

#### POST /attendance/check-in
Check in for the day.

#### POST /attendance/check-out
Check out for the day.

#### GET /attendance/my-records
Get personal attendance records.

#### GET /attendance/today-status
Get today's attendance status.

#### GET /admin/attendance
Get all attendance records (admin only).

#### PUT /admin/attendance/:id
Update attendance record (admin only).

### Leave Endpoints

#### POST /leave/apply
Apply for leave.
```json
{
  "leave_type": "SICK",
  "start_date": "2024-02-01",
  "end_date": "2024-02-03",
  "reason": "Medical treatment required"
}
```

#### GET /leave/my-requests
Get personal leave requests.

#### GET /admin/leave-requests
Get all leave requests (admin only).

#### PUT /admin/leave/:id/approve
Approve leave request (admin only).

#### PUT /admin/leave/:id/reject
Reject leave request (admin only).

### Payroll Endpoints (Phase 2)

#### POST /admin/payroll/generate
Generate payroll for employees.
```json
{
  "month": 12,
  "year": 2024,
  "employee_ids": [1, 2, 3]
}
```

#### GET /admin/payroll
Get all payroll records (admin only).

#### GET /admin/payroll/employee/:employeeId
Get payroll records for specific employee (admin only).

#### GET /payroll/my-payroll
Get personal payroll records.

#### GET /payroll/my-payroll/:month/:year
Get specific month payroll.

#### POST /admin/salary-structure
Create salary structure.
```json
{
  "employee_id": 1,
  "basic_salary": 50000,
  "allowances": {
    "hra": 15000,
    "transport": 5000
  },
  "deductions": {
    "pf": "12%",
    "tax": 5000
  }
}
```

### Reports Endpoints (Phase 2)

#### GET /reports/attendance
Generate attendance report.
Query params: start_date, end_date, employee_id, department, format (json/csv/pdf)

#### GET /reports/leaves
Generate leave report.
Query params: start_date, end_date, employee_id, status, leave_type, format

#### GET /reports/payroll
Generate payroll report.
Query params: month, year, employee_id, status, format

#### GET /reports/download/:filename
Download generated report file.

### Document Endpoints (Phase 2)

#### POST /admin/documents/upload
Upload document for employee (admin only).
Form data: employee_id, document_type, document (file)

#### GET /admin/documents/:employeeId
Get documents for specific employee (admin only).

#### GET /documents/my-documents
Get personal documents.

#### GET /documents/download/:id
Download document file.

### Notification Endpoints (Phase 2)

#### GET /notifications/my-notifications
Get personal notifications.

#### PUT /notifications/:id/read
Mark notification as read.

#### PUT /notifications/mark-all-read
Mark all notifications as read.

### Organization Endpoints (Phase 3)

#### GET /organization/departments
Get all departments.

#### POST /admin/departments
Create new department (admin only).
```json
{
  "name": "Engineering",
  "description": "Software Development Team",
  "head_id": 5
}
```

#### POST /admin/assign-manager
Assign manager to employee (admin only).
```json
{
  "employee_id": 10,
  "manager_id": 5,
  "effective_from": "2024-01-01"
}
```

#### GET /organization/my-team
Get team members (if user is a manager).

#### GET /organization/my-manager
Get current manager and hierarchy.

### Shift Management Endpoints (Phase 3)

#### POST /admin/shifts
Create new shift (admin only).
```json
{
  "name": "Morning Shift",
  "start_time": "08:00:00",
  "end_time": "17:00:00",
  "grace_period": 15,
  "break_duration": 60
}
```

#### POST /admin/shifts/assign
Assign shift to employee (admin only).
```json
{
  "employee_id": 10,
  "shift_id": 2,
  "effective_from": "2024-01-01"
}
```

#### GET /shifts/my-shift
Get personal shift information.

### Policy Management Endpoints (Phase 3)

#### POST /admin/leave-policies
Create leave policy (admin only).
```json
{
  "leave_type": "ANNUAL",
  "annual_limit": 21,
  "carry_forward_allowed": true,
  "carry_forward_limit": 5,
  "min_notice_days": 7,
  "requires_approval": true,
  "approval_level": "MANAGER"
}
```

#### POST /admin/holidays
Create holiday (admin only).
```json
{
  "name": "Independence Day",
  "date": "2024-08-15",
  "type": "PUBLIC",
  "description": "National Holiday"
}
```

#### GET /policies/my-leave-balances
Get personal leave balances.

### System Settings Endpoints (Phase 3)

#### GET /admin/settings
Get all system settings (admin only).

#### PUT /admin/settings/WORKING_HOURS_PER_DAY
Update specific setting (admin only).
```json
{
  "value": 8
}
```

#### PUT /admin/settings
Bulk update settings (admin only).
```json
{
  "settings": {
    "WORKING_HOURS_PER_DAY": 8,
    "LATE_MARK_THRESHOLD": 15,
    "COMPANY_NAME": "Dayflow Technologies"
  }
}
```

### Performance Review Endpoints (Phase 3)

#### POST /admin/performance-reviews
Create performance review (admin only).
```json
{
  "employee_id": 10,
  "reviewer_id": 5,
  "review_period_start": "2024-01-01",
  "review_period_end": "2024-12-31",
  "goals_achievement": 4.2,
  "technical_skills": 4.0,
  "communication_skills": 4.5,
  "leadership_skills": 3.8,
  "feedback": "Excellent performance this year"
}
```

#### GET /performance/my-reviews
Get personal performance reviews.

#### PUT /performance/:id/submit
Submit performance review for approval.

## 🔐 Default Admin Account

- **Email**: admin@dayflow.com
- **Password**: admin123
- **Employee ID**: ADMIN001

## 🗄 Database Schema

### Phase 1 Tables
- **Users**: id, employee_id, email, password_hash, role, is_active, created_at
- **Employees**: id, user_id, full_name, phone, address, department, designation, joining_date
- **Attendance**: id, employee_id, date, check_in, check_out, status
- **Leave Requests**: id, employee_id, leave_type, start_date, end_date, reason, status, admin_comment

### Phase 2 Tables
- **Salary Structures**: id, employee_id, basic_salary, allowances, deductions, effective_from, is_active
- **Payroll**: id, employee_id, month, year, basic_salary, allowances, gross_salary, deductions, net_salary, working_days, present_days, status
- **Documents**: id, employee_id, document_type, document_name, file_url, file_size, mime_type, uploaded_by
- **Audit Logs**: id, action, performed_by, entity_type, entity_id, old_values, new_values, ip_address, user_agent, timestamp
- **Notifications**: id, user_id, title, message, type, is_read, created_at

### Phase 3 Tables
- **Departments**: id, name, description, head_id, is_active, created_at
- **Employee Managers**: id, employee_id, manager_id, effective_from, effective_to, is_active
- **Shifts**: id, name, start_time, end_time, grace_period, break_duration, is_active
- **Employee Shifts**: id, employee_id, shift_id, effective_from, effective_to, is_active
- **Leave Policies**: id, leave_type, annual_limit, carry_forward_allowed, min_notice_days, requires_approval
- **Holidays**: id, name, date, type, description, is_active
- **System Settings**: id, setting_key, setting_value, setting_type, description, is_editable
- **Performance Reviews**: id, employee_id, reviewer_id, review_period_start, review_period_end, overall_rating, feedback, status
- **Employee Leave Balances**: id, employee_id, leave_type, year, allocated_days, used_days, remaining_days
- **Attendance Rules**: id, rule_name, rule_type, rule_value, is_active

## 🛡 Security Features

- JWT token authentication
- Password hashing with bcrypt
- Rate limiting (100 requests per 15 minutes)
- CORS protection
- Helmet security headers
- Input validation with Joi
- SQL injection prevention
- Role-based access control
- File upload security (type and size validation)
- Secure file serving with access controls
- Audit logging for all critical operations
- IP address and user agent tracking
- Manager-level access controls
- Fine-grained permissions system
- Request/response logging
- Security event monitoring

## 📊 Performance & Scalability

- Compression middleware for response optimization
- Database connection pooling
- Efficient indexing strategy
- Pagination for large datasets
- File streaming for downloads
- Memory usage monitoring
- Request timeout handling
- Health check endpoints
- Docker containerization
- Horizontal scaling ready
- Centralized logging with Winston
- Performance metrics tracking

## 📁 File Structure

```
dayflow-hrms-backend/
├── src/
│   ├── config/
│   │   ├── database.js
│   │   └── logger.js (Phase 3)
│   ├── database/
│   │   ├── migrations.sql
│   │   └── migrate.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Employee.js
│   │   ├── Attendance.js
│   │   ├── LeaveRequest.js
│   │   ├── SalaryStructure.js (Phase 2)
│   │   ├── Payroll.js (Phase 2)
│   │   ├── Document.js (Phase 2)
│   │   ├── AuditLog.js (Phase 2)
│   │   ├── Notification.js (Phase 2)
│   │   ├── Department.js (Phase 3)
│   │   ├── EmployeeManager.js (Phase 3)
│   │   ├── Shift.js (Phase 3)
│   │   ├── LeavePolicy.js (Phase 3)
│   │   ├── Holiday.js (Phase 3)
│   │   ├── SystemSetting.js (Phase 3)
│   │   └── PerformanceReview.js (Phase 3)
│   ├── services/
│   │   ├── authService.js
│   │   ├── payrollService.js (Phase 2)
│   │   └── reportService.js (Phase 2)
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── employeeController.js
│   │   ├── attendanceController.js
│   │   ├── leaveController.js
│   │   ├── payrollController.js (Phase 2)
│   │   ├── reportController.js (Phase 2)
│   │   ├── documentController.js (Phase 2)
│   │   ├── notificationController.js (Phase 2)
│   │   ├── auditController.js (Phase 2)
│   │   ├── organizationController.js (Phase 3)
│   │   ├── shiftController.js (Phase 3)
│   │   ├── policyController.js (Phase 3)
│   │   ├── settingsController.js (Phase 3)
│   │   └── performanceController.js (Phase 3)
│   ├── routes/
│   │   ├── auth.js
│   │   ├── employee.js
│   │   ├── admin.js
│   │   ├── attendance.js
│   │   ├── leave.js
│   │   ├── payroll.js (Phase 2)
│   │   ├── reports.js (Phase 2)
│   │   ├── documents.js (Phase 2)
│   │   ├── notifications.js (Phase 2)
│   │   ├── organization.js (Phase 3)
│   │   ├── shifts.js (Phase 3)
│   │   ├── policies.js (Phase 3)
│   │   ├── settings.js (Phase 3)
│   │   └── performance.js (Phase 3)
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── validation.js
│   │   ├── errorHandler.js
│   │   └── logging.js (Phase 3)
│   ├── app.js
│   └── server.js
├── uploads/
│   ├── documents/
│   └── reports/
├── logs/ (Phase 3)
├── Dockerfile (Phase 3)
├── docker-compose.yml (Phase 3)
├── package.json
├── .env.example
└── README.md
```

## 🚦 Status Codes

- **200**: Success
- **201**: Created
- **400**: Bad Request
- **401**: Unauthorized
- **403**: Forbidden
- **404**: Not Found
- **409**: Conflict
- **500**: Internal Server Error

## 📝 Response Format

All API responses follow this format:
```json
{
  "success": true/false,
  "message": "Description",
  "data": {}, // Optional
  "errors": [] // Optional for validation errors
}
```

## 🚀 Deployment

### Production Deployment with Docker

1. **Clone and configure**
   ```bash
   git clone <repository-url>
   cd dayflow-hrms-backend
   cp .env.example .env
   # Edit .env with production values
   ```

2. **Deploy with Docker Compose**
   ```bash
   docker-compose up -d
   ```

3. **Verify deployment**
   ```bash
   curl http://localhost:3000/health
   ```

### Manual Production Deployment

1. **Server setup**
   ```bash
   # Install Node.js, PostgreSQL, and PM2
   npm install -g pm2
   ```

2. **Application setup**
   ```bash
   npm ci --production
   npm run migrate
   ```

3. **Start with PM2**
   ```bash
   pm2 start src/server.js --name dayflow-hrms
   pm2 startup
   pm2 save
   ```

### Environment Variables for Production

```env
NODE_ENV=production
DB_HOST=your_db_host
DB_PASSWORD=secure_password
JWT_SECRET=very_secure_jwt_secret
LOG_LEVEL=warn
FRONTEND_URL=https://your-frontend-domain.com
```

## 📊 Monitoring & Maintenance

### Health Monitoring
- Health check endpoint: `GET /health`
- Database connection monitoring
- Memory usage tracking
- Request performance metrics

### Logging
- Application logs: `logs/combined.log`
- Error logs: `logs/error.log`
- Audit logs: `logs/audit.log`
- Request logs with Winston

### Backup Strategy
- Database backups (automated)
- File uploads backup
- Configuration backup
- Log rotation

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Health check
curl http://localhost:3000/health

# API testing with sample data
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dayflow.com","password":"admin123"}'
```

## 📈 Performance Optimization

- Database indexing for optimal query performance
- Connection pooling for database efficiency
- Response compression for faster data transfer
- File streaming for large downloads
- Pagination for large datasets
- Caching strategies (Redis integration ready)

## 🔧 Configuration Management

### System Settings
All system configurations can be managed through the API:
- Working hours and attendance rules
- Leave policies and limits
- Payroll settings
- Company information
- Email configurations

### Environment-based Configuration
- Development, staging, and production configs
- Feature flags support
- Database connection settings
- External service integrations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Phase-3 Completion Criteria**: ✅
- System supports departments & managers
- Attendance & leave rules are configurable
- Backend is deployment-ready
- HR policies can change without code changes
- Enterprise-grade scalability and monitoring
- Production-ready Docker deployment
- Comprehensive audit and logging system

**"Phase-3 transforms Dayflow into an enterprise-ready HR platform with organizational hierarchy, configurable policies, and scalable infrastructure."**

## 🎯 Three-Phase Summary

- **Phase-1** → Core HR foundation (Authentication, Employees, Attendance, Leave)
- **Phase-2** → Payroll & operational intelligence (Payroll, Reports, Documents, Notifications, Audit)
- **Phase-3** → Enterprise scalability & configurability (Organization, Shifts, Policies, Settings, Performance, Docker)

This comprehensive three-phase architecture delivers a complete, enterprise-ready HRMS solution that can handle real-world organizational needs with production-grade security, scalability, and maintainability.