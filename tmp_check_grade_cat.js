const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const res = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'grade_categories'`;
    console.log('Columns in DB:', JSON.stringify(res, null, 2));
    
    // Check if the missing column "name" is named something else
    const all = await prisma.$queryRaw`SELECT * FROM grade_categories LIMIT 1`;
    console.log('Sample row:', JSON.stringify(all, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
