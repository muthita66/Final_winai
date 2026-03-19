const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const forms = await prisma.evaluation_forms.findMany();
  console.log("Evaluation Forms in DB:");
  console.log(JSON.stringify(forms, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
