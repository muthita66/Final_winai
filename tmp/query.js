const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const years = await prisma.academic_years.findMany();
    console.log('YEARS:', JSON.stringify(years));
    
    const count2568 = await prisma.classroom_students.count({
      where: { academic_year: 2568 }
    });
    console.log('COUNT2568:', count2568);

    const levels = await prisma.levels.findMany({
      where: { name: { contains: '1' } },
      include: { classrooms: true }
    });
    console.log('LEVELS:', JSON.stringify(levels));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
