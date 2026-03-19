const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const types = [
    { type_name: 'คะแนนชิ้นงาน' },
    { type_name: 'คะแนนสอบกลางภาค' },
    { type_name: 'คะแนนสอบปลายภาค' },
  ];

  for (const type of types) {
    await prisma.grade_category_types.upsert({
      where: { type_name: type.type_name },
      update: {},
      create: type,
    });
  }
  console.log('Seed successful');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
