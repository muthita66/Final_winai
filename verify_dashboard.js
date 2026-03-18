const { DirectorDashboardService } = require('./src/features/director/dashboard.service');
const { prisma } = require('./src/lib/prisma');

async function test() {
    console.time('Full Dashboard Load');
    try {
        const data = await DirectorDashboardService.getFullDashboard();
        console.timeEnd('Full Dashboard Load');
        
        console.log('--- Summary ---');
        console.log('Students:', data.summary.totalStudents);
        console.log('Teachers:', data.summary.totalTeachers);
        
        console.log('--- Gender Dist ---');
        console.log(data.genderDistribution);
        
        console.log('--- Class Dist ---');
        console.log(data.classDistribution);
        
        console.log('--- At Risk ---');
        console.log('Count:', data.atRiskStudents.length);
        if (data.atRiskStudents.length > 0) {
            console.log('Sample:', data.atRiskStudents[0]);
        }
        
    } catch (e) {
        console.error('Test failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

test();
