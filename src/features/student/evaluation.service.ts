import { prisma } from '@/lib/prisma';

async function getStudentUserId(student_id: number) {
    if (!student_id) return null;
    const student = await prisma.students.findUnique({
        where: { id: student_id },
        select: { user_id: true },
    });
    return student?.user_id ?? null;
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

async function fixSequences() {
    const tables = ['evaluation_responses', 'evaluation_answers'];
    for (const table of tables) {
        try {
            await prisma.$executeRawUnsafe(`
                SELECT setval('${table}_id_seq', (SELECT COALESCE(MAX(id), 0) FROM "${table}"));
            `);
        } catch (e) {
            console.error(`[EvaluationService] Failed to fix sequence for ${table}`, e);
        }
    }
}

export const EvaluationService = {
    // Get generic questions for a specific form ID
    async getFormQuestions(formId: number) {
        try {
            // Fetch all sections and questions for this form
            const questions: any[] = await prisma.$queryRaw`
                SELECT 
                    eq.id,
                    eq.question_text,
                    eq.question_type_id,
                    eq.order_number,
                    eq.scale_type_id,
                    es.id as section_id,
                    es.section_name,
                    es.order_number as section_order
                FROM evaluation_questions eq
                JOIN evaluation_sections es ON es.id = eq.section_id
                WHERE es.form_id = ${formId}
                ORDER BY es.order_number ASC, eq.order_number ASC
            `;

            // Fetch scale items for these questions
            const scaleIds = [...new Set(questions.map(q => q.scale_type_id).filter(id => id !== null))];
            
            let scaleItems: any[] = [];
            if (scaleIds.length > 0) {
                scaleItems = await prisma.$queryRawUnsafe(`
                    SELECT scale_type_id, label, score_value, order_number 
                    FROM evaluation_scale_items 
                    WHERE scale_type_id IN (${scaleIds.join(',')})
                    ORDER BY scale_type_id, order_number ASC
                `);
            }

            return questions.map(q => {
                const options = scaleItems
                    .filter(si => si.scale_type_id === q.scale_type_id)
                    .map(si => ({
                        label: si.label,
                        value: si.score_value != null ? Number(si.score_value) : -1
                    }));

                return {
                    id: Number(q.id),
                    form_id: formId,
                    type: q.question_type_id === 2 ? 'text' : 'scale',
                    name: q.question_text,
                    section_id: Number(q.section_id),
                    section_name: q.section_name,
                    section_order: Number(q.section_order),
                    order_number: Number(q.order_number),
                    options: options.length > 0 ? options : null
                };
            });
        } catch (e) {
            console.error('[EvaluationService.getFormQuestions] DB error:', e);
            return [];
        }
    },

    // Get question topics from DB evaluation tables (with section grouping)
    async getTopics(year?: number, semester?: number, formType: 'teaching' | 'sdq' = 'teaching') {
        try {
            let formId = 0;
            if (formType === 'sdq') {
                // SDQ is requested to be explicitly fetched from 'SDQ' form
                const sdqForms = await prisma.$queryRaw<any[]>`
                    SELECT id as form_id FROM evaluation_forms WHERE form_name ILIKE '%SDQ%' LIMIT 1
                `;
                if (sdqForms.length > 0) formId = sdqForms[0].form_id;
                else return [];
            } else {
                // Fetch teaching evaluation form flexibly
                let formRows = await prisma.$queryRaw<any[]>`
                    SELECT ef.id as form_id
                    FROM evaluation_forms ef
                    WHERE (ef.form_name ILIKE '%ประเมินครูผู้สอน%' OR ef.form_name ILIKE '%ประเมินการสอน%') 
                    AND ef.is_active = true
                    ORDER BY ef.id ASC
                    LIMIT 1
                `;
                if (formRows.length === 0) {
                    formRows = await prisma.$queryRaw<any[]>`
                        SELECT ef.id as form_id
                        FROM evaluation_forms ef
                        WHERE (ef.form_name ILIKE '%ประเมินครูผู้สอน%' OR ef.form_name ILIKE '%ประเมินการสอน%')
                        ORDER BY ef.id ASC
                        LIMIT 1
                    `;
                }
                if (formRows.length === 0) return [];
                formId = formRows[0].form_id;
            }

            // Fetch all sections and questions for this form
            const questions: any[] = await prisma.$queryRaw`
                SELECT 
                    eq.id,
                    eq.question_text,
                    eq.question_type_id,
                    eq.order_number,
                    eq.scale_type_id,
                    es.id as section_id,
                    es.section_name,
                    es.order_number as section_order
                FROM evaluation_questions eq
                JOIN evaluation_sections es ON es.id = eq.section_id
                WHERE es.form_id = ${formId}
                ORDER BY es.order_number ASC, eq.order_number ASC
            `;

            // Fetch scale items for these questions
            const scaleIds = [...new Set(questions.map(q => q.scale_type_id).filter(id => id !== null))];
            
            let scaleItems: any[] = [];
            if (scaleIds.length > 0) {
                // Raw SQL for evaluation_scale_items
                scaleItems = await prisma.$queryRawUnsafe(`
                    SELECT scale_type_id, label, score_value, order_number 
                    FROM evaluation_scale_items 
                    WHERE scale_type_id IN (${scaleIds.join(',')})
                    ORDER BY scale_type_id, order_number ASC
                `);
            }

            return questions.map(q => {
                const options = scaleItems
                    .filter(si => si.scale_type_id === q.scale_type_id)
                    .map(si => ({
                        label: si.label,
                        value: Number(si.score_value)
                    }));

                return {
                    id: Number(q.id),
                    form_id: formId,
                    type: q.question_type_id === 2 ? 'text' : 'scale',
                    name: q.question_text,
                    section_id: Number(q.section_id),
                    section_name: q.section_name,
                    section_order: Number(q.section_order),
                    order_number: Number(q.order_number),
                    options: options.length > 0 ? options : null
                };
            });
        } catch (e) {
            console.error('[EvaluationService.getTopics] DB error:', e);
            return [];
        }
    },

    // Used by frontend only to check if student has submitted evaluation already
    async getCompetencyResults(student_id: number, year?: number, semester?: number, section_id?: number | null) {
        if (!student_id) return [];
        void section_id;

        const user_id = await getStudentUserId(student_id);
        if (!user_id) return [];

        const semester_id = await resolveSemesterId(year, semester);

        // Raw SQL for evaluation_responses because user_id column is missing
        // Assuming "Competency Results" are evaluations OF the student
        const responsesResult = await prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM evaluation_responses 
             WHERE target_student_id = $1 
             ${semester_id ? `AND semester_id = ${semester_id}` : ''}
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

    // Submit from current frontend payload: [{name, value}] + year/semester/section_id + feedback
    async submitEvaluation(
        student_id: number,
        year: number,
        semester: number,
        section_id: number | null,
        data: { name: string; score?: number; value?: number | string }[],
        feedback?: string,
        formType: 'teaching' | 'sdq' = 'teaching'
    ) {
        if (!student_id || !year || !semester) {
            throw new Error('Missing required evaluation parameters');
        }

        const user_id = await getStudentUserId(student_id);
        if (!user_id) throw new Error('Student not found');

        let formId = 0;
        if (formType === 'sdq') {
            const sdqForms = await prisma.$queryRaw<any[]>`
                SELECT id as form_id FROM evaluation_forms WHERE form_name ILIKE '%SDQ%' LIMIT 1
            `;
            if (sdqForms.length > 0) formId = sdqForms[0].form_id;
            else throw new Error('No SDQ evaluation form found');
        } else {
            const formRows: any[] = await prisma.$queryRaw`
                SELECT ef.id
                FROM evaluation_forms ef
                WHERE (ef.form_name LIKE '%ประเมินครูผู้สอน%' OR ef.form_name LIKE '%ประเมินการสอน%') 
                AND ef.is_active = true
                ORDER BY ef.id ASC
                LIMIT 1
            `;
            const form = formRows.length > 0 ? formRows[0] : null;
            if (!form) throw new Error('No evaluation form found');
            formId = form.id;
        }

        const questionsRaw: any[] = await prisma.$queryRaw`
            SELECT id, question_text, question_type_id FROM evaluation_questions WHERE section_id IN (
                SELECT id FROM evaluation_sections WHERE form_id = ${formId}
            )
        `;

        const questionDetails = new Map<string, { id: number, type: string }>();
        questionsRaw.forEach((q: any) => {
            const key = String(q.question_text || '').trim().toLowerCase();
            if (key) questionDetails.set(key, { id: q.id, type: q.question_type_id === 2 ? 'text' : 'scale' });
        });

        const semester_id = await resolveSemesterId(year, semester);

        // Guard: check if student already submitted (prevent duplicates)
        if (section_id) {
            const existing = await prisma.evaluation_responses.findFirst({
                where: {
                    evaluator_user_id: user_id,
                    target_subject_id: Number(section_id),
                    ...(semester_id ? { semester_id: Number(semester_id) } : {})
                },
                select: { id: true }
            });

            if (existing) {
                throw new Error('นักเรียนได้ประเมินวิชานี้ไปแล้ว');
            }
        } else if (formType === 'sdq') {
            const existingSdq = await prisma.evaluation_responses.findFirst({
                where: {
                    evaluator_user_id: user_id,
                    form_id: formId,
                    ...(semester_id ? { semester_id: Number(semester_id) } : {})
                },
                select: { id: true }
            });

            if (existingSdq) {
                throw new Error('นักเรียนได้ทำแบบประเมิน SDQ ไปแล้วในภาคเรียนนี้');
            }
        }

        // Fix sequences before transaction to prevent P2002 (Unique constraint failed on id)
        await fixSequences();

        return prisma.$transaction(async (tx: any) => {
            const result = await tx.evaluation_responses.create({
                data: {
                    form_id: formId,
                    evaluator_user_id: user_id,
                    semester_id: semester_id ?? null,
                    target_subject_id: section_id ? Number(section_id) : null,
                    submitted_at: new Date()
                },
                select: { id: true }
            });
            const responseId = result.id;

            for (const item of data || []) {
                const topicName = String(item?.name || '').trim();
                const detail = questionDetails.get(topicName.toLowerCase());
                
                const val = item.value !== undefined ? item.value : item.score;
                
                if (detail) {
                    const isText = detail.type === 'text' || detail.type === 'textarea';
                    const scoreVal = (!isText && typeof val === 'number') ? val : null;
                    const textVal = (isText || typeof val === 'string') ? String(val) : null;

                    await tx.$executeRaw`
                        INSERT INTO evaluation_answers (response_id, question_id, text_value, score_value)
                        VALUES (${responseId}, ${detail.id}, ${textVal}, ${scoreVal})
                    `;
                }
            }

            const feedbackText = String(feedback || '').trim();
            if (feedbackText) {
                await tx.$executeRaw`
                    INSERT INTO evaluation_answers (response_id, question_id, text_value, score_value)
                    VALUES (${responseId}, ${null}, ${feedbackText}, ${null})
                `;
            }

            return { message: 'บันทึกสำเร็จ', response_id: responseId };
        });
    },
    // Get IDs of sections already evaluated by the student (in any period) and SDQ status
    async getEvaluatedSections(student_id: number, year: number, semester: number) {
        if (!student_id) return { sections: [], sdqDone: false };

        const user_id = await getStudentUserId(student_id);
        if (!user_id) return { sections: [], sdqDone: false };

        const semester_id = await resolveSemesterId(year, semester);

        const evaluated: any[] = await prisma.$queryRawUnsafe(`
            SELECT target_subject_id FROM evaluation_responses 
            WHERE evaluator_user_id = $1 AND target_subject_id IS NOT NULL
            ${semester_id ? `AND semester_id = ${semester_id}` : ''}
        `, user_id);

        // Check SDQ status
        const sdqForms = await prisma.$queryRaw<any[]>`
            SELECT id as form_id FROM evaluation_forms WHERE form_name ILIKE '%SDQ%' LIMIT 1
        `;
        let sdqDone = false;
        if (sdqForms.length > 0) {
            const sdqExisting = await prisma.evaluation_responses.findFirst({
                where: { 
                    evaluator_user_id: user_id, 
                    form_id: sdqForms[0].form_id, 
                    ...(semester_id ? { semester_id: Number(semester_id) } : {}) 
                }
            });
            sdqDone = !!sdqExisting;
        }

        return { 
            sections: evaluated.map(e => e.target_subject_id), 
            sdqDone 
        };
    },
};

