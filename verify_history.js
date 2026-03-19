const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("--- Verifying History Fetching ---");
  try {
    const student = await prisma.students.findFirst();
    if (!student) {
        console.log("No students found in DB.");
        return;
    }
    console.log(`Checking history for student ID: ${student.id} (${student.first_name})`);

    const history = await prisma.behavior_records.findMany({
      where: {
        student_id: student.id
      },
      include: {
        behavior_types: true,
        semesters: { include: { academic_years: true } }
      },
      orderBy: { created_at: 'desc' }
    });

    console.log(`Found ${history.length} records.`);
    if (history.length > 0) {
        const statuses = history.reduce((acc, curr) => {
            acc[curr.status || 'NULL'] = (acc[curr.status || 'NULL'] || 0) + 1;
            return acc;
        }, {});
        console.log("Status counts in history:", JSON.stringify(statuses, null, 2));
        console.log("Sample record (first):", JSON.stringify({
            status: history[0].status,
            type: history[0].behavior_types?.name,
            points: history[0].points_awarded,
            note: history[0].note,
            reason: history[0].reject_reason
        }, null, 2));
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
