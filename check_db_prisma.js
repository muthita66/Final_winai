const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const answersCols = await prisma.$queryRawUnsafe(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'evaluation_answers'
        ORDER BY ordinal_position;
    `);
    console.log("Columns in evaluation_answers:");
    console.table(answersCols);

    const responsesCols = await prisma.$queryRawUnsafe(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'evaluation_responses'
        ORDER BY ordinal_position;
    `);
    console.log("Columns in evaluation_responses:");
    console.table(responsesCols);

    const tables = await prisma.$queryRawUnsafe(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name LIKE 'evaluation_%';
    `);
    console.log("Evaluation related tables:");
    console.table(tables);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
