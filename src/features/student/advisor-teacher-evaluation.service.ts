import { prisma } from "@/lib/prisma";

const DEFAULT_ADVISOR_EVAL_TOPICS = [
    "ความรับผิดชอบ",
    "วินัยและการตรงต่อเวลา",
    "ความตั้งใจเรียน",
    "การอยู่ร่วมกับผู้อื่น",
    "การปฏิบัติตามกฎระเบียบ",
];

function nextId(maxId?: number | null) {
    return (Number(maxId || 0) || 0) + 1;
}

async function getStudentUserId(student_id: number) {
    if (!student_id) return null;
    const student = await prisma.students.findUnique({
        where: { id: student_id },
        select: { user_id: true },
    });
    return student?.user_id ?? null;
}

async function getTeacherUserId(teacher_id: number) {
    if (!teacher_id) return null;
    const teacher = await prisma.teachers.findUnique({
        where: { id: teacher_id },
        select: { user_id: true },
    });
    return teacher?.user_id ?? null;
}

async function resolveSemesterId(year?: number, semester?: number) {
    if (!year || !semester) return null;
    const result = await prisma.semesters.findFirst({
        where: {
            semester_number: semester,
            academic_years: { year_name: String(year) },
        },
        select: { id: true },
    });
    return result?.id ?? null;
}

async function ensureAdvisorEvaluationForm() {
    // Robust lookup using category engine_type or form name matching
    const existing: any[] = await prisma.$queryRawUnsafe(`
        SELECT ef.* FROM evaluation_forms ef
        LEFT JOIN evaluation_categories ec ON ec.id = ef.category_id
        WHERE ec.engine_type = 'advisor' 
           OR ef.form_name LIKE '%ที่ปรึกษา%'
        ORDER BY ef.id ASC LIMIT 1
    `);
    
    if (existing[0]) {
        const questions: any[] = await prisma.$queryRawUnsafe(`
            SELECT eq.* 
            FROM evaluation_questions eq 
            INNER JOIN evaluation_sections es ON es.id = eq.section_id
            WHERE es.form_id = $1 
            ORDER BY eq.id ASC
        `, existing[0].id);
        return { ...existing[0], evaluation_questions: questions };
    }

    return prisma.$transaction(async (tx: any) => {
        const existingAgain: any[] = await tx.$queryRawUnsafe(`
            SELECT ef.* FROM evaluation_forms ef
            LEFT JOIN evaluation_categories ec ON ec.id = ef.category_id
            WHERE ec.engine_type = 'advisor'
               OR ef.form_name LIKE '%ที่ปรึกษา%'
            ORDER BY ef.id ASC LIMIT 1
        `);
        
        if (existingAgain[0]) {
             const questions: any[] = await tx.$queryRawUnsafe(`
                SELECT eq.* 
                FROM evaluation_questions eq 
                INNER JOIN evaluation_sections es ON es.id = eq.section_id
                WHERE es.form_id = $1 
                ORDER BY eq.id ASC
            `, existingAgain[0].id);
            return { ...existingAgain[0], evaluation_questions: questions };
        }

        const formMax: any[] = await tx.$queryRawUnsafe(`SELECT MAX(id) as max_id FROM evaluation_forms`);
        const questionMax: any[] = await tx.$queryRawUnsafe(`SELECT MAX(id) as max_id FROM evaluation_questions`);

        const formId = nextId(formMax[0].max_id);
        let questionId = nextId(questionMax[0].max_id);

        let type: any[] = await tx.$queryRawUnsafe(`SELECT id FROM evaluation_categories WHERE engine_type = 'advisor' LIMIT 1`);
        
        // If not found by engine_type, try by name
        if (!type[0]) {
            type = await tx.$queryRawUnsafe(`SELECT id FROM evaluation_categories WHERE name LIKE '%ที่ปรึกษา%' LIMIT 1`);
        }
        
        // If still not found, create a placeholder category
        let categoryId;
        if (!type[0]) {
             const catMax: any[] = await tx.$queryRawUnsafe(`SELECT MAX(id) as max_id FROM evaluation_categories`);
             categoryId = nextId(catMax[0].max_id);
             await tx.$executeRawUnsafe(`
                INSERT INTO evaluation_categories (id, name, engine_type)
                VALUES ($1, 'การประเมินครูที่ปรึกษา', 'advisor')
             `, categoryId);
        } else {
            categoryId = type[0].id;
        }

        await tx.$executeRawUnsafe(`
            INSERT INTO evaluation_forms (id, form_name, category_id, is_active)
            VALUES ($1, 'แบบประเมินครูที่ปรึกษา', $2, true)
        `, formId, categoryId);

        // Since questions require sections, we need to create a section first if missing
        let sectionMax: any[] = await tx.$queryRawUnsafe(`SELECT MAX(id) as max_id FROM evaluation_sections`);
        const sectionId = nextId(sectionMax[0].max_id);
        await tx.$executeRawUnsafe(`
            INSERT INTO evaluation_sections (id, form_id, section_name, order_number)
            VALUES ($1, $2, 'ตอนที่ 1', 1)
        `, sectionId, formId);

        const questions: any[] = [];
        for (const question_text of DEFAULT_ADVISOR_EVAL_TOPICS) {
            const qId = questionId++;
            await tx.$executeRawUnsafe(`
                INSERT INTO evaluation_questions (id, section_id, question_text, question_type, order_number)
                VALUES ($1, $2, $3, 'rating', $4)
            `, qId, sectionId, question_text, questions.length + 1);
            questions.push({ id: qId, question_text, question_type: 'rating' });
        }

        return { id: formId, form_name: 'ผลประเมินโดยรวม (ครูที่ปรึกษา)', category_id: categoryId, evaluation_questions: questions };
    });
}

