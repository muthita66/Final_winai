const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const userCount = await prisma.users.count();
    const teacherCount = await prisma.teachers.count();
    console.log('USER COUNT:', userCount);
    console.log('TEACHER COUNT:', teacherCount);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
