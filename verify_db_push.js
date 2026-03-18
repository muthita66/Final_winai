const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    const s = await prisma.subjects.findMany({ take: 1 });
    console.log('Subject keys:', Object.keys(s[0] || {}));
    if (s[0] && 'level' in s[0]) {
      console.log('SUCCESS: level column exists');
    } else {
      console.log('FAILURE: level column is missing');
    }
  } catch(e) { console.error(e); }
  finally { await prisma.$disconnect(); }
}
run();
