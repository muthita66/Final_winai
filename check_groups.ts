import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const groups = await prisma.learning_subject_groups.findMany();
  console.log('Subject Groups:', groups);
}

main().catch(console.error).finally(() => prisma.$disconnect());