async function ensureStudentCanEvaluateAdvisor(student_id: number, teacher_id: number) {
    if (!student_id || !teacher_id) return false;
    const latestAssignment: any[] = await prisma.$queryRawUnsafe(`
        SELECT classroom_id FROM classroom_students 
        WHERE student_id = $1 
        ORDER BY academic_year DESC LIMIT 1
    `, student_id);
    
    if (!latestAssignment[0]) return false;

    const advisor: any[] = await prisma.$queryRawUnsafe(`
        SELECT id FROM classroom_advisors 
        WHERE classroom_id = $1 AND teacher_id = $2
        LIMIT 1
    `, latestAssignment[0].classroom_id, teacher_id);

    return advisor.length > 0;
}

async function findLatestAdvisorTeacherResponse(
    formId: number,
    evaluatorUserId: number,
    teacherIds: number[],
    periodId?: number | null
) {
    if (!formId || !evaluatorUserId || !teacherIds.length) return null;

    const targetIdList = teacherIds.filter((id) => Number.isFinite(id) && id > 0);
    if (!targetIdList.length) return null;

    const rows = await prisma.$queryRawUnsafe<Array<{ id: number; submitted_at: Date | null }>>(
        `
        SELECT er.id, er.submitted_at
        FROM public.evaluation_responses er
        WHERE er.form_id = ${Number(formId)}
          AND er.evaluator_user_id = ${Number(evaluatorUserId)}
          AND er.student_id IN (${targetIdList.join(",")})
          ${periodId ? `AND er.period_id = ${Number(periodId)}` : ""}
        ORDER BY er.submitted_at DESC NULLS LAST, er.id DESC
        LIMIT 1
        `
    );

    return rows?.[0] ?? null;
}

