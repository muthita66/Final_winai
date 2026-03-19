import { prisma } from '@/lib/prisma';

export const ActivitiesService = {
    async getAllActivities() {
        const events = await prisma.events.findMany({
            orderBy: { start_datetime: 'desc' },
            include: {
                users: { select: { username: true } },
                event_participants: { select: { id: true } },
            }
        });

        return events.map(e => ({
            id: e.id,
            name: e.title, // Map title to name
            description: e.description || '',
            date: e.start_datetime ? e.start_datetime.toISOString().split('T')[0] : null, // Map start_datetime to date
            start_date: e.start_datetime,
            end_date: e.end_datetime,
            is_all_day: e.is_all_day || false,
            location: e.location || '',
            visibility: e.visibility,
            created_by: e.users?.username || '',
            participant_count: e.event_participants?.length || 0,
        }));
    },

    async getStudentActivities(student_id: number) {
        if (!student_id) return [];

        // Get user_id from student
        const student = await prisma.students.findUnique({
            where: { id: student_id },
            select: { user_id: true }
        });
        if (!student) return [];

        const participations = await prisma.event_participants.findMany({
            where: { user_id: student.user_id },
            include: {
                events: true
            },
            orderBy: { registered_at: 'desc' }
        });

        return participations.map(p => ({
            id: p.events.id,
            title: p.events.title,
            description: p.events.description || '',
            start_date: p.events.start_datetime,
            end_date: p.events.end_datetime,
            location: p.events.location || '',
            status: p.status || 'registered',
        }));
    },

    async getStudentActivityEvaluations(student_id: number, year: number, semester: number) {
        const student = await prisma.students.findUnique({
            where: { id: student_id },
            select: { user_id: true }
        });
        if (!student) return [];

        const semesterObj = await prisma.semesters.findFirst({
            where: {
                semester_number: semester,
                academic_years: { year_name: String(year) },
            },
            include: { academic_years: true }
        });
        if (!semesterObj) return [];

        const startDate = semesterObj.start_date || semesterObj.academic_years.start_date;
        const endDate = semesterObj.end_date || semesterObj.academic_years.end_date;

        // Fetch activities using raw SQL to handle potential schema sync issues
        const participations: any[] = await prisma.$queryRawUnsafe(`
            SELECT 
                e.id, e.title, e.start_datetime as date, e.location,
                al.form_id, ef.form_name,
                EXISTS(
                    SELECT 1 FROM evaluation_responses er 
                    WHERE er.evaluator_user_id = $1 
                    AND er.target_activity_id = e.id 
                ) as is_evaluated
            FROM event_participants ep
            JOIN events e ON e.id = ep.event_id
            LEFT JOIN activity_evaluation_link al ON al.event_id = e.id
            LEFT JOIN evaluation_forms ef ON ef.id = al.form_id
            WHERE ep.user_id = $1
            ORDER BY e.start_datetime DESC
        `, student.user_id);

        return participations.map(p => ({
            id: p.id,
            title: p.title,
            date: p.date,
            location: p.location,
            has_evaluation: !!p.form_id,
            form_id: p.form_id || null,
            form_name: p.form_name || null,
            is_evaluated: p.is_evaluated,
        }));
    },

    async submitActivityEvaluation(
        student_id: number,
        activity_id: number,
        year: number,
        semester: number,
        data: { name: string; value: number | string }[],
        feedback?: string
    ) {
        const user_id = await (prisma.students as any).findUnique({
            where: { id: student_id },
            select: { user_id: true }
        }).then((s: any) => s?.user_id);
        
        if (!user_id) throw new Error('Student not found');

        const semester_id = await prisma.semesters.findFirst({
            where: {
                semester_number: semester,
                academic_years: { year_name: String(year) },
            }
        }).then(s => s?.id);
        
        if (!semester_id) throw new Error('Semester not found');

        const formRows: any[] = await prisma.$queryRawUnsafe(`
            SELECT form_id FROM activity_evaluation_link WHERE event_id = $1 LIMIT 1
        `, activity_id);
        
        if (formRows.length === 0) throw new Error('No evaluation form linked to this activity');
        const form_id = formRows[0].form_id;

        // Fetch questions
        const questions: any[] = await prisma.$queryRawUnsafe(`
            SELECT id, question_text, question_type_id FROM evaluation_questions 
            WHERE section_id IN (SELECT id FROM evaluation_sections WHERE form_id = $1)
        `, form_id);

        const questionMap = new Map<string, any>();
        questions.forEach(q => {
            questionMap.set(String(q.question_text || '').trim().toLowerCase(), q);
        });

        return prisma.$transaction(async (tx: any) => {
            const res = await tx.$queryRawUnsafe(`
                INSERT INTO evaluation_responses (form_id, evaluator_user_id, semester_id, target_activity_id, status, submitted_at)
                VALUES ($1, $2, $3, $4, 'COMPLETED', NOW())
                RETURNING id
            `, form_id, user_id, semester_id, activity_id);
            
            const responseId = (res as any)[0].id;

            for (const item of data) {
                const q = questionMap.get(String(item.name || '').trim().toLowerCase());
                if (q) {
                    const isText = q.question_type_id === 2;
                    const score = !isText && typeof item.value === 'number' ? item.value : null;
                    const text = isText || typeof item.value === 'string' ? String(item.value) : null;
                    
                    await tx.$executeRawUnsafe(`
                        INSERT INTO evaluation_answers (response_id, question_id, score_value, text_value)
                        VALUES ($1, $2, $3, $4)
                    `, responseId, q.id, score, text);
                }
            }

            if (feedback?.trim()) {
                await tx.$executeRawUnsafe(`
                    INSERT INTO evaluation_answers (response_id, text_value)
                    VALUES ($1, $2)
                `, responseId, feedback.trim());
            }

            return { success: true, id: responseId };
        });
    }
};
