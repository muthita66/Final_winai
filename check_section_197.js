const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sectionId = 197;
  console.log(`Checking Section ID: ${sectionId}`);

  const categories = await prisma.grade_categories.findMany({
    where: { teaching_assignment_id: sectionId },
    include: {
      assessment_items: {
        include: {
          student_scores: {
            take: 5,
            include: { enrollments: { select: { student_id: true } } }
          }
        }
      }
    }
  });

  console.log(JSON.stringify(categories, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
