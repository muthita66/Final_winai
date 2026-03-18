const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.time('Prisma Query');
  const count = await prisma.students.count();
  console.timeEnd('Prisma Query');
  console.log('Total students:', count);
  await prisma.$disconnect();
}

main();
