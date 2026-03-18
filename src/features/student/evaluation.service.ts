import { prisma } from '@/lib/prisma';

async function getStudentUserId(student_id: number) {
    if (!student_id) return null;
    const student = await prisma.students.findUnique({
        where: { id: student_id },
        select: { user_id: true },
    });
    return student?.user_id ?? null;
}

async function resolveEvaluationPeriodId(year?: number, semester?: number) {
    if (!year || !semester) return null;

    const period: any[] = await prisma.$queryRawUnsafe(`
        SELECT ep.id 
        FROM evaluation_periods ep
        INNER JOIN semesters s ON s.id = ep.semester_id
        INNER JOIN academic_years ay ON ay.id = s.academic_year_id
        WHERE s.semester_number = $1 AND ay.year_name = $2
        ORDER BY ep.id DESC LIMIT 1
    `, semester, String(year));

    return period[0]?.id ?? null;
}

export const EvaluationService = {
    // Get question topics (flattened) for current UI
    async getTopics(year?: number, semester?: number) {
        void year;
        void semester;

        const forms: any[] = await prisma.$queryRawUnsafe(`
            SELECT ef.*, eft.type_code
            FROM evaluation_forms ef
            LEFT JOIN evaluation_form_types eft ON eft.id = ef.type_id
            ORDER BY ef.id ASC
        `);

        const formIds = forms.map(f => f.id);
        const questionsRaw: any[] = await prisma.$queryRawUnsafe(`
            SELECT * FROM evaluation_questions 
            WHERE form_id IN (${formIds.join(',')})
            ORDER BY id ASC
        `);

        const questions = forms.flatMap((f: any) =>
            questionsRaw.filter(q => q.form_id === f.id).map((q: any) => ({
                id: q.id,
                form_id: f.id,
                type: q.question_type || 'scale',
                name: (q.question_text || '').trim(),
            }))
        );

        if (questions.length > 0) {
            const seen = new Set<string>();
            return questions.filter((q) => {
                if (!q.name) return false; // ignore empty questions
                const key = q.name.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        }

        return forms.map((f) => ({
            id: f.id,
            form_id: f.id,
            type: 'scale',
            name: f.name,
        }));
    },

    // Used by frontend only to check if student has submitted evaluation already
    async getCompetencyResults(student_id: number, year?: number, semester?: number, section_id?: number | null) {
        if (!student_id) return [];
        void section_id;

        const user_id = await getStudentUserId(student_id);
        if (!user_id) return [];

        const period_id = await resolveEvaluationPeriodId(year, semester);

        // Raw SQL for evaluation_responses because user_id column is missing
        // Assuming "Competency Results" are evaluations OF the student
        const responsesResult = await prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM evaluation_responses 
             WHERE student_id = $1 
             ${period_id ? `AND period_id = ${period_id}` : ''}
             ORDER BY submitted_at DESC`,
            student_id
        );

        if (responsesResult.length === 0) return [];

        const responseIds = responsesResult.map(r => r.id);
        const [formsRow, answersRaw] = await Promise.all([
            prisma.$queryRawUnsafe<any[]>(`SELECT * FROM evaluation_forms`),
            prisma.$queryRawUnsafe<any[]>(`
                SELECT ea.*, eq.question_text
                FROM evaluation_answers ea
                LEFT JOIN evaluation_questions eq ON eq.id = ea.question_id
                WHERE ea.response_id IN (${responseIds.join(',')})
            `)
        ]);
 
        return responsesResult.map((r) => {
            const form = formsRow.find(f => f.id === r.form_id);
            const rAnswers = answersRaw.filter(a => a.response_id === r.id);
            return {
                id: r.id,
                form_id: r.form_id,
                form_name: form?.name || '',
                submitted_at: r.submitted_at,
                answers: rAnswers.map((a) => ({
                    question: a.question_text || a.answer_text || '',
                    answer: a.answer_text || '',
                    score: a.score != null ? Number(a.score) : null,
                })),
            };
        });
    },

    // Submit from current frontend payload: [{name, score}] + year/semester/section_id + feedback
    async submitEvaluation(
        student_id: number,
        year: number,
        semester: number,
        section_id: number | null,
        data: { name: string; score: number }[],
        feedback?: string
    ) {
        if (!student_id || !year || !semester) {
            throw new Error('Missing required evaluation parameters');
        }
        void section_id;

        const user_id = await getStudentUserId(student_id);
        if (!user_id) throw new Error('Student not found');

        const forms: any[] = await prisma.$queryRawUnsafe(`
            SELECT ef.*, eft.type_code
            FROM evaluation_forms ef
            LEFT JOIN evaluation_form_types eft ON eft.id = ef.type_id
            ORDER BY ef.id ASC
        `);
        if (forms.length === 0) throw new Error('No evaluation form configured');

        const form =
            forms.find((f: any) => String(f.type_code || '').toLowerCase() !== 'advisor') ||
            forms[0];

        const questionsRaw: any[] = await prisma.$queryRawUnsafe(`
            SELECT id, question_text FROM evaluation_questions WHERE form_id = $1
        `, form.id);

        const questionByText = new Map<string, number>();
        questionsRaw.forEach((q: any) => {
            const key = String(q.question_text || '').trim().toLowerCase();
            if (key && !questionByText.has(key)) questionByText.set(key, q.id);
        });

        const period_id = await resolveEvaluationPeriodId(year, semester);

        // Guard: check if student already submitted for this section (prevent duplicates)
        if (section_id) {
            const existing: any[] = await prisma.$queryRawUnsafe(`
                SELECT id FROM evaluation_responses 
                WHERE evaluator_user_id = $1 AND teaching_assignment_id = $2
                ${period_id ? `AND period_id = ${period_id}` : ''}
                LIMIT 1
            `, user_id, Number(section_id));

            if (existing.length > 0) {
                throw new Error('นักเรียนได้ประเมินวิชานี้ไปแล้ว');
            }
        }

        return prisma.$transaction(async (tx: any) => {
            // Raw SQL insert because user_id (the submitter) should be evaluator_user_id 
            // and the user_id column is missing
            const result = await tx.$queryRawUnsafe(
                `INSERT INTO evaluation_responses (form_id, evaluator_user_id, period_id, teaching_assignment_id, submitted_at) 
                 VALUES ($1, $2, $3, $4, NOW()) 
                 RETURNING id`,
                form.id, user_id, period_id ?? undefined, section_id ? Number(section_id) : null
            );
            const responseId = (result as any[])[0].id;

            for (const item of data || []) {
                const topicName = String(item?.name || '').trim();
                const score = Number(item?.score);
                const question_id = questionByText.get(topicName.toLowerCase()) ?? null;

                await tx.$executeRawUnsafe(`
                    INSERT INTO evaluation_answers (response_id, question_id, answer_text, score)
                    VALUES ($1, $2, $3, $4)
                `, responseId, question_id, question_id ? null : (topicName || null), Number.isFinite(score) ? score : null);
            }

            const feedbackText = String(feedback || '').trim();
            if (feedbackText) {
                await tx.$executeRawUnsafe(`
                    INSERT INTO evaluation_answers (response_id, question_id, answer_text, score)
                    VALUES ($1, null, $2, null)
                `, responseId, feedbackText);
            }

            return { message: 'บันทึกสำเร็จ', response_id: responseId };
        });
    },
    // Get IDs of sections already evaluated by the student (in any period)
    async getEvaluatedSections(student_id: number, year: number, semester: number) {
        if (!student_id) return [];

        const user_id = await getStudentUserId(student_id);
        if (!user_id) return [];

        // Try to narrow by period_id if it exists, otherwise return all targets for this user
        const period_id = await resolveEvaluationPeriodId(year, semester);

        const whereClause: any = {
            evaluator_user_id: user_id,
            teaching_assignment_id: { not: null }
        };
        if (period_id) {
            whereClause.period_id = period_id;
        }

        const evaluated: any[] = await prisma.$queryRawUnsafe(`
            SELECT teaching_assignment_id FROM evaluation_responses 
            WHERE evaluator_user_id = $1 AND teaching_assignment_id IS NOT NULL
            ${period_id ? `AND period_id = ${period_id}` : ''}
        `, user_id);

        return evaluated.map(e => e.teaching_assignment_id);
    },
};

