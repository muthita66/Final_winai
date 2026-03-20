const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pfScales = await prisma.grade_scales.findMany({
    where: { letter_grade: { in: ['ผ', 'มผ', 'P', 'F'] } }
  });
  console.log('Pass/Fail Scales:', pfScales);

  const subjects = await prisma.subjects.findMany({
    where: { subject_categories_id: 3 },
    include: { subject_categories: true, evaluation_types: true }
  });
  console.log('Student Development Subjects:', subjects.map(s => ({ 
    id: s.id, 
    code: s.subject_code, 
    name: s.subject_name,
    evalType: s.evaluation_types?.evaluation_name 
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
