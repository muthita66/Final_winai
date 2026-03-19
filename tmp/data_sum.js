const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  const result = {};
  try {
    // 1. All levels
    result.levels = await prisma.levels.findMany();
    
    // 2. Classrooms for those levels
    result.all_classrooms = await prisma.classrooms.findMany();
    
    // 3. Count records in classroom_students per classroom and year
    const counts = await prisma.classroom_students.groupBy({
        by: ['classroom_id', 'academic_year'],
        _count: { student_id: true }
    });
    result.counts_per_room_year = counts;

    fs.writeFileSync('d:/new/WinAi_SeeuNextLift/tmp/data_summary.json', JSON.stringify(result, null, 2));
    console.log('DONE');
  } catch (e) {
    fs.writeFileSync('d:/new/WinAi_SeeuNextLift/tmp/data_error.txt', e.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();
