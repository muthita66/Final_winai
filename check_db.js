const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cats = await prisma.subject_categories.findMany();
  console.log("Categories:", cats);
  
  const types = await prisma.evaluation_types.findMany();
  console.log("Evaluation Types:", types);
}

main().catch(console.error).finally(() => prisma.$disconnect());
