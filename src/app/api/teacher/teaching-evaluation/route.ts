import { TeacherEvaluationService } from '@/features/teacher/evaluation.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: Request) {
    const fs = require('fs');
    fs.writeFileSync('d:\\new\\WinAi_SeeuNextLift\\api_eval_debug.txt', `GET triggered at ${new Date().toISOString()}\n`);
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');
        const teacher_id = Number(searchParams.get('teacher_id'));
        const yearParam = searchParams.get('year');
        const semesterParam = searchParams.get('semester');
        const year = yearParam ? Number(yearParam) : undefined;
        const semester = semesterParam ? Number(semesterParam) : undefined;

        fs.appendFileSync('d:\\new\\WinAi_SeeuNextLift\\api_eval_debug.txt', `action: ${action}, teacher_id: ${teacher_id}\n`);

        if (!teacher_id || Number.isNaN(teacher_id)) return errorResponse('teacher_id required', 400);

        if (action === 'results') {
            const section_id = searchParams.get('section_id') ? Number(searchParams.get('section_id')) : undefined;
            const data = await TeacherEvaluationService.getTeachingEvaluationResults(teacher_id, section_id, year, semester);
            return successResponse(data);
        }

        if (action === 'students') {
            const section_id = Number(searchParams.get('section_id'));
            if (!section_id) return errorResponse('section_id required', 400);
            const data = await TeacherEvaluationService.getSectionStudentsForEvaluation(teacher_id, section_id, year || 0, semester || 0);
            return successResponse(data);
        }

        if (action === 'student-results') {
            const section_id = Number(searchParams.get('section_id'));
            if (!section_id) return errorResponse('section_id required', 400);
            const data = await TeacherEvaluationService.getTeachingStudentEvaluationResults(teacher_id, section_id, year || 0, semester || 0);
            return successResponse(data);
        }

        if (action === 'template') {
            const student_id = Number(searchParams.get('student_id'));
            const section_id = Number(searchParams.get('section_id'));
            fs.appendFileSync('d:\\new\\WinAi_SeeuNextLift\\api_eval_debug.txt', `template action: student_id=${student_id}, section_id=${section_id}\n`);
            if (!student_id || !section_id) return errorResponse('IDs required', 400);

            // Debug lookup for forms 9-17 to fix user choice bug
            const { prisma } = require('@/lib/prisma');
            const forms = await prisma.$queryRawUnsafe(`SELECT * FROM evaluation_forms WHERE id BETWEEN 9 AND 17`);
            const sectionInfo = await prisma.teaching_assignments.findUnique({ where: { id: section_id }, include: { subjects: true } });
            fs.appendFileSync('d:\\new\\WinAi_SeeuNextLift\\api_eval_debug.txt', `FORMS 9-17: ${JSON.stringify(forms, null, 2)}\nSECTION INFO: ${JSON.stringify(sectionInfo, null, 2)}\n`);

            const data = await TeacherEvaluationService.getSubjectEvaluationTemplate(teacher_id, student_id, section_id, year || 0, semester || 0);
            return successResponse(data);
        }

        const data = await TeacherEvaluationService.getTeachingEvaluation(teacher_id, year, semester);
        return successResponse(data);
    } catch (error: any) {
        console.error("[API Teaching Evaluation GET] Error:", error);
        fs.appendFileSync('d:\\new\\WinAi_SeeuNextLift\\api_eval_debug.txt', `ERROR: ${error.message}\n${error.stack}\n`);
        return errorResponse(error.message || 'Failed', 500, {
            stack: error.stack,
            cause: error.cause,
            ...error
        });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const data = await TeacherEvaluationService.submitSubjectEvaluation(body);
        return successResponse(data);
    } catch (error: any) {
        require('fs').appendFileSync('d:\\new\\WinAi_SeeuNextLift\\submit_eval_error.txt', `ERROR: ${error.message}\n${error.stack}\n`);
        console.error("[API Teaching Evaluation POST] Error:", error);
        return errorResponse(error.message || 'Failed to submit evaluation', 500);
    }
}
