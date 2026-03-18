const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const id = 4;
    const title = "ปฐมนิเทศนักเรียนใหม่ ม.1 และ ม.4";
    const description = "กิจกรรมแนะนำโรงเรียนและพบครูที่ปรึกษา";
    const event_date = "2026-03-16";
    const responsible_teacher_id = null; // using null for simple test 
    const location = "หอประชุมใหญ่";
    const startTime = "09:00";
    const endTime = "16:00";

    const startDate = new Date(event_date);
    if (startTime) {
        const [hours, minutes] = startTime.split(':').map(Number);
        startDate.setHours(hours, minutes, 0);
    }

    const endDate = new Date(event_date);
    if (endTime) {
        const [hours, minutes] = endTime.split(':').map(Number);
        endDate.setHours(hours, minutes, 0);
    } else {
        endDate.setHours(23, 59, 59);
    }

    console.log('Sending this to database for update:');
    console.log({
        title,
        description,
        start_datetime: startDate,
        end_datetime: endDate,
        is_all_day: !startTime && !endTime,
        location,
        teacher_id: responsible_teacher_id ?? null,
    });

    try {
        const res = await prisma.events.update({
            where: { id },
            data: {
                title,
                description,
                start_datetime: startDate,
                end_datetime: endDate,
                is_all_day: !startTime && !endTime,
                location: location || null,
                teacher_id: responsible_teacher_id ?? null,
            }
        });
        console.log('Update success!', res);
    } catch (e) {
        console.error('Update fails!', e);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
