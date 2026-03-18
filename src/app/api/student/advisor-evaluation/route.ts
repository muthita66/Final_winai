import { z } from "zod";
import { parseIntegerParam, parseStudentIdFromSession } from "@/app/api/student/_utils";
import { StudentAdvisorTeacherEvaluationService } from "@/features/student/advisor-teacher-evaluation.service";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getSession } from "@/lib/auth";

const submitAdvisorTeacherEvaluationSchema = z.object({
    teacher_id: z.number().int().positive(),
    year: z.number().int().positive(),
    semester: z.number().int().positive(),
    data: z.array(z.object({
        name: z.string().trim().min(1),
        score: z.number().int().min(1).max(5),
    })),
    feedback: z.string().optional(),
});

export async function GET(request: Request) {
    try {
        const session = await getSession();
        const sessionResult = parseStudentIdFromSession(session);
        if (!sessionResult.ok) return sessionResult.response;
        const student_id = sessionResult.studentId;

        const { searchParams } = new URL(request.url);
        const action = searchParams.get("action") || "template";

        if (action !== "template") {
            return errorResponse("Invalid action parameter", 400);
        }

        const teacherParsed = parseIntegerParam(searchParams.get("teacher_id"), { required: true, min: 1 });
        if (!teacherParsed.ok) return errorResponse("Invalid parameter: teacher_id", 400, teacherParsed.error);
        const yearParsed = parseIntegerParam(searchParams.get("year"), { required: true, min: 1 });
        if (!yearParsed.ok) return errorResponse("Invalid parameter: year", 400, yearParsed.error);
        const semesterParsed = parseIntegerParam(searchParams.get("semester"), { required: true, min: 1 });
        if (!semesterParsed.ok) return errorResponse("Invalid parameter: semester", 400, semesterParsed.error);

        const data = await StudentAdvisorTeacherEvaluationService.getTemplate(
            student_id,
            teacherParsed.value!,
            yearParsed.value!,
            semesterParsed.value!,
        );
        return successResponse(data, "Advisor teacher evaluation template retrieved");
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return errorResponse("Failed to retrieve advisor evaluation template", 500, message);
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        const sessionResult = parseStudentIdFromSession(session);
        if (!sessionResult.ok) return sessionResult.response;
        const student_id = sessionResult.studentId;

        const body = await request.json();
        const parsed = submitAdvisorTeacherEvaluationSchema.safeParse(body);
        if (!parsed.success) {
            return errorResponse("Invalid payload format", 400, parsed.error.format());
        }

        const { teacher_id, year, semester, data, feedback } = parsed.data;
        const result = await StudentAdvisorTeacherEvaluationService.submit(
            student_id,
            teacher_id,
            year,
            semester,
            data,
            feedback,
        );

        return successResponse(result, "Advisor teacher evaluation submitted successfully");
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return errorResponse("Failed to submit advisor teacher evaluation", 500, message);
    }
}
