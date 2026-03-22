import { prisma } from '@/lib/prisma';
import { TeacherStudentsService } from '@/features/teacher/students.service';
import { promises as fs } from 'fs';
import path from 'path';

const LOG_FILE = 'debug_advisor.log';
async function debugLog(msg: string) {
    const timestamp = new Date().toISOString();
    try {
        await fs.appendFile(path.join(process.cwd(), LOG_FILE), `[${timestamp}] [EvaluationService] ${msg}\n`);
    } catch (e) { /* ignore */ }
}

async function resolveEvaluationPeriodId(year?: number, semester?: number) {
    if (!year || !semester) return null;
    try {
        // Resolve semester_id from semesters table directly
        const semRow: any[] = await prisma.$queryRawUnsafe(`
            SELECT s.id FROM semesters s
            INNER JOIN academic_years ay ON ay.id = s.academic_year_id
            WHERE ay.year_name = $1 AND s.semester_number = $2
            LIMIT 1
        `, String(year), semester);
        
        return semRow[0]?.id ? Number(semRow[0].id) : null;
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
            console.log(`[getTeachingEvaluation] teacher_id=${teacher_id}, year=${year}, semester=${semester}`);
            const rawAssignments = await prisma.teaching_assignments.findMany({
                where: {
                    teacher_id,
                },
                include: {
                    subjects: true,
                    classrooms: { include: { levels: true } },
                    semesters: { include: { academic_years: true } },
                }
            });

            // Filter in memory for robustness and debugging
            const assignments = rawAssignments.filter(ta => {
                const taYear = Number(ta.semesters?.academic_years?.year_name);
                const taSemester = ta.semesters?.semester_number;
                
                const matchYear = !year || taYear === year || String(taYear) === String(year);
                const matchSemester = !semester || taSemester === semester;
                
                return matchYear && matchSemester;
            });

            // Fallback: If filtered list is empty but raw list has items, return the raw list
            // to prevent empty dropdowns due to year-name formatting mismatches.
            const finalAssignments = assignments.length > 0 ? assignments : rawAssignments;

            console.log(`[getTeachingEvaluation] raw=${rawAssignments.length}, filtered=${assignments.length}, final=${finalAssignments.length}`);

            // Pre-fetch the teaching evaluation form ID via Raw SQL
            const formResult: any[] = await prisma.$queryRawUnsafe(`
                SELECT f.id FROM evaluation_forms f
                JOIN evaluation_categories t ON f.category_id = t.id
                WHERE t.target_type = 'subject'
                LIMIT 1
            `);
            const teachingFormId = formResult[0]?.id || null;

            const results: any[] = [];
            for (const ta of finalAssignments) {
                const countResult = await prisma.$queryRawUnsafe<any[]>(
                    `SELECT COUNT(*)::int as count FROM evaluation_responses 
                     WHERE target_subject_id = $1 
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
        let sql = `SELECT * FROM evaluation_responses WHERE target_subject_id IS NOT NULL `;
        const params: any[] = [];

        if (section_id) {
            sql += ` AND target_subject_id = $1 `;
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
                sql += ` AND target_subject_id IN (${ids.join(',')}) `;
            } else {
                return { summary: [], comments: [] };
            }
        }

        // Fetch teaching form ID via Raw SQL
        const formResult: any[] = await prisma.$queryRawUnsafe(`
            SELECT f.id FROM evaluation_forms f
            JOIN evaluation_categories t ON f.category_id = t.id
            WHERE t.target_type = 'teaching'
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
            SELECT a.*, q.question_text, s.section_name
            FROM evaluation_answers a
            LEFT JOIN evaluation_questions q ON a.question_id = q.id
            LEFT JOIN evaluation_sections s ON q.section_id = s.id
            WHERE a.response_id IN (${responseIds.join(',')})
        `);

        const topicScores = new Map<string, { total: number; count: number; section: string; topic: string }>();
        const comments: any[] = [];

        for (const r of responses) {
            const rAnswers = allAnswers.filter(a => a.response_id === r.id);
            for (const a of rAnswers) {
                if (a.score_value != null) {
                    const topic = a.question_text || a.text_value || 'อื่นๆ';
                    // Fallback to "ตอนที่ X" if section_name is null but topic starts with "X.Y"
                    const sectionNameFallback = topic.match(/^(\d+)\./) ? `ตอนที่ ${topic.match(/^(\d+)\./)[1]}` : 'ไม่ระบุตอน';
                    const section = a.section_name || sectionNameFallback;
                    
                    const key = `${section}@@${topic}`;
                    const current = topicScores.get(key) || { total: 0, count: 0, section, topic };
                    topicScores.set(key, {
                        total: current.total + Number(a.score_value),
                        count: current.count + 1,
                        section,
                        topic
                    });
                } else if (a.text_value) {
                    comments.push({
                        text: a.text_value,
                        submitted_at: r.submitted_at
                    });
                }
            }
        }

        return {
            summary: Array.from(topicScores.values()).map((val) => ({
                topic: val.topic,
                section_name: val.section,
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
            WHERE t.target_type = 'STUDENT' AND t.evaluator_role_id = 2
        `);
        const formIds = formResult.map(f => f.id);

        for (const enrollment of enrolledStudents) {
            const s = enrollment.students;

            // Raw SQL because user_id is missing and we need to check if this student was evaluated
            // In teacher evaluates student, target_id IS the student ID
            const latestEvalResult = await prisma.$queryRawUnsafe<any[]>(
                `SELECT submitted_at FROM evaluation_responses 
                 WHERE evaluator_user_id = $1 
                 AND target_student_id = $2 
                 ${period_id ? `AND semester_id = ${period_id}` : ''}
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

    async ensureSubjectEvaluationForm(section_id?: number) {
        try {
            let matchingForm: any = null;

            if (section_id) {
                // 1. Get subject details for the section
                const assignment = await prisma.teaching_assignments.findUnique({
                    where: { id: section_id },
                    include: { subjects: true }
                });

                if (assignment?.subjects) {
                    const code = assignment.subjects.subject_code || '';
                    const name = assignment.subjects.subject_name || '';
                    const learningGroupId = assignment.subjects.learning_subject_group_id;

                    // 2. Fetch via form_subject_mappings if learningGroupId exists
                    let mappedRows: any[] = [];
                    if (learningGroupId) {
                        try {
                            mappedRows = await prisma.$queryRawUnsafe(`
                                SELECT * FROM form_subject_mappings 
                                WHERE learning_subject_group_id = $1
                            `, learningGroupId);
                        } catch (e) {
                            try {
                                mappedRows = await prisma.$queryRawUnsafe(`
                                    SELECT * FROM form_subject_mappings 
                                    WHERE subject_group_id = $1
                                `, learningGroupId);
                            } catch (e2) { /* fallback to following keywords match */ }
                        }
                    }

                    if (mappedRows.length > 0) {
                        const formId = mappedRows[0].form_id || mappedRows[0].evaluation_form_id;
                        if (formId) {
                            const matched: any[] = await prisma.$queryRawUnsafe(`
                                SELECT * FROM evaluation_forms WHERE id = $1
                            `, formId);
                            if (matched.length > 0) matchingForm = matched[0];
                        }
                    }

                    // 3. Keyword Match Fallback: If no mappings row or no formId found
                    if (!matchingForm) {
                        const candidates: any[] = await prisma.$queryRawUnsafe(`
                            SELECT * FROM evaluation_forms 
                            WHERE id BETWEEN 9 AND 17
                        `);

                        matchingForm = candidates.find(f => {
                            const formWord = f.form_name.replace('ประเมินหมวด', '').trim();
                            return name.includes(formWord) || formWord.includes(name) || f.form_name.includes(name) || name.includes(f.form_name);
                        });
                    }
                }
            }

            // Fallback: If no match or no section_id, get the first form in range 9-17
            if (!matchingForm) {
                const fallback: any[] = await prisma.$queryRawUnsafe(`
                    SELECT * FROM evaluation_forms 
                    WHERE id BETWEEN 9 AND 17
                    ORDER BY id ASC
                    LIMIT 1
                `);
                if (fallback.length > 0) {
                    matchingForm = fallback[0];
                }
            }

            // Absolute Fallback: Original general lookup to avoid empty crash
            if (!matchingForm) {
                const original: any[] = await prisma.$queryRawUnsafe(`
                    SELECT ef.* FROM evaluation_forms ef
                    JOIN evaluation_categories eft ON ef.category_id = eft.id
                    WHERE eft.target_type = 'STUDENT' AND eft.evaluator_role_id = 2
                    LIMIT 1
                `);
                if (original.length > 0) {
                    matchingForm = original[0];
                }
            }

            if (matchingForm) {
                const formId = matchingForm.id;

                // 1. Fetch sections
                const sections = await prisma.$queryRawUnsafe(`
                    SELECT * FROM evaluation_sections 
                    WHERE form_id = $1 
                    ORDER BY order_number ASC
                `, formId) as any[];

                // 2. Fetch questions joined with sections
                const questions = await prisma.$queryRawUnsafe(`
                    SELECT q.* 
                    FROM evaluation_questions q
                    JOIN evaluation_sections s ON q.section_id = s.id
                    WHERE s.form_id = $1
                    ORDER BY s.order_number ASC, q.order_number ASC
                `, formId) as any[];

                // 3. Fetch scale options (hardcoded to ID 5 based on user requirement)
                let scaleOptions: any[] = [];
                try {
                    scaleOptions = await prisma.$queryRawUnsafe(`
                        SELECT label, score_value, order_number 
                        FROM evaluation_scale_items 
                        WHERE scale_type_id = 5
                        ORDER BY score_value DESC
                    `) as any[];
                } catch (e) {
                    console.error("Failed to fetch scale options for ID 5", e);
                }

                matchingForm.scale_options = scaleOptions.map(opt => ({
                    label: opt.label || String(opt.score_value),
                    value: Number(opt.score_value)
                }));

                matchingForm.evaluation_questions = questions; // Flat list for compatibility
                matchingForm.sections = sections.map(sec => ({
                    id: sec.id,
                    name: sec.section_name,
                    description: sec.section_description,
                    order_number: sec.order_number,
                    topics: questions.filter(q => q.section_id === sec.id).map(q => ({ id: q.id, name: q.question_text }))
                }));

                return matchingForm;
            }
        } catch (error: any) {
            throw error;
        }
        return null;
    },

    async getSubjectEvaluationTemplate(teacher_id: number, student_id: number, section_id: number, year: number, semester: number) {
        try {
            const [form, period_id] = await Promise.all([
                this.ensureSubjectEvaluationForm(section_id),
                resolveEvaluationPeriodId(year, semester)
            ]);

            const [student, teacher] = await Promise.all([
                prisma.students.findUnique({ where: { id: student_id }, select: { user_id: true } }),
                prisma.teachers.findUnique({ where: { id: teacher_id }, select: { user_id: true } })
            ]);

            if (!teacher) throw new Error('ไม่พบข้อมูลครู');
            if (!student) throw new Error('ไม่พบข้อมูลนักเรียน');

            if (!form) throw new Error('ไม่พบแบบประเมิน');

            // Raw SQL for evaluation_responses because user_id column is missing
            // For SUBJECT_STUDENT, target_id stores the student ID
            const latestResponseResult = await prisma.$queryRawUnsafe<any[]>(
                `SELECT id, submitted_at FROM evaluation_responses 
                 WHERE form_id = $1 
                 AND evaluator_user_id = $2 
                 AND target_student_id = $3 
                 ${period_id ? `AND semester_id = ${Number(period_id)}` : ''}
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
                    .filter(a => a.score_value != null)
                    .map(a => ({ name: a.question_text || a.text_value, score: Number(a.score_value) }));
                feedback = answers.find(a => a.score_value == null)?.text_value || '';
            }

            const topics = ((form as any).evaluation_questions || []).map((q: any) => ({ id: q.id, name: q.question_text }));
            const sections = (form.sections || []);

            const result = {
                form_id: form.id,
                topics, // flat for compat
                sections, // grouped for rendering
                scale_options: (form as any).scale_options || null,
                current,
                feedback,
                submitted_at: latestResponse?.submitted_at || null
            };

            const fs2 = require('fs');
            fs2.writeFileSync('d:\\new\\WinAi_SeeuNextLift\\eval_template_response.txt', JSON.stringify(result, null, 2));

            return result;
        } catch (error: any) {
            console.error("[TeacherEvaluationService] Error in getSubjectEvaluationTemplate:", error);
            try {
                const fs = require('fs');
                fs.writeFileSync('d:\\new\\WinAi_SeeuNextLift\\eval_error_service.txt', error.message + '\n' + error.stack);
            } catch (e) {}
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
            this.ensureSubjectEvaluationForm(section_id),
            resolveEvaluationPeriodId(year, semester)
        ]);

        if (!student || !teacher) throw new Error('Student or teacher not found');
        if (!form) throw new Error('Evaluation form not found for this subject');

        const questionByText = new Map<string, number>();
        ((form as any).evaluation_questions || []).forEach((q: any) => questionByText.set(q.question_text.toLowerCase(), q.id));

        return prisma.$transaction(async (tx) => {
            // Raw SQL insert because user_id (student user id) is missing from table
            // We store student ID in target_id for SUBJECT_STUDENT
            const result = await tx.$queryRawUnsafe<any[]>(
                `INSERT INTO evaluation_responses (form_id, evaluator_user_id, target_student_id, target_subject_id, semester_id, submitted_at) 
                 VALUES ($1, $2, $3, $4, $5, NOW()) 
                 RETURNING id`,
                form.id, 
                teacher.user_id ?? null, 
                student_id, 
                section_id, 
                period_id ?? null
            );
            const responseId = result[0].id;

            for (const item of data) {
                const qid = questionByText.get(item.name.toLowerCase()) || null;
                await tx.$executeRawUnsafe(`
                    INSERT INTO evaluation_answers (response_id, question_id, text_value, score_value)
                    VALUES ($1, $2, $3, $4)
                `, responseId, qid, qid ? null : item.name, item.score);
            }

            if (feedback) {
                await tx.$executeRawUnsafe(`
                    INSERT INTO evaluation_answers (response_id, text_value, score_value)
                    VALUES ($1, $2, null)
                `, responseId, feedback);
            }

            return { success: true, response_id: responseId };
        });
    },

    async getAdvisorEvaluation(teacher_id: number, year?: number, semester?: number) {
        await debugLog(`getAdvisorEvaluation: START teacher_id=${teacher_id}, year=${year}, semester=${semester}`);
        
        const teacher = await prisma.teachers.findUnique({
            where: { id: teacher_id },
            select: { user_id: true },
        });
        if (!teacher) {
            await debugLog(`getAdvisorEvaluation: Teacher not found for ID ${teacher_id}`);
            return [];
        }

        // Resolve semester_id from semesters table directly
        let semesterId: number | null = null;
        if (year && semester) {
            const semRow: any[] = await prisma.$queryRawUnsafe(`
                SELECT s.id FROM semesters s
                INNER JOIN academic_years ay ON ay.id = s.academic_year_id
                WHERE ay.year_name = $1 AND s.semester_number = $2
                LIMIT 1
            `, String(year), semester);
            semesterId = semRow[0]?.id ? Number(semRow[0].id) : null;
        }
        await debugLog(`getAdvisorEvaluation: Resolved semesterId=${semesterId}`);

        // Submissions use target_teacher_id (not target_student_id)
        // Find forms that are either target_type='advisor' OR have 'ที่ปรึกษา' in name
        const responseIdRows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
            `
            SELECT er.id
            FROM public.evaluation_responses er
            INNER JOIN public.evaluation_forms ef ON ef.id = er.form_id
            LEFT JOIN public.evaluation_categories eft ON eft.id = ef.category_id
            WHERE (LOWER(COALESCE(eft.target_type, '')) = 'advisor' OR ef.form_name LIKE '%ที่ปรึกษา%')
              AND er.target_teacher_id = ${Number(teacher_id)}
              ${semesterId ? `AND er.semester_id = ${semesterId}` : ''}
            ORDER BY er.submitted_at DESC NULLS LAST, er.id DESC
            `
        );

        const responseIds = (responseIdRows || []).map((r) => Number(r.id)).filter((n) => n > 0);
        await debugLog(`getAdvisorEvaluation: Found ${responseIds.length} response IDs for criteria (advisor or ที่ปรึกษา)`);
        if (responseIds.length === 0) return [];

        // Raw SQL for evaluation_responses - join directly with semesters (no evaluation_periods table)
        const responses: any[] = await prisma.$queryRawUnsafe(`
            SELECT er.*, u.username as creator_name, ay.year_name, s.semester_number
            FROM evaluation_responses er
            LEFT JOIN users u ON er.evaluator_user_id = u.id
            LEFT JOIN semesters s ON er.semester_id = s.id
            LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
            WHERE er.id IN (${responseIds.join(',')})
            ORDER BY er.submitted_at DESC, er.id DESC
        `);

        // Fetch answers for these responses via Raw SQL
        const allAnswers: any[] = await prisma.$queryRawUnsafe(`
            SELECT a.*, q.question_text, s.section_name
            FROM evaluation_answers a
            LEFT JOIN evaluation_questions q ON a.question_id = q.id
            LEFT JOIN evaluation_sections s ON q.section_id = s.id
            WHERE a.response_id IN (${responseIds.join(',')})
            ORDER BY a.id ASC
        `);

        const rows: any[] = [];
        for (const r of responses) {
            const yearName = r.year_name || '';
            const semesterNo = r.semester_number || 0;
            const rAnswers = allAnswers.filter(a => a.response_id === r.id);
            for (const a of rAnswers) {
                const score = a.score != null ? a.score : a.score_value;
                const feedbackValue = a.text_value || '';
                
                // If it's a comment (no score), provide it in the results
                if (score == null && !feedbackValue.trim()) continue;
                
                const topic = a.question_text || a.answer_text || (score == null ? 'ข้อเสนอแนะ' : 'ไม่ระบุหัวข้อ');
                
                // Fallback to "ตอนที่ X" if section_name is null but topic starts with "X.Y"
                const sectionMatch = topic.match(/^(\d+)\./);
                const sectionNameFallback = sectionMatch ? `ตอนที่ ${sectionMatch[1]}` : 'ไม่ระบุตอน';
                
                rows.push({
                    response_id: r.id,
                    topic: topic,
                    section_name: a.section_name || sectionNameFallback,
                    score: score != null ? Number(score) : null,
                    feedback: feedbackValue,
                    submitted_at: r.submitted_at,
                    submitted_by: r.creator_name || '',
                    year: yearName ? Number(yearName) || yearName : '',
                    semester: semesterNo ? Number(semesterNo) : '',
                });
            }
        }
        await debugLog(`getAdvisorEvaluation: Generated ${rows.length} result rows`);
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
                er.target_student_id as student_id,
                er.submitted_at,
                ay.year_name AS year,
                sem.semester_number AS semester
            FROM public.evaluation_responses er
            INNER JOIN public.evaluation_forms ef ON ef.id = er.form_id
            LEFT JOIN public.evaluation_categories eft ON eft.id = ef.category_id
            LEFT JOIN public.evaluation_periods ep ON ep.id = er.period_id
            LEFT JOIN public.semesters sem ON sem.id = ep.semester_id
            LEFT JOIN public.academic_years ay ON ay.id = sem.academic_year_id
            WHERE LOWER(COALESCE(eft.target_type, '')) = 'advisor'
              AND er.evaluator_user_id = ${teacherUserId}
              AND er.target_student_id IN (${studentIds.join(',')})
              ${period_id ? `AND er.semester_id = ${Number(period_id)}` : ''}
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
                        name: a.question_text || a.text_value || 'ไม่ระบุหัวข้อ',
                        score: Number(a.score_value),
                    }))
                    .filter((a: any) => a.name && Number.isFinite(a.score));

                const feedback = responseAnswers.find((a) => a.score_value == null && String(a.text_value || '').trim())?.text_value || '';
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

    async getTeachingStudentEvaluationResults(teacher_id: number, section_id: number, year: number, semester: number) {
        // 1. Get all students enrolled in this section
        const enrolledStudents = await prisma.enrollments.findMany({
            where: {
                teaching_assignment_id: section_id,
            },
            include: {
                students: {
                    include: {
                        name_prefixes: true,
                        classroom_students: { 
                            where: { academic_year: year },
                            take: 1 
                        },
                    }
                }
            }
        });

        const period_id = await resolveEvaluationPeriodId(year, semester);

        // 2. Fetch teaching form ID(s)
        const formResult: any[] = await prisma.$queryRawUnsafe(`
            SELECT f.id FROM evaluation_forms f
            JOIN evaluation_categories t ON f.category_id = t.id
            WHERE t.target_type IN ('subject', 'teaching')
        `);
        const formIds = formResult.map(f => f.id);

        const results = [];
        for (const enrollment of enrolledStudents) {
            const s = enrollment.students;
            if (!s) continue;

            // Check if this student (as evaluator) has responded for this section
            const responseResult = await prisma.$queryRawUnsafe<any[]>(
                `SELECT submitted_at FROM evaluation_responses 
                 WHERE evaluator_user_id = $1 
                 AND target_subject_id = $2 
                 ${period_id ? `AND semester_id = ${Number(period_id)}` : ''}
                 ${formIds.length > 0 ? `AND form_id IN (${formIds.join(',')})` : ''}
                 ORDER BY submitted_at DESC LIMIT 1`,
                s.user_id, section_id
            );

            const response = responseResult[0] || null;
            const cs = (s as any).classroom_students?.[0];

            results.push({
                id: s.id,
                student_code: s.student_code,
                name: `${s.name_prefixes?.prefix_name || ''}${s.first_name} ${s.last_name}`,
                evaluated: !!response,
                submitted_at: response?.submitted_at || null,
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
};
