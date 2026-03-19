import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Academic Years ---');
  const years = await prisma.academic_years.findMany();
  console.log(JSON.stringify(years, null, 2));

  console.log('\n--- Classroom Students for Year 2568 ---');
  const csCount = await prisma.classroom_students.count({
    where: { academic_year: 2568 }
  });
  console.log(`Count: ${csCount}`);

  console.log('\n--- First 5 Classroom Students regardless of year ---');
  const cs = await prisma.classroom_students.findMany({
    take: 5
  });
  console.log(JSON.stringify(cs, null, 2));

  console.log('\n--- Classrooms for Level 1 ---');
  const level1 = await prisma.levels.findFirst({
    where: { name: { contains: '1' } }
  });
  if (level1) {
    const rooms = await prisma.classrooms.findMany({
      where: { grade_level_id: level1.id }
    });
    console.log(JSON.stringify(rooms, null, 2));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
