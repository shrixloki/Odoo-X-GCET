const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Dayflow HRMS Phase 2...\n');

// Create upload directories
const uploadDirs = [
  'uploads',
  'uploads/documents',
  'uploads/reports'
];

uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  } else {
    console.log(`📁 Directory already exists: ${dir}`);
  }
});

// Check if .env file exists
if (!fs.existsSync('.env')) {
  console.log('\n⚠️  .env file not found. Please copy .env.example to .env and configure your settings.');
  console.log('   cp .env.example .env');
} else {
  console.log('\n✅ .env file found');
}

console.log('\n📋 Phase 2 Setup Complete!');
console.log('\nNext steps:');
console.log('1. Install dependencies: npm install');
console.log('2. Configure your .env file with database credentials');
console.log('3. Run database migrations: npm run migrate');
console.log('4. Start the server: npm run dev');
console.log('\n🎯 Phase 2 Features:');
console.log('- ✅ Payroll Processing');
console.log('- ✅ Reports & Exports (PDF/CSV)');
console.log('- ✅ Document Management');
console.log('- ✅ Notifications System');
console.log('- ✅ Audit Logging');
console.log('- ✅ Enhanced Security');
console.log('\n🌟 Ready for production deployment!');