const PDFDocument = require('pdfkit');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');
const moment = require('moment');

const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');

class ReportService {
  static async generateAttendanceReport(filters = {}, format = 'json') {
    const { start_date, end_date, employee_id, department } = filters;
    
    let query = `
      SELECT 
        a.date,
        a.check_in,
        a.check_out,
        a.status,
        e.full_name,
        u.employee_id as emp_code,
        e.department,
        e.designation
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (start_date) {
      query += ` AND a.date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }
    
    if (end_date) {
      query += ` AND a.date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }
    
    if (employee_id) {
      query += ` AND a.employee_id = $${paramCount}`;
      params.push(employee_id);
      paramCount++;
    }
    
    if (department) {
      query += ` AND e.department = $${paramCount}`;
      params.push(department);
      paramCount++;
    }
    
    query += ` ORDER BY a.date DESC, e.full_name ASC`;
    
    const pool = require('../config/database');
    const result = await pool.query(query, params);
    const data = result.rows;
    
    if (format === 'csv') {
      return await this.generateCSV(data, 'attendance', [
        { id: 'date', title: 'Date' },
        { id: 'full_name', title: 'Employee Name' },
        { id: 'emp_code', title: 'Employee ID' },
        { id: 'department', title: 'Department' },
        { id: 'check_in', title: 'Check In' },
        { id: 'check_out', title: 'Check Out' },
        { id: 'status', title: 'Status' }
      ]);
    }
    
    if (format === 'pdf') {
      return await this.generateAttendancePDF(data, filters);
    }
    
    return {
      data,
      summary: await this.calculateAttendanceSummary(data)
    };
  }

  static async generateLeaveReport(filters = {}, format = 'json') {
    const { start_date, end_date, employee_id, status, leave_type } = filters;
    
    let query = `
      SELECT 
        lr.leave_type,
        lr.start_date,
        lr.end_date,
        lr.reason,
        lr.status,
        lr.admin_comment,
        lr.created_at,
        e.full_name,
        u.employee_id as emp_code,
        e.department,
        EXTRACT(DAY FROM (lr.end_date - lr.start_date)) + 1 as duration_days
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (start_date) {
      query += ` AND lr.start_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }
    
    if (end_date) {
      query += ` AND lr.end_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }
    
    if (employee_id) {
      query += ` AND lr.employee_id = $${paramCount}`;
      params.push(employee_id);
      paramCount++;
    }
    
    if (status) {
      query += ` AND lr.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
    if (leave_type) {
      query += ` AND lr.leave_type = $${paramCount}`;
      params.push(leave_type);
      paramCount++;
    }
    
    query += ` ORDER BY lr.created_at DESC`;
    
    const pool = require('../config/database');
    const result = await pool.query(query, params);
    const data = result.rows;
    
    if (format === 'csv') {
      return await this.generateCSV(data, 'leave_requests', [
        { id: 'full_name', title: 'Employee Name' },
        { id: 'emp_code', title: 'Employee ID' },
        { id: 'department', title: 'Department' },
        { id: 'leave_type', title: 'Leave Type' },
        { id: 'start_date', title: 'Start Date' },
        { id: 'end_date', title: 'End Date' },
        { id: 'duration_days', title: 'Duration (Days)' },
        { id: 'status', title: 'Status' },
        { id: 'reason', title: 'Reason' }
      ]);
    }
    
    if (format === 'pdf') {
      return await this.generateLeavePDF(data, filters);
    }
    
    return {
      data,
      summary: await this.calculateLeaveSummary(data)
    };
  }

  static async generatePayrollReport(filters = {}, format = 'json') {
    const data = await Payroll.findAll(filters);
    
    if (format === 'csv') {
      return await this.generateCSV(data, 'payroll', [
        { id: 'full_name', title: 'Employee Name' },
        { id: 'emp_code', title: 'Employee ID' },
        { id: 'department', title: 'Department' },
        { id: 'month', title: 'Month' },
        { id: 'year', title: 'Year' },
        { id: 'basic_salary', title: 'Basic Salary' },
        { id: 'allowances', title: 'Allowances' },
        { id: 'gross_salary', title: 'Gross Salary' },
        { id: 'deductions', title: 'Deductions' },
        { id: 'net_salary', title: 'Net Salary' },
        { id: 'working_days', title: 'Working Days' },
        { id: 'present_days', title: 'Present Days' },
        { id: 'status', title: 'Status' }
      ]);
    }
    
    if (format === 'pdf') {
      return await this.generatePayrollPDF(data, filters);
    }
    
    return {
      data,
      summary: await this.calculatePayrollSummary(data)
    };
  }

  static async generateCSV(data, filename, headers) {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'reports');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const filePath = path.join(uploadsDir, `${filename}_${timestamp}.csv`);
    
    const csvWriter = createCsvWriter({
      path: filePath,
      header: headers
    });
    
    await csvWriter.writeRecords(data);
    
    return {
      file_path: filePath,
      file_name: `${filename}_${timestamp}.csv`,
      download_url: `/api/reports/download/${filename}_${timestamp}.csv`
    };
  }

  static async generateAttendancePDF(data, filters) {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'reports');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const filePath = path.join(uploadsDir, `attendance_report_${timestamp}.pdf`);
    
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(filePath));
    
    // Header
    doc.fontSize(20).text('Attendance Report', 50, 50);
    doc.fontSize(12).text(`Generated on: ${moment().format('DD/MM/YYYY HH:mm')}`, 50, 80);
    
    if (filters.start_date || filters.end_date) {
      doc.text(`Period: ${filters.start_date || 'Start'} to ${filters.end_date || 'End'}`, 50, 100);
    }
    
    // Table headers
    let yPosition = 140;
    doc.fontSize(10);
    doc.text('Date', 50, yPosition);
    doc.text('Employee', 120, yPosition);
    doc.text('Department', 220, yPosition);
    doc.text('Check In', 320, yPosition);
    doc.text('Check Out', 380, yPosition);
    doc.text('Status', 450, yPosition);
    
    yPosition += 20;
    
    // Table data
    data.forEach((row, index) => {
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;
      }
      
      doc.text(moment(row.date).format('DD/MM/YYYY'), 50, yPosition);
      doc.text(row.full_name.substring(0, 15), 120, yPosition);
      doc.text(row.department.substring(0, 12), 220, yPosition);
      doc.text(row.check_in || '-', 320, yPosition);
      doc.text(row.check_out || '-', 380, yPosition);
      doc.text(row.status, 450, yPosition);
      
      yPosition += 15;
    });
    
    doc.end();
    
    return {
      file_path: filePath,
      file_name: `attendance_report_${timestamp}.pdf`,
      download_url: `/api/reports/download/attendance_report_${timestamp}.pdf`
    };
  }

  static async generateLeavePDF(data, filters) {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'reports');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const filePath = path.join(uploadsDir, `leave_report_${timestamp}.pdf`);
    
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(filePath));
    
    // Header
    doc.fontSize(20).text('Leave Report', 50, 50);
    doc.fontSize(12).text(`Generated on: ${moment().format('DD/MM/YYYY HH:mm')}`, 50, 80);
    
    // Table headers
    let yPosition = 120;
    doc.fontSize(10);
    doc.text('Employee', 50, yPosition);
    doc.text('Leave Type', 150, yPosition);
    doc.text('Start Date', 220, yPosition);
    doc.text('End Date', 290, yPosition);
    doc.text('Days', 360, yPosition);
    doc.text('Status', 400, yPosition);
    
    yPosition += 20;
    
    // Table data
    data.forEach((row) => {
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;
      }
      
      doc.text(row.full_name.substring(0, 15), 50, yPosition);
      doc.text(row.leave_type, 150, yPosition);
      doc.text(moment(row.start_date).format('DD/MM/YY'), 220, yPosition);
      doc.text(moment(row.end_date).format('DD/MM/YY'), 290, yPosition);
      doc.text(row.duration_days.toString(), 360, yPosition);
      doc.text(row.status, 400, yPosition);
      
      yPosition += 15;
    });
    
    doc.end();
    
    return {
      file_path: filePath,
      file_name: `leave_report_${timestamp}.pdf`,
      download_url: `/api/reports/download/leave_report_${timestamp}.pdf`
    };
  }

  static async generatePayrollPDF(data, filters) {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'reports');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const filePath = path.join(uploadsDir, `payroll_report_${timestamp}.pdf`);
    
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(filePath));
    
    // Header
    doc.fontSize(20).text('Payroll Report', 50, 50);
    doc.fontSize(12).text(`Generated on: ${moment().format('DD/MM/YYYY HH:mm')}`, 50, 80);
    
    if (filters.month && filters.year) {
      doc.text(`Period: ${moment().month(filters.month - 1).format('MMMM')} ${filters.year}`, 50, 100);
    }
    
    // Table headers
    let yPosition = 140;
    doc.fontSize(9);
    doc.text('Employee', 50, yPosition);
    doc.text('Basic', 150, yPosition);
    doc.text('Allowances', 200, yPosition);
    doc.text('Gross', 260, yPosition);
    doc.text('Deductions', 310, yPosition);
    doc.text('Net Salary', 370, yPosition);
    doc.text('Days', 430, yPosition);
    doc.text('Status', 470, yPosition);
    
    yPosition += 20;
    
    // Table data
    data.forEach((row) => {
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;
      }
      
      doc.text(row.full_name.substring(0, 15), 50, yPosition);
      doc.text(`₹${parseFloat(row.basic_salary).toFixed(0)}`, 150, yPosition);
      doc.text(`₹${parseFloat(row.allowances).toFixed(0)}`, 200, yPosition);
      doc.text(`₹${parseFloat(row.gross_salary).toFixed(0)}`, 260, yPosition);
      doc.text(`₹${parseFloat(row.deductions).toFixed(0)}`, 310, yPosition);
      doc.text(`₹${parseFloat(row.net_salary).toFixed(0)}`, 370, yPosition);
      doc.text(`${row.present_days}/${row.working_days}`, 430, yPosition);
      doc.text(row.status, 470, yPosition);
      
      yPosition += 12;
    });
    
    doc.end();
    
    return {
      file_path: filePath,
      file_name: `payroll_report_${timestamp}.pdf`,
      download_url: `/api/reports/download/payroll_report_${timestamp}.pdf`
    };
  }

  static async calculateAttendanceSummary(data) {
    const summary = {
      total_records: data.length,
      present: data.filter(r => r.status === 'PRESENT').length,
      absent: data.filter(r => r.status === 'ABSENT').length,
      late: data.filter(r => r.status === 'LATE').length,
      half_day: data.filter(r => r.status === 'HALF_DAY').length
    };
    
    summary.attendance_percentage = summary.total_records > 0 
      ? ((summary.present + summary.late + (summary.half_day * 0.5)) / summary.total_records * 100).toFixed(2)
      : 0;
    
    return summary;
  }

  static async calculateLeaveSummary(data) {
    return {
      total_requests: data.length,
      approved: data.filter(r => r.status === 'APPROVED').length,
      rejected: data.filter(r => r.status === 'REJECTED').length,
      pending: data.filter(r => r.status === 'PENDING').length,
      total_days: data.reduce((sum, r) => sum + parseInt(r.duration_days), 0),
      by_type: this.groupByLeaveType(data)
    };
  }

  static async calculatePayrollSummary(data) {
    return {
      total_employees: data.length,
      total_gross: data.reduce((sum, r) => sum + parseFloat(r.gross_salary), 0),
      total_deductions: data.reduce((sum, r) => sum + parseFloat(r.deductions), 0),
      total_net: data.reduce((sum, r) => sum + parseFloat(r.net_salary), 0),
      average_salary: data.length > 0 
        ? data.reduce((sum, r) => sum + parseFloat(r.net_salary), 0) / data.length 
        : 0
    };
  }

  static groupByLeaveType(data) {
    const grouped = {};
    data.forEach(record => {
      if (!grouped[record.leave_type]) {
        grouped[record.leave_type] = { count: 0, days: 0 };
      }
      grouped[record.leave_type].count++;
      grouped[record.leave_type].days += parseInt(record.duration_days);
    });
    return grouped;
  }
}

module.exports = ReportService;