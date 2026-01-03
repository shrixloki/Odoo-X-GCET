const Document = require('../models/Document');
const Employee = require('../models/Employee');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'documents');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (Document.validateFileType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, JPG, JPEG, PNG files are allowed.'));
    }
  }
});

class DocumentController {
  static getUploadMiddleware() {
    return upload.single('document');
  }

  // Admin actions
  static async uploadDocument(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const { employee_id, document_type } = req.body;

      if (!employee_id || !document_type) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Employee ID and document type are required'
        });
      }

      // Verify employee exists
      const employee = await Employee.findById(employee_id);
      if (!employee) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      // Validate file size
      if (!Document.validateFileSize(req.file.size)) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'File size exceeds 10MB limit'
        });
      }

      // Create document record
      const documentData = {
        employee_id: parseInt(employee_id),
        document_type,
        document_name: req.file.originalname,
        file_url: `/uploads/documents/${req.file.filename}`,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        uploaded_by: req.user.id
      };

      const document = await Document.create(documentData);

      // Create audit log
      await AuditLog.logDocumentUpload(req.user.id, document.id, documentData, req);

      // Create notification for employee
      await Notification.notifyDocumentUploaded(
        employee.user_id,
        document_type,
        req.file.originalname
      );

      res.status(201).json({
        success: true,
        message: 'Document uploaded successfully',
        data: document
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      next(error);
    }
  }

  static async getEmployeeDocuments(req, res, next) {
    try {
      const { employeeId } = req.params;

      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      const documents = await Document.findByEmployee(employeeId);
      const stats = await Document.getDocumentStats(employeeId);

      res.json({
        success: true,
        data: {
          employee: {
            id: employee.id,
            full_name: employee.full_name,
            employee_id: employee.employee_id
          },
          documents,
          stats
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAllDocuments(req, res, next) {
    try {
      const { employee_id, document_type } = req.query;

      const filters = {};
      if (employee_id) filters.employee_id = parseInt(employee_id);
      if (document_type) filters.document_type = document_type;

      const documents = await Document.findAll(filters);
      const stats = await Document.getDocumentStats();

      res.json({
        success: true,
        data: {
          documents,
          stats,
          document_types: Document.getDocumentTypes()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteDocument(req, res, next) {
    try {
      const { id } = req.params;

      const document = await Document.findById(id);
      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Document not found'
        });
      }

      // Delete file from filesystem
      const filePath = path.join(process.cwd(), document.file_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Soft delete from database
      await Document.delete(id);

      // Create audit log
      await AuditLog.create({
        action: 'DOCUMENT_DELETED',
        performed_by: req.user.id,
        entity_type: 'DOCUMENT',
        entity_id: id,
        old_values: document,
        new_values: null,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Employee actions
  static async getMyDocuments(req, res, next) {
    try {
      const employee = await Employee.findByUserId(req.user.id);

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee profile not found'
        });
      }

      const documents = await Document.findByEmployee(employee.id);
      const stats = await Document.getDocumentStats(employee.id);

      res.json({
        success: true,
        data: {
          documents,
          stats,
          document_types: Document.getDocumentTypes()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async downloadDocument(req, res, next) {
    try {
      const { id } = req.params;

      const document = await Document.findById(id);
      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Document not found'
        });
      }

      // Check permissions - employees can only download their own documents
      if (req.user.role === 'EMPLOYEE') {
        const employee = await Employee.findByUserId(req.user.id);
        if (!employee || document.employee_id !== employee.id) {
          return res.status(403).json({
            success: false,
            message: 'Access denied'
          });
        }
      }

      const filePath = path.join(process.cwd(), document.file_url);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: 'File not found on server'
        });
      }

      // Set appropriate headers
      res.setHeader('Content-Type', document.mime_type);
      res.setHeader('Content-Disposition', `attachment; filename="${document.document_name}"`);

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

  static async getDocumentTypes(req, res) {
    res.json({
      success: true,
      data: Document.getDocumentTypes()
    });
  }
}

module.exports = DocumentController;