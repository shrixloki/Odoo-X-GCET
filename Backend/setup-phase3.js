const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Dayflow HRMS Phase 3 - Enterprise, Scale & Configuration...\n');

// Create upload directories
const uploadDirs = [
  'uploads',
  'uploads/documents',
  'uploads/reports',
  'logs'
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

// Check if Docker is available
const { execSync } = require('child_process');
try {
  execSync('docker --version', { stdio: 'ignore' });
  console.log('✅ Docker is available');
  console.log('   You can use: docker-compose up -d');
} catch (error) {
  console.log('⚠️  Docker not found. Manual setup required.');
}

console.log('\n📋 Phase 3 Setup Complete!');
console.log('\n🎯 Phase 3 Features:');
console.log('- ✅ Organizational Structure (Departments & Hierarchy)');
console.log('- ✅ Advanced Shift Management');
console.log('- ✅ Configurable Leave Policies');
console.log('- ✅ Holiday Management');
console.log('- ✅ System Settings Configuration');
console.log('- ✅ Performance Review System');
console.log('- ✅ Enhanced Audit Logging');
console.log('- ✅ Centralized Logging with Winston');
console.log('- ✅ Docker Support');
console.log('- ✅ Production-Ready Configuration');

console.log('\n📚 Next steps:');
console.log('1. Install dependencies: npm install');
console.log('2. Configure your .env file with database credentials');
console.log('3. Run database migrations: npm run migrate');
console.log('4. Start the server: npm run dev');
console.log('\n🐳 Docker Deployment:');
console.log('1. docker-compose up -d');
console.log('2. Access API at http://localhost:3000');
console.log('3. Check health at http://localhost:3000/health');

console.log('\n🏆 Enterprise Features:');
console.log('- Manager-level approvals');
console.log('- Hierarchical access control');
console.log('- Configurable attendance rules');
console.log('- Policy-based leave validation');
console.log('- Performance management');
console.log('- Comprehensive audit trails');
console.log('- Scalable logging infrastructure');

console.log('\n🌟 "Phase-3 transforms Dayflow into an enterprise-ready HR platform with organizational hierarchy, configurable policies, and scalable infrastructure."');

console.log('\n📊 Phase Summary:');
console.log('Phase-1 → Core HR foundation');
console.log('Phase-2 → Payroll & operational intelligence');
console.log('Phase-3 → Enterprise scalability & configurability');

console.log('\n🎉 Ready for enterprise deployment!');