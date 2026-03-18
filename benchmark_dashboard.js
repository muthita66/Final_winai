const { DirectorDashboardService } = require('./src/features/director/dashboard.service');
const { prisma } = require('./src/lib/prisma');

async function benchmark() {
    console.time('Full Dashboard Load');
    try {
        const data = await DirectorDashboardService.getFullDashboard();
        console.timeEnd('Full Dashboard Load');
        console.log('Dashboard Data Received');
    } catch (e) {
        console.error('Error during benchmark:', e);
    } finally {
        await prisma.$disconnect();
    }
}

benchmark();
