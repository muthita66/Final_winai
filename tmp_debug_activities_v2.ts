import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
const prisma = new PrismaClient();

async function main() {
    let output = "";
    try {
        output += "=== Events in 2026 (2569 BE) ===\n";
        const events = await prisma.events.findMany({
            where: {
                start_datetime: {
                    gte: new Date('2026-01-01'),
                    lte: new Date('2026-12-31')
                }
            },
            include: {
                activity_evaluation_link: true
            }
        });
        
        output += JSON.stringify(events.map(e => ({
            id: e.id,
            title: e.title,
            start: e.start_datetime.toISOString(),
            has_link: e.activity_evaluation_link.length > 0 ? 'Yes' : 'No'
        })), null, 2) + "\n";

        const student = await prisma.students.findFirst({
            where: {
                first_name: { contains: 'เมฆ' }
            },
            select: { id: true, user_id: true, first_name: true, last_name: true }
        });

        if (student) {
            output += `\n=== Participations for ${student.first_name} ${student.last_name} (User ID: ${student.user_id}) ===\n`;
            const participations = await prisma.event_participants.findMany({
                where: { user_id: student.user_id },
                include: { events: true }
            });
            output += JSON.stringify(participations.map(p => ({
                event_id: p.event_id,
                title: p.events.title,
                status: p.status
            })), null, 2) + "\n";
        } else {
            output += "\nStudent 'เมฆ' not found.\n";
        }

    } catch (e: any) {
        output += "\nError: " + e.message + "\n";
    } finally {
        fs.writeFileSync('d:/new/WinAi_SeeuNextLift/tmp_debug_output.txt', output);
        await prisma.$disconnect();
    }
}

main().catch(console.error);
