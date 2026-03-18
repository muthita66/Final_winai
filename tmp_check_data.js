const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const levels = await prisma.levels.findMany({ select: { name: true } });
        console.log('LEVELS:', levels.map(l => l.name));

        const classrooms = await prisma.classrooms.findMany({ include: { levels: true }, take: 20 });
        console.log('CLASSROOMS:', classrooms.map(c => `${c.levels?.name}/${c.room_name}`));

        const teachers = await prisma.teachers.findMany({
            include: {
                classroom_advisors: {
                    include: { classrooms: { include: { levels: true } } }
                }
            },
            take: 10
        });
        
        teachers.forEach(t => {
            const adv = t.classroom_advisors?.[0];
            console.log(`Teacher ${t.teacher_code}: Advisor for ${adv?.classrooms?.levels?.name}/${adv?.classrooms?.room_name}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
