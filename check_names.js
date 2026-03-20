const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const depts = await prisma.departments.findMany();
  console.log('Departments:', JSON.stringify(depts, null, 2));
  
  const positions = await prisma.teacher_positions.findMany();
  console.log('Positions:', JSON.stringify(positions, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
