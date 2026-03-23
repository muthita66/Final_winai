import { DirectorService } from '@/features/director/director.service';
import { successResponse, errorResponse } from '@/lib/api-response';
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const y = searchParams.get('year');
        const s = searchParams.get('semester');
        const type = searchParams.get('type') || 'student_teaching';
        const subjectId = searchParams.get('subject_id');
        const departmentId = searchParams.get('department_id');
        const classLevel = searchParams.get('class_level');
        const room = searchParams.get('room');

        if (searchParams.has('type')) {
            const filters = {
                subject_id: subjectId ? Number(subjectId) : undefined,
                department_id: departmentId ? Number(departmentId) : undefined,
                class_level: classLevel || undefined,
                room: room || undefined,
            };
            return successResponse(await DirectorService.getDetailedEvaluationResults(
                y ? Number(y) : undefined, 
                s ? Number(s) : undefined,
                type as any,
                filters
            ));
        }

        return successResponse(await DirectorService.getEvaluationSummary(
            y ? Number(y) : undefined, 
            s ? Number(s) : undefined
        ));
    } catch (e: any) { 
        console.error('Evaluation API Error:', e);
        return errorResponse('Failed', 500, e.message); 
    }
}
