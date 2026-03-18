const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Checking "projects" table columns ---');
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'projects'
      ORDER BY ordinal_position;
    `;
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Error querying columns:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
