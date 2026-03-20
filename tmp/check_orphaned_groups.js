const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Searching for orphaned grade scale groups...');
    
    const groups = await prisma.grade_scale_groups.findMany({
        where: { name: { contains: 'Teaching Assignment 200' } }
    });
    
    console.log(`Found ${groups.length} groups:`, JSON.stringify(groups, null, 2));
    
    for (const group of groups) {
        const scales = await prisma.grade_scales.findMany({
            where: { grade_scale_group_id: group.id }
        });
        console.log(`Group ID ${group.id} has ${scales.length} scales.`);
        
        const scaleIds = scales.map(s => s.id);
        const blockingGrades = await prisma.final_grades.count({
            where: { grade_scale_id: { in: scaleIds } }
        });
        console.log(`Blocking grades for Group ${group.id}: ${blockingGrades}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
