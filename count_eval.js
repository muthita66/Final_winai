const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const formsCount = await prisma.evaluation_forms.count();
  const questionsCount = await prisma.evaluation_questions.count();
  const sectionsCount = await prisma.evaluation_sections.count();
  
  console.log({ formsCount, sectionsCount, questionsCount });
}

main().catch(console.error).finally(() => prisma.$disconnect());
