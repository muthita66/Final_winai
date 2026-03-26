import { EvaluationService } from '@/features/student/evaluation.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { z } from 'zod';
import { parseIntegerParam, parseStudentIdFromSession } from '@/app/api/student/_utils';

const submitEvaluationSchema = z.object({
    data: z.array(z.object({
        name: z.string().trim().min(1),
        score: z.number().int().min(0).max(10).optional(),
        value: z.union([z.number(), z.string(), z.null()]).optional(),
    })),
    year: z.number().int().positive(),
    semester: z.number().int().positive(),
    section_id: z.union([z.number(), z.string(), z.null()]).optional(),
    feedback: z.string().optional(),
    type: z.enum(['teaching', 'sdq']).optional(),
});

export async function GET(request: Request) {
    console.log(`[GET /api/student/evaluation] Request hit: ${request.url}`);
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');
        console.log(`[GET /api/student/evaluation] action: ${action}`);

        if (action === 'topics') {
            const yearStr = searchParams.get('year');
            const semesterStr = searchParams.get('semester');

            const yearParsed = parseIntegerParam(yearStr);
            if (!yearParsed.ok) return errorResponse("Invalid parameter: year", 400, yearParsed.error);
            const semesterParsed = parseIntegerParam(semesterStr);
            if (!semesterParsed.ok) return errorResponse("Invalid parameter: semester", 400, semesterParsed.error);
            const year = yearParsed.value;
            const semester = semesterParsed.value;

            const type = searchParams.get('type') || 'teaching';
            if (type !== 'teaching' && type !== 'sdq') {
                return errorResponse("Invalid parameter: type. Must be 'teaching' or 'sdq'", 400);
            }

            const topics = await EvaluationService.getTopics(year, semester, type as 'teaching' | 'sdq');
            return successResponse(topics, `Topics retrieved for ${type}`);
        }

        if (action === 'competency') {
            const session = await getSession();
            const sessionResult = parseStudentIdFromSession(session);
            if (!sessionResult.ok) return sessionResult.response;
            const student_id = sessionResult.studentId;

            const yearParsed = parseIntegerParam(searchParams.get('year'), { required: true, min: 1 });
            if (!yearParsed.ok) return errorResponse("Invalid parameter: year", 400, yearParsed.error);
            const semesterParsed = parseIntegerParam(searchParams.get('semester'), { required: true, min: 1 });
            if (!semesterParsed.ok) return errorResponse("Invalid parameter: semester", 400, semesterParsed.error);
            const section_idStr = searchParams.get('section_id');
            const sectionIdParsed = parseIntegerParam(section_idStr);
            if (!sectionIdParsed.ok) return errorResponse("Invalid parameter: section_id", 400, sectionIdParsed.error);
            const year = yearParsed.value!;
            const semester = semesterParsed.value!;
            const section_id = sectionIdParsed.value;

            const results = await EvaluationService.getCompetencyResults(student_id, year, semester, section_id);
            return successResponse(results, "Competency results retrieved");
        }

        if (action === 'evaluated_sections') {
            const session = await getSession();
            const sessionResult = parseStudentIdFromSession(session);
            if (!sessionResult.ok) return sessionResult.response;
            const student_id = sessionResult.studentId;

            const yearParsed = parseIntegerParam(searchParams.get('year'), { required: true, min: 1 });
            if (!yearParsed.ok) return errorResponse("Invalid parameter: year", 400, yearParsed.error);
            const semesterParsed = parseIntegerParam(searchParams.get('semester'), { required: true, min: 1 });
            if (!semesterParsed.ok) return errorResponse("Invalid parameter: semester", 400, semesterParsed.error);

            const year = yearParsed.value!;
            const semester = semesterParsed.value!;

            const sectionIds = await EvaluationService.getEvaluatedSections(student_id, year, semester);
            return successResponse(sectionIds, "Evaluated sections retrieved");
        }

        return errorResponse("Invalid action parameter", 400);


    } catch (error: any) {
        return errorResponse("Failed to retrieve evaluation data", 500, error.message);
    }
}

export async function POST(request: Request) {
    console.log(`[POST /api/student/evaluation] Request hit`);
    try {
        const session = await getSession();
        const sessionResult = parseStudentIdFromSession(session);
        if (!sessionResult.ok) {
            console.log(`[POST /api/student/evaluation] session failed:`, sessionResult.response);
            return sessionResult.response;
        }
        const student_id = sessionResult.studentId;

        const body = await request.json();
        console.log(`[POST /api/student/evaluation] body:`, JSON.stringify(body).substring(0, 100));

        const parsed = submitEvaluationSchema.safeParse(body);
        if (!parsed.success) {
            return errorResponse("Invalid payload format", 400, parsed.error.format());
        }

        const { data, year, semester, section_id, feedback, type } = parsed.data;
        const sectionIdParsed = parseIntegerParam(section_id == null ? null : String(section_id));
        if (!sectionIdParsed.ok) {
            return errorResponse("Invalid payload: section_id", 400, sectionIdParsed.error);
        }

        const result = await EvaluationService.submitEvaluation(
            student_id,
            year,
            semester,
            sectionIdParsed.value ?? null,
            data as any, // Cast to any or fix original type to handle optional value
            feedback,
            type || 'teaching'
        );

        return successResponse(result, "Evaluation submitted successfully");
    } catch (error: any) {
        console.error('[POST /api/student/evaluation] Error:', error);
        return errorResponse(error.message || "Failed to submit evaluation", 500, error.message);
    }
}
