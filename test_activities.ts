
import { prisma } from './src/lib/prisma';
import { DirectorService } from './src/features/director/director.service';

async function test() {
    try {
        console.log('Fetching activities...');
        const activities = await DirectorService.getActivities();
        console.log('Activities found:', activities.length);
        console.log(JSON.stringify(activities, null, 2));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

test();
