const ReportService = require('../services/reportService');
const fs = require('fs');
const path = require('path');

class ReportController {
  static async getAttendanceReport(req, res, next) {
    try {
      const { start_date, end_date, employee_id, department, format = 'json' } = req.query;
      
      const filters = {};
      if (start_date) filters.start_date = start_date;
      if (end_date) filters.end_date = end_date;
      if (employee_id) filters.employee_id = parseInt(employee_id);
      if (department) filters.department = department;
      
      const report = await ReportService.generateAttendanceReport(filters, format);
      
      if (format === 'csv' || format === 'pdf') {
        res.json({
          success: true,
          message: 'Report generated successfully',
          data: report
        });
      } else {
        res.json({
          success: true,
          data: report
        });
      }
    } catch (error) {
      next(error);
    }
  }

  static async getLeaveReport(req, res, next) {
    try {
      const { start_date, end_date, employee_id, status, leave_type, format = 'json' } = req.query;
      
      const filters = {};
      if (start_date) filters.start_date = start_date;
      if (end_date) filters.end_date = end_date;
      if (employee_id) filters.employee_id = parseInt(employee_id);
      if (status) filters.status = status;
      if (leave_type) filters.leave_type = leave_type;
      
      const report = await ReportService.generateLeaveReport(filters, format);
      
      if (format === 'csv' || format === 'pdf') {
        res.json({
          success: true,
          message: 'Report generated successfully',
          data: report
        });
      } else {
        res.json({
          success: true,
          data: report
        });
      }
    } catch (error) {
      next(error);
    }
  }

  static async getPayrollReport(req, res, next) {
    try {
      const { month, year, employee_id, status, format = 'json' } = req.query;
      
      const filters = {};
      if (month) filters.month = parseInt(month);
      if (year) filters.year = parseInt(year);
      if (employee_id) filters.employee_id = parseInt(employee_id);
      if (status) filters.status = status;
      
      const report = await ReportService.generatePayrollReport(filters, format);
      
      if (format === 'csv' || format === 'pdf') {
        res.json({
          success: true,
          message: 'Report generated successfully',
          data: report
        });
      } else {
        res.json({
          success: true,
          data: report
        });
      }
    } catch (error) {
      next(error);
    }
  }

  static async downloadReport(req, res, next) {
    try {
      const { filename } = req.params;
      
      // Security: Only allow specific file patterns
      if (!/^(attendance|leave|payroll)_/.test(filename)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file name'
        });
      }
      
      const filePath = path.join(process.cwd(), 'uploads', 'reports', filename);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }
      
      // Set appropriate headers
      const ext = path.extname(filename).toLowerCase();
      if (ext === '.pdf') {
        res.setHeader('Content-Type', 'application/pdf');
      } else if (ext === '.csv') {
        res.setHeader('Content-Type', 'text/csv');
      }
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      
      fileStream.on('error', (error) => {
        console.error('File stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Error downloading file'
          });
        }
      });
      
    } catch (error) {
      next(error);
    }
  }

  static async getDashboardReports(req, res, next) {
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      // Get current month's summary data
      const attendanceReport = await ReportService.generateAttendanceReport({
        start_date: `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`,
        end_date: `${currentYear}-${currentMonth.toString().padStart(2, '0')}-31`
      });
      
      const leaveReport = await ReportService.generateLeaveReport({
        start_date: `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`,
        end_date: `${currentYear}-${currentMonth.toString().padStart(2, '0')}-31`
      });
      
      const payrollReport = await ReportService.generatePayrollReport({
        month: currentMonth,
        year: currentYear
      });
      
      res.json({
        success: true,
        data: {
          period: {
            month: currentMonth,
            year: currentYear
          },
          attendance: attendanceReport.summary,
          leave: leaveReport.summary,
          payroll: payrollReport.summary
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getReportsList(req, res, next) {
    try {
      const reportsDir = path.join(process.cwd(), 'uploads', 'reports');
      
      if (!fs.existsSync(reportsDir)) {
        return res.json({
          success: true,
          data: []
        });
      }
      
      const files = fs.readdirSync(reportsDir);
      const reports = files.map(filename => {
        const filePath = path.join(reportsDir, filename);
        const stats = fs.statSync(filePath);
        
        return {
          filename,
          size: stats.size,
          created_at: stats.birthtime,
          download_url: `/api/reports/download/${filename}`
        };
      }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      res.json({
        success: true,
        data: reports
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteReport(req, res, next) {
    try {
      const { filename } = req.params;
      
      // Security: Only allow specific file patterns
      if (!/^(attendance|leave|payroll)_/.test(filename)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file name'
        });
      }
      
      const filePath = path.join(process.cwd(), 'uploads', 'reports', filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }
      
      fs.unlinkSync(filePath);
      
      res.json({
        success: true,
        message: 'Report deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ReportController;