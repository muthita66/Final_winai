const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  const result = {};
  try {
    result.academic_years = await prisma.academic_years.findMany();
    result.classrooms = await prisma.classrooms.findMany({
        include: { levels: true }
    });
    result.classroom_students_2568 = await prisma.classroom_students.count({
      where: { academic_year: 2568 }
    });
    result.classroom_students_2567 = await prisma.classroom_students.count({
      where: { academic_year: 2567 }
    });
    
    // Check specific room from screenshot
    const rooms = await prisma.classrooms.findMany({
      where: { room_name: { contains: '1' } },
      take: 5
    });
    result.sample_rooms = rooms;
    
    if (rooms.length > 0) {
      result.students_in_room_1_all_years = await prisma.classroom_students.findMany({
        where: { classroom_id: rooms[0].id },
        take: 10,
        include: { students: true }
      });
    }

    fs.writeFileSync('d:/new/WinAi_SeeuNextLift/tmp/db_check.json', JSON.stringify(result, null, 2));
    console.log('DONE');
  } catch (e) {
    fs.writeFileSync('d:/new/WinAi_SeeuNextLift/tmp/db_error.txt', e.stack);
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
