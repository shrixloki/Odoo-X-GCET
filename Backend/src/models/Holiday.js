const pool = require('../config/database');
const moment = require('moment');

class Holiday {
  static async create(holidayData) {
    const { name, date, type, description } = holidayData;
    
    const query = `
      INSERT INTO holidays (name, date, type, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const result = await pool.query(query, [name, date, type || 'PUBLIC', description]);
    return result.rows[0];
  }

  static async findAll(year = null, activeOnly = true) {
    let query = `SELECT * FROM holidays`;
    const params = [];
    let paramCount = 1;
    
    const conditions = [];
    
    if (activeOnly) {
      conditions.push(`is_active = true`);
    }
    
    if (year) {
      conditions.push(`EXTRACT(YEAR FROM date) = $${paramCount}`);
      params.push(year);
      paramCount++;
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY date ASC`;
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async findById(id) {
    const query = `SELECT * FROM holidays WHERE id = $1`;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async findByDate(date) {
    const query = `
      SELECT * FROM holidays 
      WHERE date = $1 AND is_active = true
    `;
    
    const result = await pool.query(query, [date]);
    return result.rows[0];
  }

  static async findByDateRange(startDate, endDate) {
    const query = `
      SELECT * FROM holidays 
      WHERE date >= $1 AND date <= $2 AND is_active = true
      ORDER BY date ASC
    `;
    
    const result = await pool.query(query, [startDate, endDate]);
    return result.rows;
  }

  static async update(id, updateData) {
    const { name, date, type, description } = updateData;
    
    const query = `
      UPDATE holidays 
      SET name = COALESCE($1, name),
          date = COALESCE($2, date),
          type = COALESCE($3, type),
          description = COALESCE($4, description)
      WHERE id = $5
      RETURNING *
    `;
    
    const result = await pool.query(query, [name, date, type, description, id]);
    return result.rows[0];
  }

  static async delete(id) {
    const query = `
      UPDATE holidays 
      SET is_active = false
      WHERE id = $1
      RETURNING id
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async isHoliday(date) {
    const holiday = await this.findByDate(date);
    return !!holiday;
  }

  static async getHolidaysInMonth(year, month) {
    const startDate = moment(`${year}-${month}-01`).startOf('month').format('YYYY-MM-DD');
    const endDate = moment(`${year}-${month}-01`).endOf('month').format('YYYY-MM-DD');
    
    return await this.findByDateRange(startDate, endDate);
  }

  static async getUpcomingHolidays(days = 30) {
    const startDate = moment().format('YYYY-MM-DD');
    const endDate = moment().add(days, 'days').format('YYYY-MM-DD');
    
    return await this.findByDateRange(startDate, endDate);
  }

  static async getHolidayStats(year) {
    const query = `
      SELECT 
        type,
        COUNT(*) as count,
        ARRAY_AGG(name ORDER BY date) as holiday_names
      FROM holidays 
      WHERE EXTRACT(YEAR FROM date) = $1 AND is_active = true
      GROUP BY type
      ORDER BY type ASC
    `;
    
    const result = await pool.query(query, [year]);
    return result.rows;
  }

  static async createBulkHolidays(holidays) {
    const values = [];
    const placeholders = [];
    
    holidays.forEach((holiday, index) => {
      const baseIndex = index * 4;
      placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4})`);
      values.push(
        holiday.name,
        holiday.date,
        holiday.type || 'PUBLIC',
        holiday.description || null
      );
    });

    const query = `
      INSERT INTO holidays (name, date, type, description)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (date, name) DO NOTHING
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows;
  }

  static async getWorkingDaysInMonth(year, month) {
    const startDate = moment(`${year}-${month}-01`).startOf('month');
    const endDate = moment(`${year}-${month}-01`).endOf('month');
    
    const holidays = await this.getHolidaysInMonth(year, month);
    const holidayDates = holidays.map(h => h.date);
    
    let workingDays = 0;
    const current = startDate.clone();
    
    while (current.isSameOrBefore(endDate)) {
      const currentDate = current.format('YYYY-MM-DD');
      const dayOfWeek = current.day();
      
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Check if it's not a holiday
        if (!holidayDates.includes(currentDate)) {
          workingDays++;
        }
      }
      
      current.add(1, 'day');
    }
    
    return workingDays;
  }

  static async isWorkingDay(date) {
    const momentDate = moment(date);
    const dayOfWeek = momentDate.day();
    
    // Check if it's a weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }
    
    // Check if it's a holiday
    const isHolidayDate = await this.isHoliday(date);
    return !isHolidayDate;
  }

  static getDefaultHolidays(year) {
    return [
      { name: 'New Year\'s Day', date: `${year}-01-01`, type: 'PUBLIC' },
      { name: 'Republic Day', date: `${year}-01-26`, type: 'PUBLIC' },
      { name: 'Independence Day', date: `${year}-08-15`, type: 'PUBLIC' },
      { name: 'Gandhi Jayanti', date: `${year}-10-02`, type: 'PUBLIC' },
      { name: 'Christmas Day', date: `${year}-12-25`, type: 'PUBLIC' }
    ];
  }
}

module.exports = Holiday;