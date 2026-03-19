import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("=== Events in 2026 (2569 BE) ===");
        const events = await prisma.events.findMany({
            where: {
                start_datetime: {
                    gte: new Date('2026-01-01'),
                    lte: new Date('2026-12-31')
                }
            },
            include: {
                _count: {
                    select: { event_participants: true }
                },
                activity_evaluation_link: true
            }
        });
        
        console.table(events.map(e => ({
            id: e.id,
            title: e.title,
            start: e.start_datetime.toISOString(),
            participants: e._count.event_participants,
            has_link: e.activity_evaluation_link.length > 0 ? 'Yes' : 'No'
        })));

        // Check a specific student's participations
        // The student name from screenshot is "เด็กชาย เมฆ ทองดี"
        const student = await prisma.students.findFirst({
            where: {
                first_name: { contains: 'เมฆ' }
            },
            select: { id: true, user_id: true, first_name: true, last_name: true }
        });

        if (student) {
            console.log(`\n=== Participations for ${student.first_name} ${student.last_name} (User ID: ${student.user_id}) ===`);
            const participations = await prisma.event_participants.findMany({
                where: { user_id: student.user_id },
                include: { events: true }
            });
            console.table(participations.map(p => ({
                event_id: p.event_id,
                title: p.events.title,
                status: p.status
            })));
        }

    } catch (e) {
        console.error(e);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
