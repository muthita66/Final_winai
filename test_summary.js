const { TeacherGradeCutService } = require('./src/features/teacher/grade-cut.service');
const { prisma } = require('./src/lib/prisma');

async function test() {
    try {
        const sectionId = 200;
        console.log(`Testing getGradeSummary for section ${sectionId}...`);
        const summary = await TeacherGradeCutService.getGradeSummary(sectionId);
        
        if (summary && summary.length > 0) {
            const s1 = summary.find(s => s.student_code === '6801004' || s.student_id === 6801004); // Using code from subagent
            console.log('Student 1 Summary:', JSON.stringify(s1, null, 2));
        } else {
            console.log('No summary found');
        }
    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

test();
