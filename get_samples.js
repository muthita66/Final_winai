const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    const s = await prisma.$queryRaw`SELECT subject_code, subject_name FROM subjects LIMIT 20`;
    console.log('Sample Data:', JSON.stringify(s, null, 2));
  } catch(e) { console.error('Error:', e.message); }
  finally { await prisma.$disconnect(); }
}
run();
