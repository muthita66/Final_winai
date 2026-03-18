const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- LEVELS ---');
    const levels = await prisma.levels.findMany();
    console.log(levels.map(l => l.name));

    console.log('\n--- CLASSROOMS (Sample) ---');
    const classrooms = await prisma.classrooms.findMany({ take: 5 });
    console.log(classrooms.map(c => c.room_name));

    console.log('\n--- TEACHERS (Sample) ---');
    const teachers = await prisma.teachers.findMany({
        include: {
            learning_subject_groups: true,
            teacher_positions: true,
            classroom_advisors: {
                include: {
                    classrooms: {
                        include: { levels: true }
                    }
                }
            }
        },
        take: 5
    });

    teachers.forEach(t => {
        const advisor = t.classroom_advisors?.[0];
        const classLevel = advisor?.classrooms?.levels?.name || '';
        const roomName = advisor?.classrooms?.room_name || '';
        console.log(`Teacher: ${t.first_name}, Dept: ${t.learning_subject_groups?.group_name}, Level: ${classLevel}, RoomName: ${roomName}`);
    });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
