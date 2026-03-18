const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const genders = await prisma.genders.findMany();
  console.log('Genders:', JSON.stringify(genders, null, 2));
  
  const student = await prisma.students.findFirst({
    include: { genders: true }
  });
  console.log('First Student Gender:', JSON.stringify(student?.genders, null, 2));
  
  await prisma.$disconnect();
}

main();
