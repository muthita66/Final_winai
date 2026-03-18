const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Reset sequences first
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('events', 'id'), coalesce(max(id),0) + 1, false) FROM events;`);
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('event_participants', 'id'), coalesce(max(id),0) + 1, false) FROM event_participants;`);

    const student = await prisma.students.findFirst({ where: { student_code: '6801001' } });
    if (!student) return console.log('Student not found');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    const endTomorrow = new Date(tomorrow);
    endTomorrow.setHours(12, 0, 0, 0);

    let sampleEvent = await prisma.events.findFirst({ where: { title: 'ปฐมนิเทศนักเรียนใหม่' } });
    if (!sampleEvent) {
        sampleEvent = await prisma.events.create({
            data: {
                title: 'ปฐมนิเทศนักเรียนใหม่',
                description: 'กิจกรรมปฐมนิเทศสำหรับนักเรียนชั้นมัธยมศึกษาปีที่ 1 และ 4',
                start_datetime: tomorrow,
                end_datetime: endTomorrow,
                location: 'หอประชุมใหญ่',
                visibility: 'public'
            }
        });
        console.log('Created sample event:', sampleEvent.id);
    } else {
        await prisma.events.update({
            where: { id: sampleEvent.id },
            data: { start_datetime: tomorrow, end_datetime: endTomorrow }
        });
        console.log('Updated existing event:', sampleEvent.id);
    }

    const existingPart = await prisma.event_participants.findUnique({
        where: { event_id_user_id: { event_id: sampleEvent.id, user_id: student.user_id } }
    });

    if (!existingPart) {
        await prisma.event_participants.create({
            data: {
                event_id: sampleEvent.id,
                user_id: student.user_id,
                status: 'registered'
            }
        });
        console.log('Registered student to event');
    } else {
        console.log('Student already registered to event');
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
