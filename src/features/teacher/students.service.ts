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
        // Resolve semester_id from semesters table directly
        const semRow: any[] = await prisma.$queryRawUnsafe(`
            SELECT s.id FROM semesters s
            INNER JOIN academic_years ay ON ay.id = s.academic_year_id
            WHERE ay.year_name = $1 AND s.semester_number = $2
            LIMIT 1
        `, String(year), semester);
        
        const periodId = semRow[0]?.id ? Number(semRow[0].id) : null;
        await debugLog(`[resolveEvaluationPeriodId] Resolved semester_id: ${periodId}`);
        return periodId;
    } catch (err: any) { 
        await debugLog(`[resolveEvaluationPeriodId] ERROR: ${err?.message}`);
        return null; 
    }
}

async function ensureAdvisorEvaluationForm(sub_mode: string = 'attributes') {
    try {
        const formName = sub_mode === 'reading_thinking' ? 'แบบประเมินการอ่านคิดวิเคราะห์' : 'แบบประเมินคุณลักษณะอันพึงประสงค์';
        await debugLog(`[ensureForm] Searching via Raw SQL for: ${formName}`);

        // For attributes mode, try fetching directly from evaluation_questions WHERE section_id = 1
        if (sub_mode === 'attributes') {
            const sectionOneRows: any[] = await prisma.$queryRawUnsafe(`
                SELECT 
                    eq.id as question_id, eq.question_text, eq.order_number as question_order,
                    es.id as section_id, es.section_name, es.order_number as section_order,
                    ef.id as form_id, ef.form_name
                FROM evaluation_questions eq
                JOIN evaluation_sections es ON eq.section_id = es.id
                LEFT JOIN evaluation_forms ef ON es.form_id = ef.id
                WHERE eq.section_id = 1
                ORDER BY eq.order_number ASC
            `);

            if (sectionOneRows.length > 0) {
                await debugLog(`[ensureForm] Found ${sectionOneRows.length} questions directly from section_id=1`);
                const formId = sectionOneRows[0].form_id ?? null;
                const formObj = {
                    id: formId,
                    form_name: sectionOneRows[0].form_name || formName,
                    evaluation_sections: [] as any[],
                    evaluation_questions: [] as any[]
                };

                const sectionsMap = new Map<number, any>();
                sectionOneRows.forEach(row => {
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
                    sectionsMap.get(row.section_id)?.evaluation_questions.push(question);
                });

                return formObj;
            }
            await debugLog(`[ensureForm] No questions found with section_id=1, falling back to form name lookup`);
        }

        // For reading_thinking mode, try fetching directly from evaluation_questions WHERE section_id = 9
        if (sub_mode === 'reading_thinking') {
            const sectionNineRows: any[] = await prisma.$queryRawUnsafe(`
                SELECT 
                    eq.id as question_id, eq.question_text, eq.order_number as question_order,
                    es.id as section_id, es.section_name, es.order_number as section_order,
                    ef.id as form_id, ef.form_name
                FROM evaluation_questions eq
                JOIN evaluation_sections es ON eq.section_id = es.id
                LEFT JOIN evaluation_forms ef ON es.form_id = ef.id
                WHERE eq.section_id = 9
                ORDER BY eq.order_number ASC
            `);

            if (sectionNineRows.length > 0) {
                await debugLog(`[ensureForm] Found ${sectionNineRows.length} questions directly from section_id=9`);
                const formId = sectionNineRows[0].form_id ?? null;
                const formObj = {
                    id: formId,
                    form_name: sectionNineRows[0].form_name || formName,
                    evaluation_sections: [] as any[],
                    evaluation_questions: [] as any[]
                };

                const sectionsMap = new Map<number, any>();
                sectionNineRows.forEach(row => {
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
                    sectionsMap.get(row.section_id)?.evaluation_questions.push(question);
                });

                return formObj;
            }
            await debugLog(`[ensureForm] No questions found with section_id=9, falling back to form name lookup`);
        }
        
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

async function findLatestAdvisorResponseForStudent(form_id: number | null, student_id: number, period_id?: number | null) {
    if (!student_id) return null;
    
    // We try to match both period_id maps to semester_id in evaluation_responses conceptually,
    // though the DB schema uses target_student_id and semester_id instead of student_id and period_id.
    const response = await prisma.evaluation_responses.findFirst({
        where: {
            ...(form_id ? { form_id: Number(form_id) } : {}),
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
    async getAdvisoryStudents(teacher_id: number, year?: number, semester?: number, sub_mode: string = 'attributes') {
        const advisorLinks = await prisma.classroom_advisors.findMany({
            where: { teacher_id },
            select: { classroom_id: true },
            distinct: ['classroom_id'],
        });

        const classroomIds = advisorLinks
            .map(a => a.classroom_id)
            .filter((id): id is number => id !== null);

        if (classroomIds.length === 0) return [];

        // 1. Resolve period and form to check evaluation status
        const [periodId, form] = await Promise.all([
            resolveEvaluationPeriodId(year, semester),
            ensureAdvisorEvaluationForm(sub_mode)
        ]);
        const formId = form?.id;

        // 2. Fetch students
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

        // 3. Check for existing evaluations
        const evaluatedStudentIds = new Set<number>();

        if (sub_mode === 'student_results') {
            // In student_results mode: check if each STUDENT has evaluated THIS TEACHER
            // (evaluator_user_id = student.user_id, target_teacher_id = teacher_id)
            // Resolve the advisor evaluation form for target_type = 'advisor'
            const advisorFormRows: any[] = await prisma.$queryRawUnsafe(`
                SELECT ef.id FROM evaluation_forms ef
                JOIN evaluation_categories ec ON ec.id = ef.category_id
                WHERE LOWER(COALESCE(ec.target_type,'')) = 'advisor'
                ORDER BY ef.id ASC LIMIT 1
            `);
            const advisorFormId = advisorFormRows[0]?.id ? Number(advisorFormRows[0].id) : null;

            // Resolve semester_id
            let targetSemesterId: number | null = null;
            if (year && semester) {
                const semRow: any[] = await prisma.$queryRawUnsafe(`
                    SELECT s.id FROM semesters s
                    INNER JOIN academic_years ay ON ay.id = s.academic_year_id
                    WHERE ay.year_name = $1 AND s.semester_number = $2
                    LIMIT 1
                `, String(year), semester);
                targetSemesterId = semRow[0]?.id ? Number(semRow[0].id) : null;
            }

            // Get all students' user IDs in one query
            const studentIds = (students as any[]).map((s: any) => s.id).filter(Boolean);
            if (studentIds.length > 0) {
                const userIdRows: any[] = await prisma.$queryRawUnsafe(`
                    SELECT id as student_id, user_id FROM students
                    WHERE id IN (${studentIds.join(',')}) AND user_id IS NOT NULL
                `);
                const studentToUser = new Map<number, number>();
                userIdRows.forEach(r => {
                    if (r.student_id && r.user_id) studentToUser.set(Number(r.student_id), Number(r.user_id));
                });

                const userIds = Array.from(studentToUser.values());
                if (userIds.length > 0) {
                    const evalRows: any[] = await prisma.$queryRawUnsafe(`
                        SELECT evaluator_user_id FROM evaluation_responses
                        WHERE target_teacher_id = ${Number(teacher_id)}
                        ${advisorFormId ? `AND form_id = ${advisorFormId}` : ''}
                        ${targetSemesterId ? `AND semester_id = ${targetSemesterId}` : ''}
                        AND evaluator_user_id IN (${userIds.join(',')})
                    `);
                    const evaluatedUserIds = new Set(evalRows.map(r => Number(r.evaluator_user_id)));

                    // Map back from user_id to student_id
                    studentToUser.forEach((userId, studentId) => {
                        if (evaluatedUserIds.has(userId)) evaluatedStudentIds.add(studentId);
                    });
                }
            }
        } else if (formId) {
            // Default: teacher evaluating students (teacher as evaluator, student as target)
            const responses = await prisma.evaluation_responses.findMany({
                where: {
                    evaluator_user_id: teacher_id,
                    form_id: formId,
                    semester_id: periodId,
                    target_student_id: { not: null }
                },
                select: { target_student_id: true }
            });
            responses.forEach(r => {
                if (r.target_student_id) evaluatedStudentIds.add(r.target_student_id);
            });
        }


        const mapped = (students as any[]).map((s: any) => {
            const currentClassroomStudent = s.classroom_students[0];
            const currentClassroom = currentClassroomStudent?.classrooms;
            const prefix = s.name_prefixes?.prefix_name || '';
            const fullName = `${prefix}${s.first_name} ${s.last_name}`.trim();

            return {
                id: s.id,
                student_code: s.student_code,
                prefix: prefix,
                first_name: s.first_name,
                last_name: s.last_name,
                name: fullName,
                gender: s.genders?.name || '',
                class_level: currentClassroom?.levels?.name || '',
                room: currentClassroom?.room_name || '',
                status: s.student_statuses?.status_name || 'active',
                roll_number: currentClassroomStudent?.roll_number,
                evaluated: evaluatedStudentIds.has(s.id),
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
            parent_name: s.parent_name || '',
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

            const scaleTypeID = sub_mode === 'attributes' ? 2 : 5;
            await debugLog(`[Template] Selected scaleTypeID: ${scaleTypeID}`);

            // Fetch scale options from database
            let scaleOptions: { label: string; value: number }[] = [];
            try {
                const scaleItems: any[] = await prisma.$queryRawUnsafe(`
                    SELECT label, score_value, order_number
                    FROM evaluation_scale_items
                    WHERE scale_type_id = $1
                    ORDER BY score_value DESC
                `, scaleTypeID);
                scaleOptions = scaleItems.map(item => ({
                    label: item.label || String(item.score_value),
                    value: Number(item.score_value),
                }));
            } catch (e) {
                // Determine fallback based on scaleTypeID
                if (scaleTypeID === 2) {
                    scaleOptions = [
                        { label: 'ดีเยี่ยม', value: 3 },
                        { label: 'ดี', value: 2 },
                        { label: 'ผ่าน', value: 1 },
                        { label: 'ไม่ผ่าน', value: 0 },
                    ];
                } else {
                    scaleOptions = [
                        { label: 'ดีมาก', value: 3 },
                        { label: 'ดี', value: 2 },
                        { label: 'พอใช้', value: 1 },
                        { label: 'ปรับปรุง', value: 0 },
                    ];
                }
            }
            if (scaleOptions.length === 0) {
                if (scaleTypeID === 2) {
                    scaleOptions = [
                        { label: 'ดีเยี่ยม', value: 3 },
                        { label: 'ดี', value: 2 },
                        { label: 'ผ่าน', value: 1 },
                        { label: 'ไม่ผ่าน', value: 0 },
                    ];
                } else {
                    scaleOptions = [
                        { label: 'ดีมาก', value: 3 },
                        { label: 'ดี', value: 2 },
                        { label: 'พอใช้', value: 1 },
                        { label: 'ปรับปรุง', value: 0 },
                    ];
                }
            }
            await debugLog(`[Template] Scale options count: ${scaleOptions.length}`);

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
                    scale_options: scaleOptions,
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
                scale_options: scaleOptions,
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
        await debugLog(`[Submit] Start: teacher=${teacher_id}, student=${student_id}, data_len=${data?.length}, sub_mode=${sub_mode}`);
        
        try {
            const canAccess = await this.canTeacherAccessStudent(teacher_id, student_id);
            if (!canAccess) {
                await debugLog(`[Submit] Access denied`);
                throw new Error('Student not found in advisory list');
            }

            const teacher_user_id = await getTeacherUserId(teacher_id);
            if (!teacher_user_id) {
                await debugLog(`[Submit] Teacher user not found for ID: ${teacher_id}`);
                throw new Error('Teacher user not found');
            }

            const [form, period_id] = await Promise.all([
                ensureAdvisorEvaluationForm(sub_mode),
                resolveEvaluationPeriodId(year, semester),
            ]);

            if (!form) {
                await debugLog(`[Submit] Form not found for sub_mode: ${sub_mode}`);
                throw new Error('Evaluation form not found');
            }

            const questionByText = new Map<string, number>();
            ((form as any).evaluation_questions || []).forEach((q: any) => {
                const key = String(q.question_text || '').trim().toLowerCase();
                if (key && !questionByText.has(key)) questionByText.set(key, q.id);
            });

            return await prisma.$transaction(async (tx) => {
                const responseResult = await tx.$queryRawUnsafe<any[]>(`
                    INSERT INTO evaluation_responses (form_id, evaluator_user_id, target_student_id, semester_id, submitted_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    RETURNING id
                `, form?.id ? Number(form.id) : null, teacher_user_id, student_id, period_id ? Number(period_id) : null);
                
                await debugLog(`[Submit] Response result: ${JSON.stringify(responseResult)}`);
                const responseId = responseResult[0]?.id;
                if (!responseId) {
                    await debugLog(`[Submit] No ID returned from evaluation_responses insert`);
                    throw new Error('Failed to create evaluation_responses');
                }

                if (data && data.length > 0) {
                    for (const item of data) {
                        const topicName = String(item?.name || '').trim();
                        const score = Number(item?.score);
                        if (!topicName) continue;

                        const question_id = questionByText.get(topicName.toLowerCase()) ?? null;
                        
                        await tx.$executeRawUnsafe(`
                            INSERT INTO evaluation_answers (response_id, question_id, text_value, score_value)
                            VALUES ($1, $2, $3, $4)
                        `, responseId, question_id, question_id ? null : topicName, Number.isFinite(score) ? score : null);
                    }
                }

                const feedbackText = String(feedback || '').trim();
                if (feedbackText) {
                    await tx.$executeRawUnsafe(`
                        INSERT INTO evaluation_answers (response_id, question_id, text_value, score_value)
                        VALUES ($1, null, $2, null)
                    `, responseId, feedbackText);
                }

                await debugLog(`[Submit] SUCCESS: responseId=${responseId}`);
                return { response_id: responseId };
            });
        } catch (err: any) {
            await debugLog(`[Submit] ERROR: ${err?.message}`);
            if (err?.stack) await debugLog(`[Submit] STACK: ${err.stack}`);
            throw err;
        }
    },
};
