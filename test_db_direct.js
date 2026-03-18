const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Testing Database Content ---');
  try {
    const projectTypes = await prisma.project_types.findMany();
    console.log('Project Types Count:', projectTypes.length);
    console.log('Project Types:', JSON.stringify(projectTypes, null, 2));

    const subjectGroups = await prisma.learning_subject_groups.findMany();
    console.log('Subject Groups Count:', subjectGroups.length);
    console.log('Subject Groups:', JSON.stringify(subjectGroups, null, 2));

    const budgetTypes = await prisma.budget_types.findMany();
    console.log('Budget Types Count:', budgetTypes.length);
  } catch (e) {
    console.error('Error querying database:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
