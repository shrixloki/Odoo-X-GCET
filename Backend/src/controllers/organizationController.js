const Department = require('../models/Department');
const EmployeeManager = require('../models/EmployeeManager');
const Employee = require('../models/Employee');
const AuditLog = require('../models/AuditLog');

class OrganizationController {
  // Department Management
  static async createDepartment(req, res, next) {
    try {
      const department = await Department.create(req.body);
      
      // Create audit log
      await AuditLog.create({
        action: 'DEPARTMENT_CREATED',
        performed_by: req.user.id,
        entity_type: 'DEPARTMENT',
        entity_id: department.id,
        new_values: department,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.status(201).json({
        success: true,
        message: 'Department created successfully',
        data: department
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAllDepartments(req, res, next) {
    try {
      const departments = await Department.findAll();
      
      res.json({
        success: true,
        data: departments
      });
    } catch (error) {
      next(error);
    }
  }

  static async getDepartmentById(req, res, next) {
    try {
      const { id } = req.params;
      const department = await Department.findById(id);
      
      if (!department) {
        return res.status(404).json({
          success: false,
          message: 'Department not found'
        });
      }
      
      const employees = await Department.getDepartmentEmployees(id);
      const stats = await Department.getDepartmentStats(id);
      
      res.json({
        success: true,
        data: {
          department,
          employees,
          stats
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateDepartment(req, res, next) {
    try {
      const { id } = req.params;
      
      const oldDepartment = await Department.findById(id);
      if (!oldDepartment) {
        return res.status(404).json({
          success: false,
          message: 'Department not found'
        });
      }
      
      const updatedDepartment = await Department.update(id, req.body);
      
      // Create audit log
      await AuditLog.create({
        action: 'DEPARTMENT_UPDATED',
        performed_by: req.user.id,
        entity_type: 'DEPARTMENT',
        entity_id: id,
        old_values: oldDepartment,
        new_values: updatedDepartment,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        message: 'Department updated successfully',
        data: updatedDepartment
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteDepartment(req, res, next) {
    try {
      const { id } = req.params;
      
      const department = await Department.findById(id);
      if (!department) {
        return res.status(404).json({
          success: false,
          message: 'Department not found'
        });
      }
      
      await Department.delete(id);
      
      // Create audit log
      await AuditLog.create({
        action: 'DEPARTMENT_DELETED',
        performed_by: req.user.id,
        entity_type: 'DEPARTMENT',
        entity_id: id,
        old_values: department,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        message: 'Department deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Manager-Employee Relationship Management
  static async assignManager(req, res, next) {
    try {
      const { employee_id, manager_id, effective_from } = req.body;
      
      // Validate that both employee and manager exist
      const employee = await Employee.findById(employee_id);
      const manager = await Employee.findById(manager_id);
      
      if (!employee || !manager) {
        return res.status(404).json({
          success: false,
          message: 'Employee or manager not found'
        });
      }
      
      // Prevent self-assignment
      if (employee_id === manager_id) {
        return res.status(400).json({
          success: false,
          message: 'Employee cannot be their own manager'
        });
      }
      
      const relationship = await EmployeeManager.create({
        employee_id,
        manager_id,
        effective_from
      });
      
      // Create audit log
      await AuditLog.create({
        action: 'MANAGER_ASSIGNED',
        performed_by: req.user.id,
        entity_type: 'EMPLOYEE_MANAGER',
        entity_id: relationship.id,
        new_values: relationship,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.status(201).json({
        success: true,
        message: 'Manager assigned successfully',
        data: relationship
      });
    } catch (error) {
      next(error);
    }
  }

  static async getEmployeeManager(req, res, next) {
    try {
      const { employeeId } = req.params;
      
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }
      
      const currentManager = await EmployeeManager.findCurrentManager(employeeId);
      const managerHistory = await EmployeeManager.findByEmployee(employeeId, false);
      const hierarchy = await EmployeeManager.getManagerHierarchy(employeeId);
      
      res.json({
        success: true,
        data: {
          employee: {
            id: employee.id,
            full_name: employee.full_name,
            employee_id: employee.employee_id
          },
          current_manager: currentManager,
          manager_history: managerHistory,
          hierarchy
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getManagerTeam(req, res, next) {
    try {
      const { managerId } = req.params;
      
      const manager = await Employee.findById(managerId);
      if (!manager) {
        return res.status(404).json({
          success: false,
          message: 'Manager not found'
        });
      }
      
      const teamMembers = await EmployeeManager.findTeamMembers(managerId);
      const teamHierarchy = await EmployeeManager.getTeamHierarchy(managerId);
      
      res.json({
        success: true,
        data: {
          manager: {
            id: manager.id,
            full_name: manager.full_name,
            employee_id: manager.employee_id
          },
          team_members: teamMembers,
          team_hierarchy: teamHierarchy
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateManagerRelationship(req, res, next) {
    try {
      const { id } = req.params;
      
      const relationship = await EmployeeManager.updateRelationship(id, req.body);
      
      if (!relationship) {
        return res.status(404).json({
          success: false,
          message: 'Manager relationship not found'
        });
      }
      
      // Create audit log
      await AuditLog.create({
        action: 'MANAGER_RELATIONSHIP_UPDATED',
        performed_by: req.user.id,
        entity_type: 'EMPLOYEE_MANAGER',
        entity_id: id,
        new_values: relationship,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        message: 'Manager relationship updated successfully',
        data: relationship
      });
    } catch (error) {
      next(error);
    }
  }

  static async getOrganizationChart(req, res, next) {
    try {
      const departments = await Department.findAll();
      const organizationChart = [];
      
      for (const department of departments) {
        const employees = await Department.getDepartmentEmployees(department.id);
        const departmentChart = {
          department,
          employees: []
        };
        
        for (const employee of employees) {
          const currentManager = await EmployeeManager.findCurrentManager(employee.id);
          const teamMembers = await EmployeeManager.findTeamMembers(employee.id);
          
          departmentChart.employees.push({
            ...employee,
            current_manager: currentManager,
            team_size: teamMembers.length,
            is_manager: teamMembers.length > 0
          });
        }
        
        organizationChart.push(departmentChart);
      }
      
      res.json({
        success: true,
        data: organizationChart
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyTeam(req, res, next) {
    try {
      const employee = await Employee.findByUserId(req.user.id);
      
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee profile not found'
        });
      }
      
      const teamMembers = await EmployeeManager.findTeamMembers(employee.id);
      const isManager = await EmployeeManager.isManager(employee.id);
      
      res.json({
        success: true,
        data: {
          is_manager: isManager,
          team_members: teamMembers,
          team_size: teamMembers.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyManager(req, res, next) {
    try {
      const employee = await Employee.findByUserId(req.user.id);
      
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee profile not found'
        });
      }
      
      const currentManager = await EmployeeManager.findCurrentManager(employee.id);
      const hierarchy = await EmployeeManager.getManagerHierarchy(employee.id);
      
      res.json({
        success: true,
        data: {
          current_manager: currentManager,
          hierarchy
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = OrganizationController;