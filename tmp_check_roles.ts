import { prisma } from './src/lib/prisma';

async function main() {
  const positions = await prisma.teacher_positions.findMany();
  console.log('--- Teacher Positions ---');
  console.log(JSON.stringify(positions, null, 2));

  const departments = await prisma.departments.findMany();
  console.log('--- Departments ---');
  console.log(JSON.stringify(departments, null, 2));

  const teachers = await prisma.teachers.findMany({
    include: {
      teacher_positions: true,
      departments: true
    },
    take: 5
  });
  console.log('--- Sample Teachers ---');
  console.log(JSON.stringify(teachers, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
