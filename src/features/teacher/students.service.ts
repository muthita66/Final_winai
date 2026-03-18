import { prisma } from '@/lib/prisma';
import { promises as fs } from 'fs';
import path from 'path';

const STUDENT_PHOTO_REL_DIR = '/uploads/student-photos';
const STUDENT_PHOTO_PUBLIC_DIR = path.join(process.cwd(), 'public', 'uploads', 'student-photos');
const DEFAULT_ADVISOR_EVAL_TOPICS = [
    'ความรับผิดชอบ',
    'วินัยและการตรงต่อเวลา',
    'ความตั้งใจเรียน',
    'การอยู่ร่วมกับผู้อื่น',
    'การปฏิบัติตามกฎระเบียบ',
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

async function ensureAdvisorEvaluationForm() {
    // Standard advisor topics if form creation fails due to missing models in Prisma
    const existing: any[] = await prisma.$queryRawUnsafe(`
        SELECT f.* FROM evaluation_forms f
        JOIN evaluation_form_types t ON f.form_type_id = t.id
        WHERE t.type_code = 'advisor'
        ORDER BY f.id ASC LIMIT 1
    `);
    
    if (existing.length > 0) {
        const questions = await prisma.$queryRawUnsafe(`SELECT * FROM evaluation_questions WHERE form_id = $1 ORDER BY id ASC`, existing[0].id) as any[];
        existing[0].evaluation_questions = questions;
        return existing[0];
    }
    return null;
}

async function findLatestAdvisorResponseForStudent(form_id: number, student_id: number, period_id?: number | null) {
    if (!form_id || !student_id) return null;
    const pid = period_id ? Number(period_id) : null;
    const rows = await prisma.$queryRawUnsafe<Array<{ id: number; submitted_at: Date | null }>>(
        `
        SELECT er.id, er.submitted_at
        FROM public.evaluation_responses er
        WHERE er.form_id = ${Number(form_id)}
          AND er.student_id = ${Number(student_id)}
          ${pid ? `AND er.period_id = ${pid}` : ''}
        ORDER BY er.submitted_at DESC NULLS LAST, er.id DESC
        LIMIT 1
        `
    );
    return rows?.[0] ?? null;
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

    async getAdvisorEvaluationTemplateForStudent(teacher_id: number, student_id: number, year: number, semester: number) {
        const canAccess = await this.canTeacherAccessStudent(teacher_id, student_id);
        if (!canAccess) throw new Error('Student not found in advisory list');

        const user_id = await getStudentUserId(student_id);
        if (!user_id) throw new Error('Student user not found');

        const formResult: any[] = await prisma.$queryRawUnsafe(`
            SELECT f.* FROM evaluation_forms f
            JOIN evaluation_form_types t ON f.form_type_id = t.id
            WHERE t.type_code = 'advisor'
            ORDER BY f.id ASC LIMIT 1
        `);
        const form = formResult[0] || null;
        const period_id = await resolveEvaluationPeriodId(year, semester);

        const topics = ((form as any)?.evaluation_questions?.length
            ? (form as any).evaluation_questions.map((q: any) => ({
                id: q.id,
                name: q.question_text || '',
            }))
            : DEFAULT_ADVISOR_EVAL_TOPICS.map((name, idx) => ({ id: idx + 1, name })))
            .filter((q: any) => q.name);

        if (!form) {
            return {
                form_id: null,
                period_id: period_id ?? null,
                topics,
                current: [],
                feedback: '',
                submitted_at: null,
            };
        }

        const latestResponse = await findLatestAdvisorResponseForStudent(form.id, student_id, period_id ?? null);
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
            .map((a) => ({
                name: a.question_text || a.answer_text || '',
                score: a.score != null ? Number(a.score) : null,
            }))
            .filter((a) => a.name && a.score != null);

        const feedback = latestAnswers
            .find((a) => (a.score == null) && a.answer_text)?.answer_text || '';

        return {
            form_id: form.id,
            period_id: period_id ?? null,
            topics,
            current,
            feedback,
            submitted_at: latestResponse?.submitted_at || null,
        };
    },

    async submitAdvisorEvaluationForStudent(
        teacher_id: number,
        student_id: number,
        year: number,
        semester: number,
        data: { name: string; score: number }[],
        feedback?: string
    ) {
        const canAccess = await this.canTeacherAccessStudent(teacher_id, student_id);
        if (!canAccess) throw new Error('Student not found in advisory list');

        const [user_id, teacher_user_id] = await Promise.all([
            getStudentUserId(student_id),
            getTeacherUserId(teacher_id),
        ]);
        if (!user_id) throw new Error('Student user not found');
        if (!teacher_user_id) throw new Error('Teacher user not found');

        const [form, period_id] = await Promise.all([
            ensureAdvisorEvaluationForm(),
            resolveEvaluationPeriodId(year, semester),
        ]);

        const questionByText = new Map<string, number>();
        ((form as any).evaluation_questions || []).forEach((q: any) => {
            const key = String(q.question_text || '').trim().toLowerCase();
            if (key && !questionByText.has(key)) questionByText.set(key, q.id);
        });

        return prisma.$transaction(async (tx) => {
            // Get next IDs if needed, or rely on serial/autoincrement if it exists
            const responseResult: any[] = await tx.$queryRawUnsafe(`
                INSERT INTO evaluation_responses (form_id, evaluator_user_id, student_id, period_id, submitted_at)
                VALUES ($1, $2, $3, $4, NOW())
                RETURNING id
            `, form.id, teacher_user_id, student_id, period_id ?? null);
            
            const responseId = responseResult[0].id;

            for (const item of data || []) {
                const topicName = String(item?.name || '').trim();
                const score = Number(item?.score);
                if (!topicName) continue;

                const question_id = questionByText.get(topicName.toLowerCase()) ?? null;
                await tx.$executeRawUnsafe(`
                    INSERT INTO evaluation_answers (response_id, question_id, answer_text, score)
                    VALUES ($1, $2, $3, $4)
                `, responseId, question_id, question_id ? null : topicName, Number.isFinite(score) ? score : null);
            }

            const feedbackText = String(feedback || '').trim();
            if (feedbackText) {
                await tx.$executeRawUnsafe(`
                    INSERT INTO evaluation_answers (response_id, answer_text, score)
                    VALUES ($1, $2, null)
                `, responseId, feedbackText);
            }

            return { response_id: responseId };
        });
    },
};
