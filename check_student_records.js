const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const student = await prisma.students.findFirst({
      where: { first_name: { contains: 'เมธ' }, last_name: { contains: 'ทองดี' } }
    });
    console.log('STUDENT:', JSON.stringify(student, null, 2));
    if (student) {
      const records = await prisma.behavior_records.findMany({
        where: { student_id: student.id }
      });
      console.log('RECORDS:', JSON.stringify(records, null, 2));
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
