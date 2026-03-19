const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check evaluation_forms
  const forms = await prisma.$queryRaw`SELECT * FROM evaluation_forms`;
  console.log('=== evaluation_forms ===');
  console.log(JSON.stringify(forms, null, 2));

  // Check evaluation_sections
  const sections = await prisma.$queryRaw`SELECT * FROM evaluation_sections ORDER BY order_number`;
  console.log('\n=== evaluation_sections ===');
  console.log(JSON.stringify(sections, null, 2));

  // Check evaluation_questions
  const questions = await prisma.$queryRaw`SELECT * FROM evaluation_questions ORDER BY section_id, order_number`;
  console.log('\n=== evaluation_questions ===');
  console.log(JSON.stringify(questions, null, 2));

  // Check evaluation_categories
  const cats = await prisma.$queryRaw`SELECT * FROM evaluation_categories`;
  console.log('\n=== evaluation_categories ===');
  console.log(JSON.stringify(cats, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
