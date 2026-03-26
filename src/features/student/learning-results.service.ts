import { prisma } from '@/lib/prisma';

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

export const LearningResultsService = {
    // Advisor evaluation (supports multiple advisors and form types)
    async getAdvisorEvaluation(student_id: number, year?: number, semester?: number) {
        if (!student_id) return { advisors: [], evaluations: [] };
        const semester_id = await resolveSemesterId(year, semester);

        // 1. Find classroom and advisors for this student in the selected year
        console.log(`[getAdvisorEvaluation] student_id=${student_id}, year=${year}, semester=${semester}`);
        let classroomStudent = await prisma.classroom_students.findFirst({
            where: { 
                student_id: Number(student_id),
                academic_year: year ? Number(year) : undefined
            },
            select: { classroom_id: true, academic_year: true }
        });

        // Fallback: if no record for this specific year, try to get the most recent one
        if (!classroomStudent) {
            console.log(`[getAdvisorEvaluation] No classroom found for year ${year}, attempting fallback...`);
            classroomStudent = await prisma.classroom_students.findFirst({
                where: { student_id: Number(student_id) },
                orderBy: { academic_year: 'desc' },
                select: { classroom_id: true, academic_year: true }
            });
        }
        console.log(`[getAdvisorEvaluation] Final classroomStudent=${JSON.stringify(classroomStudent)}`);

        const advisors: any[] = [];
        if (classroomStudent?.classroom_id) {
            const advisorLinks = await prisma.classroom_advisors.findMany({
                where: { classroom_id: classroomStudent.classroom_id },
                include: {
                    teachers: {
                        include: { name_prefixes: true }
                    }
                }
            });
            console.log(`[getAdvisorEvaluation] found ${advisorLinks.length} advisor links`);

            advisorLinks.forEach(link => {
                const t = link.teachers;
                if (t) {
                    advisors.push({
                        id: t.id,
                        user_id: t.user_id,
                        name: `${t.name_prefixes?.prefix_name || ''}${t.first_name} ${t.last_name}`.trim()
                    });
                }
            });
        }

        // 2. Fetch all advisor responses for this student (support both student.id and student.user_id as target_student_id)
        const student = await prisma.students.findUnique({ where: { id: Number(student_id) }, select: { user_id: true } });
        const studentUserId = student?.user_id;
        
        const advisorUserIds = advisors.map(a => a.user_id).filter(id => id != null);
        console.log(`[getAdvisorEvaluation] semester_id=${semester_id}, studentUserId=${studentUserId}, advisorUserIds=${JSON.stringify(advisorUserIds)}`);

        let query = `
            SELECT er.id, er.evaluator_user_id, er.submitted_at, ef.form_name
            FROM public.evaluation_responses er
            INNER JOIN public.evaluation_forms ef ON ef.id = er.form_id
            WHERE (er.target_student_id = ${Number(student_id)}${studentUserId ? ` OR er.target_student_id = ${studentUserId}` : ''})
        `;
        
        if (semester_id) {
            query += ` AND er.semester_id = ${Number(semester_id)}`;
        }
        
        if (advisorUserIds.length > 0) {
            query += ` AND er.evaluator_user_id IN (${advisorUserIds.map(id => Number(id)).join(',')})`;
        } else {
            // If no advisors found even after fallback, we might want to still show responses from ANY teacher 
            // but the requirement is "Advisor". Let's keep it restricted to advisorUserIds for now.
            // If advisorUserIds is empty, this query would return everything if not for this 'else'.
            query += ` AND 1=0`; 
        }

        query += ` ORDER BY er.submitted_at DESC`;

        const responseRows = advisorUserIds.length > 0 ? await prisma.$queryRawUnsafe<any[]>(query) : [];
        console.log(`[getAdvisorEvaluation] found ${responseRows.length} response rows using query: ${query}`);

        const evaluations: any[] = [];

        for (const resp of responseRows) {
            const answers: any[] = await prisma.$queryRawUnsafe(`
                SELECT ea.*, eq.question_text, es.section_name
                FROM evaluation_answers ea
                LEFT JOIN evaluation_questions eq ON eq.id = ea.question_id
                LEFT JOIN evaluation_sections es ON eq.section_id = es.id
                WHERE ea.response_id = $1
                ORDER BY ea.id ASC
            `, Number(resp.id));

            const topics = answers
                .filter((a) => a.score_value != null)
                .map((a) => {
                    const nameText = a.question_text || a.text_value || '';
                    const sectionMatch = nameText.match(/^(\d+)\./);
                    const sectionNameFallback = sectionMatch ? `ตอนที่ ${sectionMatch[1]}` : 'ไม่ระบุตอน';
                    return {
                        name: nameText,
                        section_name: a.section_name || sectionNameFallback,
                        score: Number(a.score_value),
                    };
                })
                .filter((a) => a.name && Number.isFinite(a.score));

            const feedback = answers.find(a => a.score_value == null && !a.question_id)?.text_value || '';
            const totalScore = topics.reduce((sum, t) => sum + (t.score || 0), 0);
            const avgScore = topics.length > 0 ? (totalScore / topics.length).toFixed(2) : 0;

            evaluations.push({
                response_id: resp.id,
                evaluator_user_id: resp.evaluator_user_id,
                form_name: resp.form_name,
                submitted_at: resp.submitted_at,
                topics,
                feedback,
                average_score: Number(avgScore)
            });
        }

        return {
            advisors,
            evaluations
        };
    },

    // Subject-level results derived from actual teacher evaluations
    async getSubjectEvaluation(
        student_id: number,
        teaching_assignment_id?: number,
        year?: number,
        semester?: number,
        subject_id?: number
    ) {
        if (!student_id) return [];

        const student = await prisma.students.findUnique({
            where: { id: student_id },
            select: { user_id: true }
        });

        if (!student) return [];

        const enrollmentWhere: any = { student_id };
        if (teaching_assignment_id) {
            enrollmentWhere.teaching_assignment_id = teaching_assignment_id;
        }
        if (subject_id || year || semester) {
            enrollmentWhere.teaching_assignments = {};
            if (subject_id) enrollmentWhere.teaching_assignments.subject_id = subject_id;
            if (semester) enrollmentWhere.teaching_assignments.semesters = { semester_number: semester };
            if (year) {
                enrollmentWhere.teaching_assignments.semesters = {
                    ...(enrollmentWhere.teaching_assignments.semesters || {}),
                    academic_years: { year_name: String(year) },
                };
            }
        }

        const enrollments = await prisma.enrollments.findMany({
            where: enrollmentWhere,
            include: {
                teaching_assignments: {
                    include: {
                        subjects: true,
                        semesters: { include: { academic_years: true } },
                        teachers: true
                    },
                },
            },
        });

        if (enrollments.length === 0) return [];

        const semester_id = await resolveSemesterId(year, semester);

        // We do not need to strictly filter by form type since the teacher submission only generates one per subject.
        const results: any[] = [];

        // For each enrollment, find the latest evaluation response
        for (const enrollment of enrollments) {
            const ta = enrollment.teaching_assignments;
            const subject = ta.subjects;
            const teacher = ta.teachers;

            let sql = `SELECT id, submitted_at FROM evaluation_responses 
                       WHERE target_student_id = $1
                       AND target_subject_id = $2`;
            const params: any[] = [student_id, ta.id];

            if (teacher?.user_id) {
                sql += ` AND evaluator_user_id = $3`;
                params.push(teacher.user_id);
            }
            if (semester_id) {
                sql += ` AND semester_id = $${params.length + 1}`;
                params.push(Number(semester_id));
            }

            sql += ` ORDER BY submitted_at DESC LIMIT 1`;

            const latestResponseResult = await prisma.$queryRawUnsafe<any[]>(sql, ...params);
            const latestResponse = latestResponseResult[0];

            if (!latestResponse) continue; // No evaluation for this subject

            const answers: any[] = await prisma.$queryRawUnsafe(`
                SELECT ea.*, eq.question_text, es.section_name as section_name
                FROM evaluation_answers ea
                LEFT JOIN evaluation_questions eq ON eq.id = ea.question_id
                LEFT JOIN evaluation_sections es ON eq.section_id = es.id
                WHERE ea.response_id = $1
                ORDER BY ea.id ASC
            `, latestResponse.id);

            const topics = answers
                .filter(a => a.score_value != null)
                .map(a => {
                    const nameText = a.question_text || a.text_value || '';
                    const sectionMatch = nameText.match(/^(\d+)\./);
                    const sectionNameFallback = sectionMatch ? `ตอนที่ ${sectionMatch[1]}` : 'ไม่ระบุตอน';
                    return {
                        name: nameText,
                        section_name: a.section_name || sectionNameFallback,
                        score: Number(a.score_value)
                    };
                });

            const feedback = answers.find(a => a.score_value == null)?.text_value || '';
            const totalScore = topics.reduce((sum, t) => sum + (t.score || 0), 0);
            const avgScore = topics.length > 0 ? (totalScore / topics.length).toFixed(2) : 0;

            results.push({
                subject_code: subject?.subject_code || '',
                subject_name: subject?.subject_name || '',
                teacher_name: `${teacher?.first_name || ''} ${teacher?.last_name || ''}`.trim(),
                topics,
                feedback,
                average_score: Number(avgScore),
                submitted_at: latestResponse.submitted_at,
                year: ta.semesters?.academic_years?.year_name || '',
                semester: ta.semesters?.semester_number || 0,
            });
        }

        return results;
    },

    async getSdqEvaluation(student_id: number, year: number, semester: number) {
        if (!student_id) return null;

        const user_id = await prisma.students.findUnique({
            where: { id: student_id },
            select: { user_id: true }
        }).then(s => s?.user_id);

        if (!user_id) return null;

        const semester_id = await resolveSemesterId(year, semester);

        // Find SDQ form response
        const sdqResponse = await (prisma.evaluation_responses as any).findFirst({
            where: {
                evaluator_user_id: user_id,
                evaluation_forms: {
                    form_name: { contains: 'SDQ', mode: 'insensitive' }
                },
                ...(semester_id ? { semester_id: Number(semester_id) } : {})
            },
            include: {
                evaluation_answers: {
                    include: {
                        evaluation_questions: {
                            include: {
                                evaluation_sections: true
                            }
                        }
                    }
                }
            },
            orderBy: { submitted_at: 'desc' }
        });

        if (!sdqResponse) return null;

        // Group by sections and calculate scores
        const sectionMap = new Map<number, { name: string, score: number, questions: any[] }>();

        (sdqResponse?.evaluation_answers || []).forEach((ans: any) => {
            const q = ans.evaluation_questions;
            const sec = q?.evaluation_sections;
            if (!sec) return;

            if (!sectionMap.has(sec.id)) {
                sectionMap.set(sec.id, {
                    name: sec.section_name,
                    score: 0,
                    questions: []
                });
            }

            const section = sectionMap.get(sec.id)!;
            const score = Number(ans.score_value || 0);
            section.score += score;
            section.questions.push({
                text: q.question_text,
                score: score
            });
        });

        const results = Array.from(sectionMap.values()).map(sec => {
            let status = "ปกติ";
            let color = "emerald";

            if (sec.score >= 7) {
                status = "มีปัญหา";
                color = "rose";
            } else if (sec.score === 6) {
                status = "เสี่ยง";
                color = "amber";
            }

            return {
                section_name: sec.name,
                total_score: sec.score,
                status,
                color,
                questions: sec.questions
            };
        });

        return {
            submitted_at: sdqResponse.submitted_at,
            results
        };
    },
};
