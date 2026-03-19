import { prisma } from '@/lib/prisma';
import { TeacherStudentsService } from '@/features/teacher/students.service';

async function resolveEvaluationPeriodId(year?: number, semester?: number) {
    if (!year || !semester) return null;
    try {
        const period: any[] = await prisma.$queryRawUnsafe(`
            SELECT ep.id FROM evaluation_periods ep
            JOIN semesters s ON ep.semester_id = s.id
            JOIN academic_years ay ON s.academic_year_id = ay.id
            WHERE s.semester_number = $1 AND ay.year_name = $2
            ORDER BY ep.id DESC LIMIT 1
        `, semester, String(year));
        return period[0]?.id ?? null;
    } catch (_) { return null; }
}

function toNum(value: unknown, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function formatRoomLabel(classLevel?: string | null, room?: string | null) {
    const level = String(classLevel || '').trim();
    const roomValue = String(room || '').trim();
    if (!level && !roomValue) return '-';
    if (!roomValue) return level || '-';
    if (!level) return roomValue;
    if (roomValue === level || roomValue.startsWith(`${level}/`)) return roomValue;
    return `${level}/${roomValue}`;
}

export const TeacherEvaluationService = {
    async getTeachingEvaluation(teacher_id: number, year?: number, semester?: number) {
        try {
            const assignments = await prisma.teaching_assignments.findMany({
                where: {
                    teacher_id,
                    ...(year || semester ? {
                        semesters: {
                            ...(year ? { academic_years: { year_name: String(year) } } : {}),
                            ...(semester ? { semester_number: semester } : {}),
                        }
                    } : {})
                },
                include: {
                    subjects: true,
                    classrooms: { include: { levels: true } },
                    semesters: { include: { academic_years: true } },
                }
            });

            // Pre-fetch the teaching evaluation form ID via Raw SQL
            const formResult: any[] = await prisma.$queryRawUnsafe(`
                SELECT f.id FROM evaluation_forms f
                JOIN evaluation_categories t ON f.category_id = t.id
                WHERE t.engine_type = 'teaching'
                LIMIT 1
            `);
            const teachingFormId = formResult[0]?.id || null;

            const results: any[] = [];
            for (const ta of assignments) {
                const countResult = await prisma.$queryRawUnsafe<any[]>(
                    `SELECT COUNT(*)::int as count FROM evaluation_responses 
                     WHERE teaching_assignment_id = $1 
                     ${teachingFormId ? `AND form_id = ${teachingFormId}` : ''}`,
                    ta.id
                );
                const count = countResult[0]?.count || 0;

                results.push({
                    teaching_assignment_id: ta.id,
                    subject_code: ta.subjects?.subject_code || '',
                    subject_name: ta.subjects?.subject_name || '',
                    class_level: ta.classrooms?.levels?.name || '',
                    room: ta.classrooms?.room_name || '',
                    year: ta.semesters?.academic_years?.year_name || '',
                    semester: ta.semesters?.semester_number || 0,
                    evaluations_count: count,
                });
            }
            return results;
        } catch (error: any) {
            console.error("[TeacherEvaluationService] Error in getTeachingEvaluation:", error);
            throw error;
        }
    },

    async getTeachingEvaluationResults(teacher_id: number, section_id?: number, year?: number, semester?: number) {
        // Use Raw SQL for evaluation_responses to avoid missing user_id column
        let sql = `SELECT * FROM evaluation_responses WHERE teaching_assignment_id IS NOT NULL `;
        const params: any[] = [];

        if (section_id) {
            sql += ` AND teaching_assignment_id = $1 `;
            params.push(section_id);
        } else {
            const assignments = await prisma.teaching_assignments.findMany({
                where: {
                    teacher_id,
                    ...(year || semester ? {
                        semesters: {
                            ...(year ? { academic_years: { year_name: String(year) } } : {}),
                            ...(semester ? { semester_number: semester } : {}),
                        }
                    } : {})
                },
                select: { id: true }
            });
            const ids = assignments.map(a => a.id);
            if (ids.length > 0) {
                sql += ` AND teaching_assignment_id IN (${ids.join(',')}) `;
            } else {
                return { summary: [], comments: [] };
            }
        }

        // Fetch teaching form ID via Raw SQL
        const formResult: any[] = await prisma.$queryRawUnsafe(`
            SELECT f.id FROM evaluation_forms f
            JOIN evaluation_categories t ON f.category_id = t.id
            WHERE t.engine_type = 'teaching'
            LIMIT 1
        `);
        const teachingFormId = formResult[0]?.id || null;
        if (teachingFormId) {
            sql += ` AND form_id = ${teachingFormId} `;
        }

        sql += ` ORDER BY submitted_at DESC `;

        const responses: any[] = await prisma.$queryRawUnsafe(sql, ...params);

        // Fetch answers for these responses
        const responseIds = responses.map(r => r.id);
        if (responseIds.length === 0) return { summary: [], comments: [] };

        // Raw SQL for evaluation_answers
        const allAnswers: any[] = await prisma.$queryRawUnsafe(`
            SELECT a.*, q.question_text
            FROM evaluation_answers a
            LEFT JOIN evaluation_questions q ON a.question_id = q.id
            WHERE a.response_id IN (${responseIds.join(',')})
        `);

        const topicScores = new Map<string, { total: number; count: number }>();
        const comments: any[] = [];

        for (const r of responses) {
            const rAnswers = allAnswers.filter(a => a.response_id === r.id);
            for (const a of rAnswers) {
                if (a.score != null) {
                    const topic = a.question_text || a.answer_text || 'อื่นๆ';
                    const current = topicScores.get(topic) || { total: 0, count: 0 };
                    topicScores.set(topic, {
                        total: current.total + Number(a.score),
                        count: current.count + 1
                    });
                } else if (a.answer_text) {
                    comments.push({
                        text: a.answer_text,
                        submitted_at: r.submitted_at
                    });
                }
            }
        }

        return {
            summary: Array.from(topicScores.entries()).map(([topic, val]) => ({
                topic,
                count: val.count,
                total: val.total,
                average: val.count ? Number((val.total / val.count).toFixed(2)) : 0
            })),
            comments: comments.sort((a, b) => b.submitted_at.getTime() - a.submitted_at.getTime())
        };
    },

    async getSectionStudentsForEvaluation(teacher_id: number, section_id: number, year: number, semester: number) {
        // Find students enrolled in this assignment (no status filter - status values may vary)
        const enrolledStudents = await prisma.enrollments.findMany({
            where: {
                teaching_assignment_id: section_id,
            },
            include: {
                students: {
                    include: {
                        name_prefixes: true,
                        classroom_students: { take: 1, orderBy: { academic_year: 'desc' } },
                    }
                }
            }
        });

        const period_id = await resolveEvaluationPeriodId(year, semester);
        const teacher = await prisma.teachers.findUnique({ where: { id: teacher_id }, select: { user_id: true } });
        const teacher_user_id = teacher?.user_id;

        const results = [];
        const formResult: any[] = await prisma.$queryRawUnsafe(`
            SELECT f.id FROM evaluation_forms f
            JOIN evaluation_categories t ON f.category_id = t.id
            WHERE t.engine_type = 'teacher_eval_student'
        `);
        const formIds = formResult.map(f => f.id);

        for (const enrollment of enrolledStudents) {
            const s = enrollment.students;

            // Raw SQL because user_id is missing and we need to check if this student was evaluated
            // In teacher evaluates student, target_id IS the student ID
            const latestEvalResult = await prisma.$queryRawUnsafe<any[]>(
                `SELECT submitted_at FROM evaluation_responses 
                 WHERE evaluator_user_id = $1 
                 AND student_id = $2 
                 ${period_id ? `AND period_id = ${period_id}` : ''}
                 ${formIds.length > 0 ? `AND form_id IN (${formIds.join(',')})` : ''}
                 ORDER BY submitted_at DESC LIMIT 1`,
                teacher_user_id, s.id
            );

            const latestEval = latestEvalResult[0] || null;
            const cs = (s as any).classroom_students?.[0];

            results.push({
                id: s.id,
                student_code: s.student_code,
                name: `${s.name_prefixes?.prefix_name || ''}${s.first_name} ${s.last_name}`,
                evaluated: !!latestEval,
                submitted_at: latestEval?.submitted_at || null,
                roll_number: cs?.roll_number,
            });
        }

        return results.sort((a, b) => {
            const aNum = a.roll_number != null ? Number(a.roll_number) : 999999;
            const bNum = b.roll_number != null ? Number(b.roll_number) : 999999;
            if (aNum !== bNum) return aNum - bNum;
            return String(a.student_code || '').localeCompare(String(b.student_code || ''));
        });
    },

    async ensureSubjectEvaluationForm() {
        // Since models are missing from schema, use raw SQL for checks and inserts if needed
        const existing: any[] = await prisma.$queryRawUnsafe(`
            SELECT ef.* FROM evaluation_forms ef
            JOIN evaluation_categories eft ON ef.category_id = eft.id
            WHERE eft.engine_type = 'teacher_eval_student'
            LIMIT 1
        `);
        if (existing.length > 0) {
            const questions = await prisma.$queryRawUnsafe(`SELECT * FROM evaluation_questions WHERE form_id = $1 ORDER BY id ASC`, existing[0].id) as any[];
            existing[0].evaluation_questions = questions;
            return existing[0];
        }
        
        // If not exists, we'd need to insert it via raw SQL too, but for now fallback to the existing ones
        return null;
    },

    async getSubjectEvaluationTemplate(teacher_id: number, student_id: number, section_id: number, year: number, semester: number) {
        try {
            const [form, period_id] = await Promise.all([
                this.ensureSubjectEvaluationForm(),
                resolveEvaluationPeriodId(year, semester)
            ]);

            const [student, teacher] = await Promise.all([
                prisma.students.findUnique({ where: { id: student_id }, select: { user_id: true } }),
                prisma.teachers.findUnique({ where: { id: teacher_id }, select: { user_id: true } })
            ]);

            if (!teacher) throw new Error('ไม่พบข้อมูลครู');
            if (!student) throw new Error('ไม่พบข้อมูลนักเรียน');

            // Raw SQL for evaluation_responses because user_id column is missing
            // For SUBJECT_STUDENT, target_id stores the student ID
            const latestResponseResult = await prisma.$queryRawUnsafe<any[]>(
                `SELECT id, submitted_at FROM evaluation_responses 
                 WHERE form_id = $1 
                 AND evaluator_user_id = $2 
                 AND student_id = $3 
                 ${period_id ? `AND period_id = ${Number(period_id)}` : ''}
                 ORDER BY submitted_at DESC LIMIT 1`,
                form.id, teacher.user_id, student_id
            );
            const latestResponse = latestResponseResult[0] || null;

            let current: any[] = [];
            let feedback = '';

            if (latestResponse) {
                const answers: any[] = await prisma.$queryRawUnsafe(`
                    SELECT a.*, q.question_text
                    FROM evaluation_answers a
                    LEFT JOIN evaluation_questions q ON a.question_id = q.id
                    WHERE a.response_id = $1
                `, latestResponse.id);
                current = answers
                    .filter(a => a.score != null)
                    .map(a => ({ name: a.question_text || a.answer_text, score: Number(a.score) }));
                feedback = answers.find(a => a.score == null)?.answer_text || '';
            }

            const topics = ((form as any).evaluation_questions || []).map((q: any) => ({ id: q.id, name: q.question_text }));

            return {
                form_id: form.id,
                topics,
                current,
                feedback,
                submitted_at: latestResponse?.submitted_at || null
            };
        } catch (error: any) {
            console.error("[TeacherEvaluationService] Error in getSubjectEvaluationTemplate:", error);
            throw error;
        }
    },

    async submitSubjectEvaluation(payload: {
        teacher_id: number;
        student_id: number;
        section_id: number;
        year: number;
        semester: number;
        data: { name: string; score: number }[];
        feedback?: string;
    }) {
        const { teacher_id, student_id, section_id, year, semester, data, feedback } = payload;
        const [student, teacher, form, period_id] = await Promise.all([
            prisma.students.findUnique({ where: { id: student_id }, select: { user_id: true } }),
            prisma.teachers.findUnique({ where: { id: teacher_id }, select: { user_id: true } }),
            this.ensureSubjectEvaluationForm(),
            resolveEvaluationPeriodId(year, semester)
        ]);

        if (!student || !teacher) throw new Error('Student or teacher not found');

        const questionByText = new Map<string, number>();
        ((form as any).evaluation_questions || []).forEach((q: any) => questionByText.set(q.question_text.toLowerCase(), q.id));

        return prisma.$transaction(async (tx) => {
            // Raw SQL insert because user_id (student user id) is missing from table
            // We store student ID in target_id for SUBJECT_STUDENT
            const result = await tx.$queryRawUnsafe<any[]>(
                `INSERT INTO evaluation_responses (form_id, evaluator_user_id, student_id, period_id, submitted_at) 
                 VALUES ($1, $2, $3, $4, NOW()) 
                 RETURNING id`,
                form.id, teacher.user_id, student_id, period_id ?? undefined
            );
            const responseId = result[0].id;

            for (const item of data) {
                const qid = questionByText.get(item.name.toLowerCase()) || null;
                await tx.$executeRawUnsafe(`
                    INSERT INTO evaluation_answers (response_id, question_id, answer_text, score)
                    VALUES ($1, $2, $3, $4)
                `, responseId, qid, qid ? null : item.name, item.score);
            }

            if (feedback) {
                await tx.$executeRawUnsafe(`
                    INSERT INTO evaluation_answers (response_id, answer_text, score)
                    VALUES ($1, $2, null)
                `, responseId, feedback);
            }

            return { success: true, response_id: responseId };
        });
    },

    async getAdvisorEvaluation(teacher_id: number, year?: number, semester?: number) {
        const teacher = await prisma.teachers.findUnique({
            where: { id: teacher_id },
            select: { user_id: true },
        });
        if (!teacher) return [];

        const period_id = await resolveEvaluationPeriodId(year, semester);
        const teacherUserId = teacher.user_id ? Number(teacher.user_id) : 0;
        const targetIds = [teacher_id, teacherUserId].filter((n) => Number.isFinite(n) && n > 0);
        if (targetIds.length === 0) return [];

        const responseIdRows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
            `
            SELECT er.id
            FROM public.evaluation_responses er
            INNER JOIN public.evaluation_forms ef ON ef.id = er.form_id
            LEFT JOIN public.evaluation_categories eft ON eft.id = ef.category_id
            WHERE LOWER(COALESCE(eft.engine_type, '')) = 'advisor'
              AND er.student_id IN (${targetIds.join(',')})
              ${period_id ? `AND er.period_id = ${Number(period_id)}` : ''}
            ORDER BY er.submitted_at DESC NULLS LAST, er.id DESC
            `
        );

        const responseIds = (responseIdRows || []).map((r) => Number(r.id)).filter((n) => n > 0);
        if (responseIds.length === 0) return [];

        // Raw SQL for evaluation_responses findMany because model may be missing
        const responses: any[] = await prisma.$queryRawUnsafe(`
            SELECT er.*, u.username as creator_name, ep.semester_id, ay.year_name, s.semester_number
            FROM evaluation_responses er
            LEFT JOIN users u ON er.evaluator_user_id = u.id
            LEFT JOIN evaluation_periods ep ON er.period_id = ep.id
            LEFT JOIN semesters s ON ep.semester_id = s.id
            LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
            WHERE er.id IN (${responseIds.join(',')})
            ORDER BY er.submitted_at DESC, er.id DESC
        `);

        // Fetch answers for these responses via Raw SQL
        const allAnswers: any[] = await prisma.$queryRawUnsafe(`
            SELECT a.*, q.question_text
            FROM evaluation_answers a
            LEFT JOIN evaluation_questions q ON a.question_id = q.id
            WHERE a.response_id IN (${responseIds.join(',')})
            ORDER BY a.id ASC
        `);

        const rows: any[] = [];
        for (const r of responses) {
            const yearName = r.year_name || '';
            const semesterNo = r.semester_number || 0;
            const rAnswers = allAnswers.filter(a => a.response_id === r.id);
            for (const a of rAnswers) {
                if (a.score == null) continue;
                rows.push({
                    response_id: r.id,
                    topic: a.question_text || a.answer_text || 'ไม่ระบุหัวข้อ',
                    score: Number(a.score),
                    submitted_at: r.submitted_at,
                    submitted_by: r.creator_name || '',
                    year: yearName ? Number(yearName) || yearName : '',
                    semester: semesterNo ? Number(semesterNo) : '',
                });
            }
        }

        return rows;
    },

    async getAdvisorStudentEvaluationResults(teacher_id: number, year?: number, semester?: number) {
        const [teacher, advisoryStudents, period_id] = await Promise.all([
            prisma.teachers.findUnique({
                where: { id: teacher_id },
                select: { user_id: true },
            }),
            TeacherStudentsService.getAdvisoryStudents(teacher_id),
            resolveEvaluationPeriodId(year, semester),
        ]);

        const teacherUserId = Number(teacher?.user_id || 0);
        if (!teacherUserId || !advisoryStudents.length) return [];

        const studentMap = new Map<number, any>();
        const studentIds = advisoryStudents
            .map((s: any) => {
                const id = Number(s.id);
                if (id > 0) studentMap.set(id, s);
                return id;
            })
            .filter((id: number) => id > 0);

        if (!studentIds.length) return [];

        const responseRows = await prisma.$queryRawUnsafe<Array<{
            id: number;
            student_id: number | null;
            submitted_at: Date | null;
            year: string | null;
            semester: number | null;
        }>>(
            `
            SELECT
                er.id,
                er.student_id,
                er.submitted_at,
                ay.year_name AS year,
                sem.semester_number AS semester
            FROM public.evaluation_responses er
            INNER JOIN public.evaluation_forms ef ON ef.id = er.form_id
            LEFT JOIN public.evaluation_categories eft ON eft.id = ef.category_id
            LEFT JOIN public.evaluation_periods ep ON ep.id = er.period_id
            LEFT JOIN public.semesters sem ON sem.id = ep.semester_id
            LEFT JOIN public.academic_years ay ON ay.id = sem.academic_year_id
            WHERE LOWER(COALESCE(eft.engine_type, '')) = 'advisor'
              AND er.evaluator_user_id = ${teacherUserId}
              AND er.student_id IN (${studentIds.join(',')})
              ${period_id ? `AND er.period_id = ${Number(period_id)}` : ''}
            ORDER BY er.submitted_at DESC NULLS LAST, er.id DESC
            `
        );

        const latestByKey = new Map<string, typeof responseRows[number]>();
        for (const row of responseRows || []) {
            const studentId = Number(row.student_id || 0);
            if (!studentId) continue;
            const rowYear = String(row.year || year || '').trim();
            const rowSemester = Number(row.semester || semester || 0) || 0;
            const key = period_id
                ? `${studentId}`
                : `${studentId}:${rowYear || '-'}:${rowSemester || 0}`;
            if (!latestByKey.has(key)) latestByKey.set(key, row);
        }

        const latestResponses = Array.from(latestByKey.values());
        const responseIds = latestResponses.map((r) => Number(r.id)).filter((n) => n > 0);
        if (!responseIds.length) return [];

        // Raw SQL for evaluation_answers
        const answers: any[] = await prisma.$queryRawUnsafe(`
            SELECT a.*, q.question_text
            FROM evaluation_answers a
            LEFT JOIN evaluation_questions q ON a.question_id = q.id
            WHERE a.response_id IN (${responseIds.join(',')})
            ORDER BY a.response_id ASC, a.id ASC
        `);

        const answersByResponse = new Map<number, any[]>();
        for (const answer of answers) {
            const rid = Number(answer.response_id || 0);
            if (!rid) continue;
            if (!answersByResponse.has(rid)) answersByResponse.set(rid, []);
            answersByResponse.get(rid)!.push(answer);
        }

        return latestResponses
            .map((row) => {
                const studentId = Number(row.student_id || 0);
                const student = studentMap.get(studentId);
                if (!student) return null;

                const responseAnswers = answersByResponse.get(Number(row.id)) || [];
                const topics = responseAnswers
                    .filter((a: any) => a.score != null)
                    .map((a: any) => ({
                        name: a.question_text || a.answer_text || 'ไม่ระบุหัวข้อ',
                        score: Number(a.score),
                    }))
                    .filter((a: any) => a.name && Number.isFinite(a.score));

                const feedback = responseAnswers.find((a) => a.score == null && String(a.answer_text || '').trim())?.answer_text || '';
                const totalScore = topics.reduce((sum, t) => sum + Number(t.score || 0), 0);
                const averageScore = topics.length ? Number((totalScore / topics.length).toFixed(2)) : 0;

                return {
                    response_id: Number(row.id),
                    student_id: studentId,
                    student_code: student.student_code || '',
                    student_name: `${student.prefix || ''}${student.first_name || ''} ${student.last_name || ''}`.trim(),
                    class_level: student.class_level || '',
                    room: student.room || '',
                    room_label: formatRoomLabel(student.class_level || '', student.room || ''),
                    year: row.year ? (Number(row.year) || row.year) : (year ?? ''),
                    semester: Number(row.semester || semester || 0) || '',
                    submitted_at: row.submitted_at || null,
                    topics,
                    feedback: String(feedback || ''),
                    topic_count: topics.length,
                    average_score: averageScore,
                    total_score: totalScore,
                };
            })
            .filter(Boolean)
            .sort((a: any, b: any) => {
                const byYear = toNum(b.year) - toNum(a.year);
                if (byYear !== 0) return byYear;
                const bySemester = toNum(b.semester) - toNum(a.semester);
                if (bySemester !== 0) return bySemester;
                return String(a.student_code || '').localeCompare(String(b.student_code || ''));
            });
    },
};
