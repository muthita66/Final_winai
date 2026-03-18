const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    const s = await prisma.subjects.count();
    const g = await prisma.learning_subject_groups.count();
    const l = await prisma.levels.count();
    const t = await prisma.teaching_assignments.count();
    console.log(`Counts -> Subjects: ${s}, Groups: ${g}, Levels: ${l}, Assignments: ${t}`);
    
    const sampleS = await prisma.subjects.findMany({ take: 3, include: { learning_subject_groups: true } });
    console.log('Sample Subjects:', JSON.stringify(sampleS, null, 2));
  } catch(e) { console.error(e); }
  finally { await prisma.$disconnect(); }
}
run();
