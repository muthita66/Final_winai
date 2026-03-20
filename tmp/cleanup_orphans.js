const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Cleaning up orphaned groups for Assignment 200...');
    
    // Find groups by name
    const groups = await prisma.grade_scale_groups.findMany({
        where: { name: { contains: 'Teaching Assignment 200' } }
    });
    
    for (const group of groups) {
        console.log(`Processing Group ID ${group.id}...`);
        
        const scales = await prisma.grade_scales.findMany({
            where: { grade_scale_group_id: group.id }
        });
        const scaleIds = scales.map(s => s.id);
        
        // Clear final_grades
        if (scaleIds.length > 0) {
            const cleared = await prisma.final_grades.updateMany({
                where: { grade_scale_id: { in: scaleIds } },
                data: { grade_scale_id: null }
            });
            console.log(`Cleared ${cleared.count} final_grades for Group ${group.id}`);
            
            // Delete scales
            await prisma.grade_scales.deleteMany({
                where: { grade_scale_group_id: group.id }
            });
            console.log(`Deleted ${scales.length} scales for Group ${group.id}`);
        }
        
        // Delete group
        await prisma.grade_scale_groups.delete({
            where: { id: group.id }
        });
        console.log(`Deleted Group ${group.id}`);
    }
    
    console.log('Cleanup complete.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
