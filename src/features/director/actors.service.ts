import { prisma } from '@/lib/prisma';

// All Prisma models EXCEPT those starting with "john"
// Note: john_students, john_subjects, john_teachers have @@ignore so Prisma Client can't access them
// john_subject_sections, john_registrations, john_teacher_homeroom are also excluded per requirement
const ACTOR_DEFINITIONS: {
    name: string;
    label: string;
    group: string;
    groupLabel: string;
}[] = [
        // Core
        { name: 'students', label: 'นักเรียน', group: 'core', groupLabel: 'ข้อมูลหลัก' },
        { name: 'teachers', label: 'ครู/บุคลากร', group: 'core', groupLabel: 'ข้อมูลหลัก' },
        { name: 'users', label: 'ผู้ใช้งาน', group: 'core', groupLabel: 'ข้อมูลหลัก' },
        { name: 'roles', label: 'บทบาท', group: 'core', groupLabel: 'ข้อมูลหลัก' },

        // Academic
        { name: 'academic_years', label: 'ปีการศึกษา', group: 'academic', groupLabel: 'วิชาการ' },
        { name: 'semesters', label: 'ภาคเรียน', group: 'academic', groupLabel: 'วิชาการ' },
        { name: 'subjects', label: 'รายวิชา', group: 'academic', groupLabel: 'วิชาการ' },
        { name: 'teaching_assignments', label: 'การจัดการสอน', group: 'academic', groupLabel: 'วิชาการ' },
        { name: 'enrollments', label: 'การลงทะเบียน', group: 'academic', groupLabel: 'วิชาการ' },
        { name: 'classrooms', label: 'ห้องเรียน', group: 'academic', groupLabel: 'วิชาการ' },
        { name: 'levels', label: 'ระดับชั้น', group: 'academic', groupLabel: 'วิชาการ' },
        { name: 'programs', label: 'แผนการเรียน', group: 'academic', groupLabel: 'วิชาการ' },

        // Scores & Grades
        { name: 'grade_categories', label: 'หมวดคะแนน', group: 'scores', groupLabel: 'คะแนน/เกรด' },
        { name: 'assessment_items', label: 'รายการประเมิน', group: 'scores', groupLabel: 'คะแนน/เกรด' },
        { name: 'student_scores', label: 'คะแนนนักเรียน', group: 'scores', groupLabel: 'คะแนน/เกรด' },
        { name: 'final_grades', label: 'เกรดสุดท้าย', group: 'scores', groupLabel: 'คะแนน/เกรด' },
        { name: 'grade_scales', label: 'เกณฑ์เกรด', group: 'scores', groupLabel: 'คะแนน/เกรด' },
        { name: 'indicators', label: 'ตัวชี้วัด', group: 'scores', groupLabel: 'คะแนน/เกรด' },
        { name: 'assessment_item_indicators', label: 'ตัวชี้วัด-ประเมิน', group: 'scores', groupLabel: 'คะแนน/เกรด' },

        // Attendance
        { name: 'attendance_sessions', label: 'รอบการเช็คชื่อ', group: 'attendance', groupLabel: 'การเข้าเรียน' },
        { name: 'attendance_records', label: 'บันทึกเข้าเรียน', group: 'attendance', groupLabel: 'การเข้าเรียน' },

        // Behavior

        // Schedule
        { name: 'class_schedules', label: 'ตารางเรียน', group: 'schedule', groupLabel: 'ตารางเรียน/ห้อง' },
        { name: 'periods', label: 'คาบเรียน', group: 'schedule', groupLabel: 'ตารางเรียน/ห้อง' },
        { name: 'day_of_weeks', label: 'วันในสัปดาห์', group: 'schedule', groupLabel: 'ตารางเรียน/ห้อง' },
        { name: 'rooms', label: 'ห้อง', group: 'schedule', groupLabel: 'ตารางเรียน/ห้อง' },
        { name: 'buildings', label: 'อาคาร', group: 'schedule', groupLabel: 'ตารางเรียน/ห้อง' },

        // Events & Activities
        { name: 'events', label: 'กิจกรรม/อีเวนท์', group: 'events', groupLabel: 'กิจกรรม' },
        { name: 'event_participants', label: 'ผู้เข้าร่วม', group: 'events', groupLabel: 'กิจกรรม' },
        { name: 'event_targets', label: 'กลุ่มเป้าหมาย', group: 'events', groupLabel: 'กิจกรรม' },
        { name: 'activity_evaluation_link', label: 'เชื่อมกิจกรรม-ประเมิน', group: 'events', groupLabel: 'กิจกรรม' },

        // Evaluation
        { name: 'evaluation_forms', label: 'แบบประเมิน', group: 'evaluation', groupLabel: 'การประเมิน' },
        { name: 'evaluation_questions', label: 'คำถามประเมิน', group: 'evaluation', groupLabel: 'การประเมิน' },
        { name: 'evaluation_answers', label: 'คำตอบประเมิน', group: 'evaluation', groupLabel: 'การประเมิน' },
        { name: 'evaluation_responses', label: 'การตอบประเมิน', group: 'evaluation', groupLabel: 'การประเมิน' },
        { name: 'evaluation_types', label: 'ประเภทการประเมิน', group: 'evaluation', groupLabel: 'การประเมิน' },

        // Master Data
        { name: 'genders', label: 'เพศ', group: 'master', groupLabel: 'ข้อมูลพื้นฐาน' },
        { name: 'name_prefixes', label: 'คำนำหน้า', group: 'master', groupLabel: 'ข้อมูลพื้นฐาน' },
        { name: 'departments', label: 'แผนก', group: 'master', groupLabel: 'ข้อมูลพื้นฐาน' },
        { name: 'employment_types', label: 'ประเภทการจ้าง', group: 'master', groupLabel: 'ข้อมูลพื้นฐาน' },
        { name: 'student_statuses', label: 'สถานะนักเรียน', group: 'master', groupLabel: 'ข้อมูลพื้นฐาน' },
        { name: 'subject_categories', label: 'หมวดวิชา', group: 'master', groupLabel: 'ข้อมูลพื้นฐาน' },
        { name: 'teacher_positions', label: 'ตำแหน่งครู', group: 'master', groupLabel: 'ข้อมูลพื้นฐาน' },
        { name: 'learning_subject_groups', label: 'กลุ่มสาระ', group: 'master', groupLabel: 'ข้อมูลพื้นฐาน' },
        { name: 'classroom_advisors', label: 'ครูที่ปรึกษา', group: 'master', groupLabel: 'ข้อมูลพื้นฐาน' },

        // System
        { name: 'audit_logs', label: 'ล็อกระบบ', group: 'system', groupLabel: 'ระบบ' },
        { name: 'notifications', label: 'การแจ้งเตือน', group: 'system', groupLabel: 'ระบบ' },
    ];

