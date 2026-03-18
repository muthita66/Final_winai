import { LearningResultsService } from '@/features/student/learning-results.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { parseIntegerParam, parseStudentIdFromSession } from '@/app/api/student/_utils';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        const sessionResult = parseStudentIdFromSession(session);
        if (!sessionResult.ok) return sessionResult.response;
        const student_id = sessionResult.studentId;

        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        if (action === 'advisor_evaluation') {
            const yearParsed = parseIntegerParam(searchParams.get('year'), { required: true, min: 1 });
            if (!yearParsed.ok) return errorResponse("Invalid parameter: year", 400, yearParsed.error);
            const semesterParsed = parseIntegerParam(searchParams.get('semester'), { required: true, min: 1 });
            if (!semesterParsed.ok) return errorResponse("Invalid parameter: semester", 400, semesterParsed.error);
            const year = yearParsed.value!;
            const semester = semesterParsed.value!;

            const results = await LearningResultsService.getAdvisorEvaluation(student_id, year, semester);
            return successResponse(results, "Advisor evaluation retrieved");
        }

        if (action === 'subject_evaluation') {
            const sectionIdParsed = parseIntegerParam(searchParams.get('section_id'), { required: true, min: 1 });
            if (!sectionIdParsed.ok) return errorResponse("Invalid parameter: section_id", 400, sectionIdParsed.error);
            const yearParsed = parseIntegerParam(searchParams.get('year'), { required: true, min: 1 });
            if (!yearParsed.ok) return errorResponse("Invalid parameter: year", 400, yearParsed.error);
            const semesterParsed = parseIntegerParam(searchParams.get('semester'), { required: true, min: 1 });
            if (!semesterParsed.ok) return errorResponse("Invalid parameter: semester", 400, semesterParsed.error);
            const subject_idStr = searchParams.get('subject_id');
            const subjectIdParsed = parseIntegerParam(subject_idStr);
            if (!subjectIdParsed.ok) return errorResponse("Invalid parameter: subject_id", 400, subjectIdParsed.error);
            const section_id = sectionIdParsed.value!;
            const year = yearParsed.value!;
            const semester = semesterParsed.value!;
            const subject_id = subjectIdParsed.value;
            const results = await LearningResultsService.getSubjectEvaluation(student_id, section_id, year, semester, subject_id);
            return successResponse(results, "Subject evaluation retrieved");
        }

        return errorResponse("Invalid action parameter", 400);
    } catch (error: any) {
        return errorResponse("Failed to retrieve learning results data", 500, error.message);
    }
}
