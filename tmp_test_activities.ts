import { ActivitiesService } from './src/features/student/activities.service';
import { prisma } from './src/lib/prisma';

async function test() {
    try {
        console.log("Testing ActivitiesService...");
        
        // Find a student to test with
        const student = await prisma.students.findFirst({ select: { id: true } });
        if (!student) {
            console.log("No student found to test.");
            return;
        }

        console.log(`Testing with student ID: ${student.id}`);
        // Use a year/semester that might have data, or just the current ones
        const year = 2567;
        const semester = 2;

        const results = await ActivitiesService.getStudentActivityEvaluations(student.id, year, semester);
        console.log("Evaluations count:", results.length);
        if (results.length > 0) {
            console.table(results.slice(0, 5));
        }

    } catch (e) {
        console.error("Test failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

test();
