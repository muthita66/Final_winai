import { prisma } from '@/lib/prisma';
import { promises as fs } from 'fs';
import path from 'path';

const LOG_FILE = 'debug_advisor.log';

async function debugLog(msg: string) {
    const timestamp = new Date().toISOString();
    try {
        await fs.appendFile(path.join(process.cwd(), LOG_FILE), `[${timestamp}] ${msg}\n`);
    } catch (e) {
        // ignore
    }
}

const STUDENT_PHOTO_REL_DIR = '/uploads/student-photos';
const STUDENT_PHOTO_PUBLIC_DIR = path.join(process.cwd(), 'public', 'uploads', 'student-photos');
const DEFAULT_ADVISOR_EVAL_TOPICS = [
    'ความรับผิดชอบ',
    'วินัยและการตรงต่อเวลา',
    'ความตั้งใจเรียน',
    'การอยู่ร่วมกับผู้อื่น',
    'การปฏิบัติตามกฎระเบียบ',
];
const DEFAULT_READING_THINKING_TOPICS = [
    'การอ่าน',
    'การคิดวิเคราะห์',
    'การเขียน',
];

function nextId(maxId?: number | null) {
    return (Number(maxId || 0) || 0) + 1;
}

async function resolveStudentPhotoUrl(student_id: number) {
    if (!student_id) return null;

    const candidates = ['jpg', 'jpeg', 'png', 'webp'].map((ext) => `student-${student_id}.${ext}`);
    for (const filename of candidates) {
        try {
            await fs.access(path.join(STUDENT_PHOTO_PUBLIC_DIR, filename));
            return `${STUDENT_PHOTO_REL_DIR}/${filename}`;
        } catch {
            // continue
        }
    }
    return null;
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

async function resolveEvaluationPeriodId(year?: number, semester?: number) {
    if (!year || !semester) {
        await debugLog(`[resolveEvaluationPeriodId] Missing year/semester: ${year}/${semester}`);
        return null;
    }
    try {
        const period: any[] = await prisma.$queryRawUnsafe(`
            SELECT ep.id FROM evaluation_periods ep
            JOIN semesters s ON ep.semester_id = s.id
            JOIN academic_years ay ON s.academic_year_id = ay.id
            WHERE s.semester_number = $1 AND ay.year_name = $2
            ORDER BY ep.id DESC LIMIT 1
        `, semester, String(year));
        await debugLog(`[resolveEvaluationPeriodId] Found: ${period[0]?.id}`);
        return period[0]?.id ?? null;
    } catch (err: any) { 
        await debugLog(`[resolveEvaluationPeriodId] ERROR: ${err?.message}`);
        console.error('[resolveEvaluationPeriodId] ERROR:', err);
        return null; 
    }
}

async function ensureAdvisorEvaluationForm(sub_mode: string = 'attributes') {
    try {
        const formName = sub_mode === 'reading_thinking' ? 'แบบประเมินการอ่านคิดวิเคราะห์' : 'แบบประเมินคุณลักษณะอันพึงประสงค์';
        await debugLog(`[ensureForm] Searching via Raw SQL for: ${formName}`);
        
        // Use raw SQL to join forms, sections, and questions to avoid Prisma Client schema validation on missing columns
        const rows: any[] = await prisma.$queryRawUnsafe(`
            SELECT 
                ef.id as form_id, ef.form_name,
                es.id as section_id, es.section_name, es.order_number as section_order,
                eq.id as question_id, eq.question_text, eq.order_number as question_order
            FROM evaluation_forms ef
            JOIN evaluation_sections es ON ef.id = es.form_id
            JOIN evaluation_questions eq ON es.id = eq.section_id
            WHERE ef.form_name = $1
            ORDER BY es.order_number ASC, eq.order_number ASC
        `, formName);
        
        if (rows.length > 0) {
            await debugLog(`[ensureForm] Found ${rows.length} rows for form: ${rows[0].form_id}`);
            
            const formObj = {
                id: rows[0].form_id,
                form_name: rows[0].form_name,
                evaluation_sections: [] as any[],
                evaluation_questions: [] as any[]
            };

            const sectionsMap = new Map<number, any>();
            rows.forEach(row => {
                if (!sectionsMap.has(row.section_id)) {
                    const section = {
                        id: row.section_id,
                        section_name: row.section_name,
                        order_number: row.section_order,
                        evaluation_questions: []
                    };
                    sectionsMap.set(row.section_id, section);
                    formObj.evaluation_sections.push(section);
                }
                
                const question = {
                    id: row.question_id,
                    section_id: row.section_id,
                    question_text: row.question_text,
                    order_number: row.question_order,
                    section_name: row.section_name,
                    section_order: row.section_order
                };
                formObj.evaluation_questions.push(question);
                
                // Also push to the specific section
                const section = sectionsMap.get(row.section_id);
                if (section) {
                    section.evaluation_questions.push(question);
                }
            });

            return formObj;
        }
        await debugLog(`[ensureForm] No form found by name: ${formName}`);
        return null;
    } catch (err: any) {
        await debugLog(`[ensureForm] ERROR: ${err?.message}`);
        console.error('[ensureAdvisorEvaluationForm] ERROR:', err);
        throw err;
    }
}

async function findLatestAdvisorResponseForStudent(form_id: number, student_id: number, period_id?: number | null) {
    if (!form_id || !student_id) return null;
    
    // We try to match both period_id maps to semester_id in evaluation_responses conceptually,
    // though the DB schema uses target_student_id and semester_id instead of student_id and period_id.
    const response = await prisma.evaluation_responses.findFirst({
        where: {
            form_id: Number(form_id),
            target_student_id: Number(student_id),
            ...(period_id ? { semester_id: Number(period_id) } : {})
        },
        orderBy: [
            { submitted_at: 'desc' },
            { id: 'desc' }
        ],
        select: { id: true, submitted_at: true }
    });
    
    return response;
}

export const TeacherStudentsService = {
    async canTeacherAccessStudent(teacher_id: number, student_id: number) {
        if (!teacher_id || !student_id) return false;

        const studentClassroomRecords = await prisma.classroom_students.findMany({
            where: { student_id },
            select: { classroom_id: true },
        });

        const classroomIds = studentClassroomRecords.map(sc => sc.classroom_id);
        if (classroomIds.length === 0) return false;

        const [advisorLink, taughtLink] = await Promise.all([
            (prisma.classroom_advisors as any).findFirst({
                where: { teacher_id, classroom_id: { in: classroomIds } },
                select: { id: true },
            }),
            (prisma.teaching_assignments as any).findFirst({
                where: { teacher_id, classroom_id: { in: classroomIds } },
                select: { id: true },
            }),
        ]);

        return Boolean(advisorLink || taughtLink);
    },

    // Get advisory students from classroom_advisors (homeroom/advisor assignments)
    async getAdvisoryStudents(teacher_id: number, year?: number, semester?: number) {
        // classroom_advisors currently has no year/semester columns.
        // Keep params for API compatibility and future schema changes.
        void year;
        void semester;

        const advisorLinks = await prisma.classroom_advisors.findMany({
            where: { teacher_id },
            select: { classroom_id: true },
            distinct: ['classroom_id'],
        });

        const classroomIds = advisorLinks
            .map(a => a.classroom_id)
            .filter((id): id is number => id !== null);

        if (classroomIds.length === 0) return [];

        const students = await (prisma.students as any).findMany({
            where: { classroom_students: { some: { classroom_id: { in: classroomIds } } } },
            include: {
                name_prefixes: true,
                classroom_students: {
                    where: { classroom_id: { in: classroomIds } },
                    include: { classrooms: { include: { levels: true } } },
                    take: 1
                },
                genders: true,
                student_statuses: true,
            },
            orderBy: { student_code: 'asc' }
        });

        const mapped = (students as any[]).map((s: any) => {
            const currentClassroomStudent = s.classroom_students[0];
            const currentClassroom = currentClassroomStudent?.classrooms;
            return {
                id: s.id,
                student_code: s.student_code,
                prefix: s.name_prefixes?.prefix_name || '',
                first_name: s.first_name,
                last_name: s.last_name,
                gender: s.genders?.name || '',
                class_level: currentClassroom?.levels?.name || '',
                room: currentClassroom?.room_name || '',
                status: s.student_statuses?.status_name || 'active',
                roll_number: currentClassroomStudent?.roll_number,
            };
        });

        return mapped.sort((a, b) => {
            const aNum = a.roll_number != null ? Number(a.roll_number) : 999999;
            const bNum = b.roll_number != null ? Number(b.roll_number) : 999999;
            if (aNum !== bNum) return aNum - bNum;
            return String(a.student_code || '').localeCompare(String(b.student_code || ''));
        });
    },

    // Get student basic profile
    async getStudentProfile(student_id: number) {
        if (!student_id) return null;
        const s = await (prisma.students as any).findUnique({
            where: { id: student_id },
            include: {
                name_prefixes: true,
                classroom_students: {
                    orderBy: { academic_year: 'desc' },
                    include: { classrooms: { include: { levels: true, programs: true } } },
                    take: 1
                },
                genders: true,
                student_statuses: true,
            }
        });
        if (!s) return null;
        const photo_url = await resolveStudentPhotoUrl(s.id);
        const currentClassroom = s.classroom_students[0]?.classrooms;

        return {
            id: s.id,
            student_code: s.student_code,
            prefix: s.name_prefixes?.prefix_name || '',
            first_name: s.first_name,
            last_name: s.last_name,
            gender: s.genders?.name || '',
            class_level: currentClassroom?.levels?.name || '',
            room: currentClassroom?.room_name || '',
            program: currentClassroom?.programs?.name || '',
            status: s.student_statuses?.status_name || '',
            date_of_birth: s.date_of_birth,
            birthday: s.date_of_birth,
            phone: s.phone || '',
            address: s.address || '',
            photo_url,
        };
    },

    // Get full student profile for teacher view (grades, attendance, conduct, etc.)
    async getStudentProfileForTeacher(teacher_id: number, student_id: number) {
        if (!teacher_id || !student_id) return null;
        const canAccess = await this.canTeacherAccessStudent(teacher_id, student_id);
        if (!canAccess) return null;

        // 1. Basic profile
        const profile = await this.getStudentProfile(student_id);
        if (!profile) return null;

        // 2. Enrollment summary — get all subjects enrolled
        const enrollments = await prisma.enrollments.findMany({
            where: { student_id },
            include: {
                teaching_assignments: {
                    include: {
                        subjects: true,
                        teachers: { include: { name_prefixes: true } },
                        semesters: { include: { academic_years: true } },
                    }
                },
                final_grades: true,
                student_scores: {
                    include: { assessment_items: true }
                }
            }
        });

        // 3. Grades summary
        const grades = enrollments.map(e => {
            const ta = e.teaching_assignments;
            let totalScore = 0;
            let maxPossible = 0;
            e.student_scores.forEach(sc => {
                totalScore += Number(sc.score || 0);
                maxPossible += Number(sc.assessment_items?.max_score || 0);
            });

            return {
                subject_code: ta.subjects?.subject_code || '',
                subject_name: ta.subjects?.subject_name || '',
                credit: ta.subjects?.credit ? Number(ta.subjects.credit) : 0,
                total_score: totalScore,
                max_possible: maxPossible,
                percentage: maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) / 100 : 0,
                grade: e.final_grades?.letter_grade || null,
                year: ta.semesters?.academic_years?.year_name || '',
                semester: ta.semesters?.semester_number || 0,
            };
        });

        // 4. Attendance summary
        const enrollmentIds = enrollments.map(e => e.id);
        const attendanceSummary = { present: 0, absent: 0, late: 0, leave: 0, total: 0 };

        if (enrollmentIds.length > 0) {
            const records = await prisma.attendance_records.findMany({
                where: { enrollment_id: { in: enrollmentIds } }
            });

            records.forEach(r => {
                attendanceSummary.total++;
                const status = r.status?.toLowerCase() || '';
                if (status === 'present' || status === 'มา') attendanceSummary.present++;
                else if (status === 'absent' || status === 'ขาด') attendanceSummary.absent++;
                else if (status === 'late' || status === 'สาย') attendanceSummary.late++;
                else if (status === 'leave' || status === 'ลา') attendanceSummary.leave++;
            });
        }

        // 5. Conduct / behavior summary via Raw SQL
        const behaviorRecords: any[] = [];

        let conductScore = 100;
        behaviorRecords.forEach(r => {
            const points = r.points || 0;
            const type = r.type || '';
            if (type === 'REWARD' || type === 'reward' || points > 0) {
                conductScore += Math.abs(points);
            } else {
                conductScore -= Math.abs(points);
            }
        });

        const conductHistory = behaviorRecords.map(r => ({
            date: r.incident_date,
            rule: r.rule_name || '',
            type: r.type || '',
            points: r.points || 0,
            remark: r.remark || '',
        }));

        return {
            profile,
            grades,
            attendance: attendanceSummary,
            conduct: {
                score: conductScore,
                history: conductHistory,
            },
        };
    },

    async getAdvisorEvaluationTemplateForStudent(teacher_id: number, student_id: number, year: number, semester: number, sub_mode: string = 'attributes') {
        try {
            await debugLog(`[Template] Start: teacher=${teacher_id}, student=${student_id}, sub_mode=${sub_mode}`);
            const canAccess = await this.canTeacherAccessStudent(teacher_id, student_id);
            if (!canAccess) {
                await debugLog(`[Template] Access denied: teacher=${teacher_id}, student=${student_id}`);
                throw new Error('Student not found in advisory list');
            }

            const form = await ensureAdvisorEvaluationForm(sub_mode);
            const period_id = await resolveEvaluationPeriodId(year, semester);
            await debugLog(`[Template] Form: ${form?.id}, Period: ${period_id}`);

            const fallbackTopics = sub_mode === 'reading_thinking' ? DEFAULT_READING_THINKING_TOPICS : DEFAULT_ADVISOR_EVAL_TOPICS;
            
            const groupedSections: any[] = [];
            const flatTopics: any[] = [];

            if (form && (form as any).evaluation_questions?.length) {
                console.log(`[getAdvisorEvaluationTemplateForStudent] Using form questions: ${(form as any).evaluation_questions.length}`);
                const sectionMap = new Map<number, any>();
                for (const q of (form as any).evaluation_questions) {
                    const sectId = q.section_id || 1;
                    if (!sectionMap.has(sectId)) {
                        const newSect = {
                            id: sectId,
                            name: q.section_name || 'ทั่วไป',
                            topics: []
                        };
                        sectionMap.set(sectId, newSect);
                        groupedSections.push(newSect);
                    }
                    const topic = {
                        id: q.id,
                        name: q.question_text || '',
                    };
                    sectionMap.get(sectId).topics.push(topic);
                    flatTopics.push(topic);
                }
            } else {
                console.log(`[getAdvisorEvaluationTemplateForStudent] Using fallback topics`);
                const defaultTopics = fallbackTopics.map((name, idx) => ({ id: idx + 1, name }));
                groupedSections.push({
                    id: 1,
                    name: 'หัวข้อประเมิน',
                    topics: defaultTopics
                });
                flatTopics.push(...defaultTopics);
            }

            if (!form) {
                return {
                    form_id: null,
                    period_id: period_id ?? null,
                    sections: groupedSections,
                    topics: flatTopics,
                    current: [],
                    feedback: '',
                    submitted_at: null,
                };
            }

            const latestResponse = await findLatestAdvisorResponseForStudent(form.id, student_id, period_id ?? null);
            console.log(`[getAdvisorEvaluationTemplateForStudent] Latest response: ${latestResponse?.id}`);

            const latestAnswers: any[] = latestResponse
                ? await prisma.$queryRawUnsafe(`
                    SELECT a.*, q.question_text
                    FROM evaluation_answers a
                    LEFT JOIN evaluation_questions q ON a.question_id = q.id
                    WHERE a.response_id = $1
                    ORDER BY a.id ASC
                `, latestResponse.id)
                : [];

            const current = latestAnswers
                .filter(a => a.score_value != null)
                .map((a) => ({
                    name: a.question_text || a.text_value || '',
                    score: a.score_value != null ? Number(a.score_value) : null,
                }));

            const feedback = latestAnswers.find((a) => a.score_value == null && a.text_value)?.text_value || '';

            return {
                form_id: form.id,
                period_id: period_id ?? null,
                sections: groupedSections,
                topics: flatTopics,
                current,
                feedback,
                submitted_at: latestResponse?.submitted_at || null,
            };
        } catch (err: any) {
            await debugLog(`[Template] ERROR: ${err?.message}`);
            if (err?.stack) await debugLog(`[Template] STACK: ${err.stack}`);
            console.error('[getAdvisorEvaluationTemplateForStudent] ERROR:', err);
            throw err;
        }
    },

    async submitAdvisorEvaluationForStudent(payload: {
        teacher_id: number,
        student_id: number,
        year: number,
        semester: number,
        data: { name: string; score: number }[],
        feedback?: string,
        sub_mode?: string
    }) {
        const { teacher_id, student_id, year, semester, data, feedback, sub_mode = 'attributes' } = payload;
        const canAccess = await this.canTeacherAccessStudent(teacher_id, student_id);
        if (!canAccess) throw new Error('Student not found in advisory list');

        const [teacher_user_id] = await Promise.all([
            getTeacherUserId(teacher_id),
        ]);
        if (!teacher_user_id) throw new Error('Teacher user not found');

        const [form, period_id] = await Promise.all([
            ensureAdvisorEvaluationForm(sub_mode),
            resolveEvaluationPeriodId(year, semester),
        ]);

        if (!form) throw new Error('Evaluation form not found');

        const questionByText = new Map<string, number>();
        ((form as any).evaluation_questions || []).forEach((q: any) => {
            const key = String(q.question_text || '').trim().toLowerCase();
            if (key && !questionByText.has(key)) questionByText.set(key, q.id);
        });

        return prisma.$transaction(async (tx) => {
            const newResponse = await tx.evaluation_responses.create({
                data: {
                    form_id: form.id,
                    evaluator_user_id: teacher_user_id,
                    target_student_id: student_id,
                    semester_id: period_id ?? undefined,
                    submitted_at: new Date()
                }
            });
            
            const responseId = newResponse.id;

            // Create answers using Prisma for type safety and correct column names
            if (data && data.length > 0) {
                for (const item of data) {
                    const topicName = String(item?.name || '').trim();
                    const score = Number(item?.score);
                    if (!topicName) continue;

                    const question_id = questionByText.get(topicName.toLowerCase()) ?? null;
                    
                    await tx.evaluation_answers.create({
                        data: {
                            response_id: responseId,
                            question_id: question_id,
                            text_value: question_id ? null : topicName,
                            score_value: Number.isFinite(score) ? score : null
                        }
                    });
                }
            }

            const feedbackText = String(feedback || '').trim();
            if (feedbackText) {
                await tx.evaluation_answers.create({
                    data: {
                        response_id: responseId,
                        text_value: feedbackText,
                        score_value: null
                    }
                });
            }

            return { response_id: responseId };
        });
    },
};
