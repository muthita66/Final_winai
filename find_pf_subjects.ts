import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const subjects = await prisma.subjects.findMany({
    where: {
      OR: [
        { subject_categories_id: 3 },
        { evaluation_type_id: 2 }
      ]
    },
    include: {
      teaching_assignments: {
        select: { id: true }
      }
    },
    take: 5
  });
  console.log(JSON.stringify(subjects, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