export const StudentAdvisorTeacherEvaluationService = {
    async getTemplate(student_id: number, teacher_id: number, year: number, semester: number) {
        const canEvaluate = await ensureStudentCanEvaluateAdvisor(student_id, teacher_id);
        if (!canEvaluate) {
            throw new Error(`ไม่สามารถประเมินได้: นักเรียนและครูที่เลือกไม่ได้อยู่ในห้องเดียวกัน หรือไม่พบข้อมูลครูที่ปรึกษา (Advisor not found for teacher_id: ${teacher_id})`);
        }

        const [studentUserId, teacherUserId, form, semester_id] = await Promise.all([
            getStudentUserId(student_id),
            getTeacherUserId(teacher_id),
            ensureAdvisorEvaluationForm(),
            resolveSemesterId(year, semester),
        ]);

        if (!studentUserId) throw new Error("ไม่พบบัญชีนักเรียน");

        const topics = ((form as any)?.evaluation_questions?.length
            ? (form as any).evaluation_questions.map((q: any) => ({ id: q.id, name: q.question_text || "" }))
            : DEFAULT_ADVISOR_EVAL_TOPICS.map((name, index) => ({ id: index + 1, name })))
            .filter((t: any) => t.name);

        const latest = await findLatestAdvisorTeacherResponse(
            Number(form.id),
            Number(studentUserId),
            [teacher_id, Number(teacherUserId || 0)],
            semester_id ?? null
        );

        const answers: any[] = latest
            ? await prisma.$queryRawUnsafe(`
                SELECT ea.*, eq.question_text
                FROM evaluation_answers ea
                LEFT JOIN evaluation_questions eq ON eq.id = ea.question_id
                WHERE ea.response_id = $1
                ORDER BY ea.id ASC
            `, Number(latest.id))
            : [];

        const current = answers
            .map((a) => ({
                name: a.evaluation_questions?.question_text || a.answer_text || "",
                score: a.score != null ? Number(a.score) : null,
            }))
            .filter((a) => a.name && a.score != null);

        const feedback =
            answers.find((a) => a.score == null && String(a.answer_text || "").trim())?.answer_text || "";

        return {
            teacher_id,
            period_id: semester_id ?? null,
            topics,
            current,
            feedback,
            submitted_at: latest?.submitted_at || null,
        };
    },

    async submit(
        student_id: number,
        teacher_id: number,
        year: number,
        semester: number,
        data: { name: string; score: number }[],
        feedback?: string
    ) {
        const canEvaluate = await ensureStudentCanEvaluateAdvisor(student_id, teacher_id);
        if (!canEvaluate) throw new Error("ไม่พบครูที่ปรึกษา");

        const [studentUserId, form, semester_id] = await Promise.all([
            getStudentUserId(student_id),
            ensureAdvisorEvaluationForm(),
            resolveSemesterId(year, semester),
        ]);
        if (!studentUserId) throw new Error("ไม่พบบัญชีนักเรียน");

        const questionByText = new Map<string, number>();
        ((form as any).evaluation_questions || []).forEach((q: any) => {
            const key = String(q.question_text || "").trim().toLowerCase();
            if (key && !questionByText.has(key)) questionByText.set(key, Number(q.id));
        });

        return prisma.$transaction(async (tx: any) => {
            const responseMax: any[] = await tx.$queryRawUnsafe(`SELECT MAX(id) as max_id FROM evaluation_responses`);
            const answerMax: any[] = await tx.$queryRawUnsafe(`SELECT MAX(id) as max_id FROM evaluation_answers`);

            const responseId = nextId(responseMax[0].max_id);
            let answerId = nextId(answerMax[0].max_id);

            await tx.$executeRawUnsafe(
                `INSERT INTO evaluation_responses (id, form_id, evaluator_user_id, submitted_at, semester_id, student_id)
                 VALUES ($1, $2, $3, NOW(), $4, $5)`,
                responseId, Number(form.id), Number(studentUserId), semester_id ? Number(semester_id) : null, Number(teacher_id)
            );

            for (const item of data || []) {
                const topicName = String(item?.name || "").trim();
                const score = Number(item?.score);
                if (!topicName) continue;

                const questionId = questionByText.get(topicName.toLowerCase()) ?? null;

                await tx.$executeRawUnsafe(`
                    INSERT INTO evaluation_answers (id, response_id, question_id, answer_text, score)
                    VALUES ($1, $2, $3, $4, $5)
                `, answerId++, responseId, questionId, questionId ? null : topicName, Number.isFinite(score) ? score : null);
            }

            const feedbackText = String(feedback || "").trim();
            if (feedbackText) {
                await tx.$executeRawUnsafe(`
                    INSERT INTO evaluation_answers (id, response_id, question_id, answer_text, score)
                    VALUES ($1, $2, null, $3, null)
                `, answerId++, responseId, feedbackText);
            }

            return { response_id: responseId };
        });
    },
};
