const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const sectionId = 200; // From user screenshot
    console.log(`Checking for blocking relations for section ${sectionId}...`);
    
    const assignment = await prisma.teaching_assignments.findUnique({
        where: { id: sectionId },
        select: { grade_scale_group_id: true }
    });
    
    if (!assignment?.grade_scale_group_id) {
        console.log('No custom grade scale group found for this assignment.');
        return;
    }
    
    const groupId = assignment.grade_scale_group_id;
    console.log(`Found custom group ID: ${groupId}`);
    
    const customScales = await prisma.grade_scales.findMany({
        where: { grade_scale_group_id: groupId },
        select: { id: true, letter_grade: true }
    });
    
    const scaleIds = customScales.map(s => s.id);
    console.log(`Custom scale IDs: ${scaleIds.join(', ')}`);
    
    const blockingGrades = await prisma.final_grades.findMany({
        where: { grade_scale_id: { in: scaleIds } },
        select: { id: true, enrollment_id: true, letter_grade: true }
    });
    
    console.log(`Total final_grades records referencing these scales: ${blockingGrades.length}`);
    
    if (blockingGrades.length > 0) {
        console.log('BLOCK DETECTED: Deletion will fail unless these relations are cleared.');
    } else {
        console.log('No blocking relations found.');
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
