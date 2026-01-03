# DayFlow HRMS

A modern, full-stack Human Resource Management System built with React and Node.js.

![DayFlow HRMS](https://img.shields.io/badge/DayFlow-HRMS-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Overview

DayFlow is an enterprise-grade HRMS solution designed to streamline HR operations including employee management, attendance tracking, leave management, payroll processing, and performance reviews.

## Features

### Employee Management
- Complete employee lifecycle management
- Profile management with document storage
- Department and team organization
- Manager-employee hierarchy

### Attendance System
- Real-time check-in/check-out
- Automatic status calculation (Present, Late, Absent, Half-day)
- Shift management with grace periods
- Attendance reports and analytics

### Leave Management
- Multiple leave types (Sick, Casual, Annual, etc.)
- Configurable leave policies
- Approval workflow
- Leave balance tracking

### Payroll Processing
- Automated salary calculation
- Attendance-based deductions
- Bulk payroll generation
- Export to PDF/CSV

### Performance Reviews
- Multi-criteria rating system
- Review cycles management
- Performance analytics
- Goal tracking

### Admin Dashboard
- Real-time statistics
- Employee overview
- Quick actions
- System health monitoring

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- TailwindCSS for styling
- Shadcn/ui components
- React Query for data fetching
- React Router for navigation

### Backend
- Node.js with Express
- PostgreSQL / SQLite database
- JWT authentication
- Winston logging
- Docker support

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- PostgreSQL (or SQLite for development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/shrixloki/Odoo-X-GCET.git
   cd Odoo-X-GCET
   ```

2. **Backend Setup**
   ```bash
   cd Backend
   npm install
   cp .env.example .env
   # Edit .env with your database credentials
   npm run setup-sqlite  # For SQLite
   # OR
   npm run migrate       # For PostgreSQL
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd Frontend
   npm install
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000

### Default Credentials
- **Admin**: admin@dayflow.com / admin123
- **Demo Mode**: Available for testing without backend

## Project Structure

```
├── Backend/
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth, validation, etc.
│   │   └── config/         # Configuration files
│   ├── tests/              # Test files
│   └── docker-compose.yml  # Docker setup
│
├── Frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom hooks
│   │   └── lib/            # Utilities and API
│   └── public/             # Static assets
```

## API Documentation

### Authentication
```
POST /api/auth/login     - User login
POST /api/auth/signup    - User registration
POST /api/auth/logout    - User logout
```

### Employees
```
GET    /api/employee/profile      - Get profile
PUT    /api/employee/profile      - Update profile
GET    /api/admin/employees       - List all employees
POST   /api/admin/employees       - Create employee
PUT    /api/admin/employees/:id   - Update employee
DELETE /api/admin/employees/:id   - Delete employee
```

### Attendance
```
POST /api/attendance/check-in     - Check in
POST /api/attendance/check-out    - Check out
GET  /api/attendance/my-records   - Get attendance history
GET  /api/attendance/today-status - Today's status
```

### Leave
```
POST /api/leave/apply             - Apply for leave
GET  /api/leave/my-requests       - Get leave requests
PUT  /api/admin/leave/:id/approve - Approve leave
PUT  /api/admin/leave/:id/reject  - Reject leave
```

### Payroll
```
POST /api/admin/payroll/generate  - Generate payroll
GET  /api/payroll/my-payroll      - Get personal payroll
GET  /api/admin/payroll           - Get all payroll records
```

## Docker Deployment

```bash
cd Backend
docker-compose up -d
```

## Environment Variables

### Backend (.env)
```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dayflow_hrms
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h
```

## Testing

```bash
# Backend tests
cd Backend
npm test

# Run specific test suites
npm run test:unit
npm run test:property
npm run test:integration
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built for Odoo x GCET Hackathon
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)

---

Made with ❤️ by Team DayFlow