// Map model name to its prisma delegate accessor
const prismaAccessors: Record<string, any> = {};
ACTOR_DEFINITIONS.forEach(def => {
    prismaAccessors[def.name] = (prisma as any)[def.name];
});

export const ActorsService = {
    /** Get list of all actors with their record counts */
    async getAllActors() {
        const results = await Promise.all(
            ACTOR_DEFINITIONS.map(async (def) => {
                const accessor = prismaAccessors[def.name];
                if (!accessor) return { ...def, count: 0 };
                try {
                    let count;
                    // Special handling for evaluation_responses count due to missing user_id column
                    if (def.name === 'evaluation_responses') {
                        const evalCountResult = await prisma.$queryRawUnsafe<any[]>(
                            `SELECT COUNT(*)::int as count FROM evaluation_responses`
                        );
                        count = evalCountResult[0]?.count || 0;
                    } else {
                        count = await accessor.count();
                    }
                    return { ...def, count };
                } catch {
                    return { ...def, count: 0 };
                }
            })
        );
        return results;
    },

    /** Get data rows for a specific actor table (max 100 rows) */
    async getActorData(name: string) {
        const def = ACTOR_DEFINITIONS.find((d) => d.name === name);
        if (!def) throw new Error(`Actor "${name}" not found`);

        const accessor = prismaAccessors[name];
        if (!accessor) throw new Error(`No Prisma accessor for "${name}"`);

        try {
            // Special handling for evaluation_responses due to missing user_id column
            if (name === 'evaluation_responses') {
                const data = await prisma.$queryRawUnsafe<any[]>(
                    `SELECT id, form_id, evaluator_user_id, submitted_at, semester_id, target_student_id, target_teacher_id, target_subject_id
                     FROM evaluation_responses ORDER BY id ASC LIMIT 100`
                );
                return { ...def, data };
            }

            const data = await accessor.findMany({ take: 100, orderBy: { id: 'asc' } });
            return {
                name: def.name,
                label: def.label,
                group: def.group,
                groupLabel: def.groupLabel,
                data,
            };
        } catch (error: any) {
            console.error(`Error fetching actor data for ${name}:`, error);
            return { ...def, data: [], error: error.message };
        }
    },
};
