const app = require('./app');
const pool = require('./config/database');

const PORT = process.env.PORT || 3000;

// Test database connection before starting server
async function startServer() {
  try {
    // Test database connection
    await pool.query('SELECT datetime("now") as current_time');
    console.log('✅ Database connection established');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Dayflow HRMS API server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

startServer();