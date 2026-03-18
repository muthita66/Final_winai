const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projectTypes = await prisma.project_types.findMany();
  console.log('Project Types:', JSON.stringify(projectTypes, null, 2));
  const budgetTypes = await prisma.budget_types.findMany();
  console.log('Budget Types:', JSON.stringify(budgetTypes, null, 2));
  const subjectGroups = await prisma.learning_subject_groups.findMany();
  console.log('Subject Groups:', JSON.stringify(subjectGroups, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
