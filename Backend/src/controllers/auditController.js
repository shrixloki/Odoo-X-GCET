const AuditLog = require('../models/AuditLog');

class AuditController {
  static async getAuditLogs(req, res, next) {
    try {
      const {
        entity_type,
        entity_id,
        performed_by,
        action,
        start_date,
        end_date,
        limit = 100,
        offset = 0
      } = req.query;

      const filters = {};
      if (entity_type) filters.entity_type = entity_type;
      if (entity_id) filters.entity_id = parseInt(entity_id);
      if (performed_by) filters.performed_by = parseInt(performed_by);
      if (action) filters.action = action;
      if (start_date) filters.start_date = start_date;
      if (end_date) filters.end_date = end_date;
      filters.limit = parseInt(limit);
      filters.offset = parseInt(offset);

      const logs = await AuditLog.findAll(filters);
      const stats = await AuditLog.getStats(filters);

      res.json({
        success: true,
        data: {
          logs,
          stats,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            total: logs.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getEntityAuditLogs(req, res, next) {
    try {
      const { entityType, entityId } = req.params;

      const logs = await AuditLog.findByEntity(entityType, parseInt(entityId));

      res.json({
        success: true,
        data: {
          entity_type: entityType,
          entity_id: parseInt(entityId),
          logs
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAuditStats(req, res, next) {
    try {
      const { start_date, end_date } = req.query;

      const filters = {};
      if (start_date) filters.start_date = start_date;
      if (end_date) filters.end_date = end_date;

      const stats = await AuditLog.getStats(filters);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuditController;