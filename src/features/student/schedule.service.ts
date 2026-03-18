import { prisma } from '@/lib/prisma';

export const ScheduleService = {
    async getClassSchedule(student_id: number, year?: number, semester?: number) {
        if (!student_id) return [];

        // Build filter for enrollments
        const enrollmentWhere: any = {
            student_id,
            NOT: { status: 'cart' },
        };

        if (year || semester) {
            enrollmentWhere.teaching_assignments = {
                semesters: {
                    ...(year ? { academic_years: { year_name: String(year) } } : {}),
                    ...(semester ? { semester_number: semester } : {}),
                }
            };
        }

        const enrollments = await prisma.enrollments.findMany({
            where: enrollmentWhere,
            include: {
                teaching_assignments: {
                    include: {
                        subjects: true,
                        teachers: {
                            include: { name_prefixes: true }
                        },
                        classrooms: {
                            include: { levels: true }
                        },
                        semesters: {
                            include: { academic_years: true }
                        },
                        class_schedules: {
                            include: {
                                day_of_weeks: true,
                                periods: true,
                                rooms: true,
                            }
                        }
                    }
                }
            }
        });

        // Flatten into schedule entries
        const scheduleItems: any[] = [];
        for (const enrollment of enrollments) {
            const ta = enrollment.teaching_assignments;
            const subject = ta.subjects;
            const teacher = ta.teachers;
            const teacherPrefix = teacher?.name_prefixes?.prefix_name || '';
            const teacherName = [teacherPrefix, teacher?.first_name, teacher?.last_name].filter(Boolean).join(' ');

            for (const cs of ta.class_schedules) {
                scheduleItems.push({
                    id: cs.id,
                    enrollment_id: enrollment.id,
                    subject_code: subject?.subject_code || '',
                    subject_name: subject?.subject_name || '',
                    credit: subject?.credit ? Number(subject.credit) : 0,
                    teacher_name: teacherName,
                    teacher_code: teacher?.teacher_code || '',
                    day: cs.day_of_weeks?.day_name_th || '',
                    day_en: cs.day_of_weeks?.day_name_en || '',
                    day_short: cs.day_of_weeks?.short_name || '',
                    day_id: cs.day_id || 0,
                    period: cs.periods?.period_name || '',
                    start_time: cs.periods?.start_time,
                    end_time: cs.periods?.end_time,
                    room_name: cs.rooms?.room_name || '',
                    room: cs.rooms?.room_name || '',
                    class_level: (ta.classrooms as any)?.levels?.name || '',
                    classroom: ta.classrooms?.room_name || '',
                    year: ta.semesters?.academic_years?.year_name || '',
                    semester: ta.semesters?.semester_number || 0,
                });
            }
        }

        // Sort by day_id then start_time
        scheduleItems.sort((a, b) => {
            if (a.day_id !== b.day_id) return a.day_id - b.day_id;
            if (a.start_time && b.start_time) return a.start_time < b.start_time ? -1 : 1;
            return 0;
        });

        return scheduleItems;
    },

    async getExamSchedule(student_id: number, year?: number, semester?: number) {
        // No exam_schedule table in presentATOM — return empty
        return [];
    }
};
