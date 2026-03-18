import { prisma } from '@/lib/prisma';

function formatTimePart(value: Date | string | null | undefined) {
    if (!value) return '';
    if (value instanceof Date) return value.toISOString().slice(11, 16);
    const raw = String(value);
    const match = raw.match(/(\d{2}:\d{2})/);
    return match ? match[1] : raw;
}

function buildScheduleItem(cs: any, sectionId?: number) {
    const periodName = String(cs?.periods?.period_name || '').trim();
    const start = formatTimePart(cs?.periods?.start_time);
    const end = formatTimePart(cs?.periods?.end_time);
    const exactTimeRange = start && end ? `${start}-${end}` : start || end || '';
    const timeRange = exactTimeRange || periodName;
    const dayOfWeek = String(cs?.day_of_weeks?.day_name_th || cs?.day_of_weeks?.short_name || '').trim();
    const roomName = String(cs?.rooms?.room_name || '').trim();

    return {
        section_id: sectionId,
        day_of_week: dayOfWeek,
        time_range: timeRange,
        room_name: roomName,
        day: dayOfWeek,
        period: timeRange,
        room: roomName,
    };
}

function mapScheduleList(rows: any[] | null | undefined, sectionId?: number) {
    return (rows || []).map((cs) => buildScheduleItem(cs, sectionId));
}

async function resolveSemesterIdFromYearSemester(year?: number, semester?: number) {
    if (year == null || semester == null) return undefined;

    const found = await prisma.semesters.findFirst({
        where: {
            semester_number: Number(semester),
            academic_years: { year_name: String(year) },
        },
        select: { id: true },
        orderBy: { id: 'desc' },
    });

    return found?.id;
}

function resolveSemesterFilter(semesterId?: number) {
    if (!semesterId) return undefined;
    return { semester_id: semesterId };
}

export const RegistrationService = {
    async resolveSemesterId(year?: number, semester?: number) {
        return resolveSemesterIdFromYearSemester(year, semester);
    },

    async resolveClassroomId(class_level?: string, room?: string) {
        const classLevel = String(class_level || '').trim();
        const roomName = String(room || '').trim();
        if (!classLevel || !roomName) return undefined;

        const classroom = await prisma.classrooms.findFirst({
            where: {
                room_name: roomName,
                levels: {
                    name: classLevel,
                },
            },
            select: { id: true },
        });

        return classroom?.id;
    },

    // Search available teaching assignments (subjects to enroll)
    async searchSubjects(keyword: string, year?: number, semester?: number, classroomId?: number) {
        const where: any = {
            status: 'open',
        };

        const hasExplicitTerm = year != null && semester != null;
        const semesterId = await resolveSemesterIdFromYearSemester(year, semester);
        if (hasExplicitTerm && !semesterId) return [];
        if (semesterId) {
            where.semester_id = semesterId;
        }

        if (classroomId) {
            where.classroom_id = classroomId;
        }

        if (keyword) {
            where.subjects = {
                OR: [
                    { subject_code: { contains: keyword, mode: 'insensitive' } },
                    { subject_name: { contains: keyword, mode: 'insensitive' } },
                ]
            };
        }

        const assignments = await prisma.teaching_assignments.findMany({
            where,
            include: {
                subjects: true,
                teachers: { include: { name_prefixes: true } },
                classrooms: { include: { levels: true } },
                semesters: { include: { academic_years: true } },
                enrollments: { select: { id: true } },
                class_schedules: {
                    include: { day_of_weeks: true, periods: true, rooms: true }
                }
            },
            orderBy: { id: 'asc' }
        });

        return assignments.map((ta: any) => {
            const teacher = ta.teachers;
            const teacherName = [teacher?.name_prefixes?.prefix_name, teacher?.first_name, teacher?.last_name]
                .filter(Boolean).join(' ');
            return {
                id: ta.id,
                section_id: ta.id,
                subject_id: ta.subject_id,
                subject_code: ta.subjects?.subject_code || '',
                subject_name: ta.subjects?.subject_name || '',
                credit: ta.subjects?.credit ? Number(ta.subjects.credit) : 0,
                teacher_name: teacherName,
                teacher_code: teacher?.teacher_code || '',
                class_level: ta.classrooms?.levels?.name || '',
                room: ta.classrooms?.room_name || '',
                capacity: ta.capacity || 0,
                enrolled_count: ta.enrollments?.length || 0,
                year: ta.semesters?.academic_years?.year_name || '',
                semester: ta.semesters?.semester_number || 0,
                schedules: mapScheduleList(ta.class_schedules, ta.id),
                status: ta.status || 'open',
            };
        });
    },

    // Browse subjects for a specific classroom
    async browseSubjects(year: number, semester: number, classroomId?: number) {
        const semesterId = await resolveSemesterIdFromYearSemester(year, semester);
        if (!semesterId) return [];

        const where: any = {
            semester_id: semesterId,
            status: 'open',
        };
        if (classroomId) {
            where.classroom_id = classroomId;
        }

        const assignments = await prisma.teaching_assignments.findMany({
            where,
            include: {
                subjects: true,
                teachers: { include: { name_prefixes: true } },
                classrooms: { include: { levels: true } },
                semesters: { include: { academic_years: true } },
                enrollments: { select: { id: true } },
                class_schedules: {
                    include: { day_of_weeks: true, periods: true, rooms: true }
                }
            },
            orderBy: [{ subjects: { subject_code: 'asc' } }, { id: 'asc' }]
        });

        return assignments.map((ta: any) => {
            const teacher = ta.teachers;
            const teacherName = [teacher?.name_prefixes?.prefix_name, teacher?.first_name, teacher?.last_name]
                .filter(Boolean).join(' ');
            const schedules = mapScheduleList(ta.class_schedules, ta.id);

            return {
                id: ta.id,
                section_id: ta.id,
                subject_id: ta.subject_id,
                subject_code: ta.subjects?.subject_code || '',
                subject_name: ta.subjects?.subject_name || '',
                credit: ta.subjects?.credit ? Number(ta.subjects.credit) : 0,
                teacher_name: teacherName,
                teacher_code: teacher?.teacher_code || '',
                class_level: ta.classrooms?.levels?.name || '',
                room: ta.classrooms?.room_name || '',
                capacity: ta.capacity || 0,
                enrolled_count: ta.enrollments?.length || 0,
                year: ta.semesters?.academic_years?.year_name || '',
                semester: ta.semesters?.semester_number || 0,
                schedules,
                status: ta.status || 'open',
            };
        });
    },

    // Add selected subject to cart
    async addToCart(student_id: number, teaching_assignment_id: number) {
        const assignment = await prisma.teaching_assignments.findUnique({
            where: { id: teaching_assignment_id },
            select: {
                id: true,
                subject_id: true,
                semester_id: true,
                status: true,
            },
        });
        if (!assignment) throw new Error('ไม่พบรายวิชาที่เลือก');
        if ((assignment.status || 'open') !== 'open') throw new Error('รายวิชานี้ไม่เปิดลงทะเบียน');

        const exactExisting = await prisma.enrollments.findFirst({
            where: { student_id, teaching_assignment_id },
            select: { id: true, status: true },
        });
        if (exactExisting) {
            const status = String(exactExisting.status || '').toLowerCase();
            if (status === 'cart') throw new Error('มีรายวิชานี้อยู่ในตะกร้าแล้ว');
            throw new Error('ลงทะเบียนรายวิชานี้แล้ว');
        }

        const sameSubjectExisting = await prisma.enrollments.findFirst({
            where: {
                student_id,
                OR: [{ status: 'cart' }, { status: 'enrolled' }, { status: null }],
                teaching_assignments: {
                    subject_id: assignment.subject_id,
                    semester_id: assignment.semester_id,
                    id: { not: teaching_assignment_id },
                },
            },
            include: {
                teaching_assignments: {
                    include: { subjects: true }
                }
            }
        });
        if (sameSubjectExisting) {
            const status = String(sameSubjectExisting.status || '').toLowerCase();
            const subjectName = sameSubjectExisting.teaching_assignments?.subjects?.subject_name || 'รายวิชานี้';
            if (status === 'cart') throw new Error(`มี ${subjectName} อยู่ในตะกร้าแล้ว`);
            throw new Error(`ลงทะเบียน ${subjectName} แล้ว`);
        }

        return prisma.enrollments.create({
            data: {
                student_id,
                teaching_assignment_id,
                status: 'cart',
            }
        });
    },

    async confirmCart(student_id: number, semesterId?: number) {
        const where: any = {
            student_id,
            status: 'cart',
        };
        if (semesterId) {
            where.teaching_assignments = resolveSemesterFilter(semesterId);
        }

        const updated = await prisma.enrollments.updateMany({
            where,
            data: {
                status: 'enrolled',
                enrolled_at: new Date(),
            },
        });

        return { updated_count: updated.count };
    },

    async getCart(student_id: number, semesterId?: number) {
        return this.getEnrollmentList(student_id, semesterId, 'cart');
    },

    // Get enrolled subjects
    async getRegistered(student_id: number, semesterId?: number) {
        return this.getEnrollmentList(student_id, semesterId, 'registered');
    },

    async getEnrollmentList(student_id: number, semesterId?: number, mode: 'cart' | 'registered' = 'registered') {
        const where: any = { student_id };
        if (semesterId) {
            where.teaching_assignments = resolveSemesterFilter(semesterId);
        }
        if (mode === 'cart') {
            where.status = 'cart';
        } else {
            where.NOT = { status: 'cart' };
        }

        const enrollments = await prisma.enrollments.findMany({
            where,
            include: {
                teaching_assignments: {
                    include: {
                        subjects: true,
                        teachers: { include: { name_prefixes: true } },
                        classrooms: { include: { levels: true } },
                        semesters: { include: { academic_years: true } },
                        class_schedules: {
                            include: { day_of_weeks: true, periods: true, rooms: true }
                        }
                    }
                }
            },
            orderBy: { enrolled_at: 'desc' }
        });

        return enrollments.map(e => {
            const ta = e.teaching_assignments;
            const teacher = ta.teachers;
            const teacherName = [teacher?.name_prefixes?.prefix_name, teacher?.first_name, teacher?.last_name]
                .filter(Boolean).join(' ');
            const schedules = mapScheduleList(ta.class_schedules, ta.id);

            return {
                id: e.id,
                enrollment_id: e.id,
                status: e.status || 'enrolled',
                enrolled_at: e.enrolled_at,
                teaching_assignment_id: ta.id,
                section_id: ta.id,
                subject_id: ta.subject_id,
                subject_code: ta.subjects?.subject_code || '',
                subject_name: ta.subjects?.subject_name || '',
                credit: ta.subjects?.credit ? Number(ta.subjects.credit) : 0,
                teacher_name: teacherName,
                class_level: ta.classrooms?.levels?.name || '',
                room: ta.classrooms?.room_name || '',
                year: ta.semesters?.academic_years?.year_name || '',
                semester: ta.semesters?.semester_number || 0,
                schedules,
            };
        });
    },

    // Remove enrollment (cart or registered)
    async removeEnrollment(enrollment_id: number, student_id?: number) {
        if (student_id) {
            const found = await prisma.enrollments.findUnique({
                where: { id: enrollment_id },
                select: { id: true, student_id: true },
            });
            if (!found || found.student_id !== student_id) {
                throw new Error('ไม่พบรายการลงทะเบียน');
            }
        }

        return prisma.enrollments.delete({ where: { id: enrollment_id } });
    },

    // Backward-compatible alias used by /api/student/registration/remove/[id]
    async removeCartItem(enrollment_id: number, student_id?: number) {
        return this.removeEnrollment(enrollment_id, student_id);
    },

    // Get advisor info for student's classroom
    async getAdvisor(student_id: number, year?: number, semester?: number) {
        if (!student_id) return [];

        const latestAssignment = await prisma.classroom_students.findFirst({
            where: { student_id },
            orderBy: { academic_year: 'desc' },
            select: { classroom_id: true }
        });

        if (!latestAssignment) return [];

        let resolvedYear = year;
        let resolvedSemester = semester;
        if (resolvedYear == null || resolvedSemester == null) {
            const activeSemester = await prisma.semesters.findFirst({
                where: { is_active: true },
                include: { academic_years: { select: { year_name: true } } },
                orderBy: { id: 'desc' },
            }) || await prisma.semesters.findFirst({
                include: { academic_years: { select: { year_name: true } } },
                orderBy: { id: 'desc' },
            });

            if (resolvedYear == null) {
                const parsedYear = Number(activeSemester?.academic_years?.year_name);
                resolvedYear = Number.isFinite(parsedYear) ? parsedYear : undefined;
            }
            if (resolvedSemester == null) {
                const parsedSemester = Number(activeSemester?.semester_number);
                resolvedSemester = Number.isFinite(parsedSemester) ? parsedSemester : undefined;
            }
        }

        const advisorRows = await prisma.classroom_advisors.findMany({
            where: { classroom_id: latestAssignment.classroom_id },
            select: {
                id: true,
                teacher_id: true,
                classroom_id: true,
                teachers: {
                    include: { name_prefixes: true }
                }
            },
            orderBy: { id: 'asc' },
        });

        return advisorRows.map((row) => {
            const t = row.teachers;
            const prefix = t?.name_prefixes?.prefix_name || '';
            const firstName = t?.first_name || '';
            const lastName = t?.last_name || '';
            return {
                id: row.id,
                teacher_id: row.teacher_id,
                classroom_id: row.classroom_id,
                teacher_code: t?.teacher_code || '',
                prefix,
                first_name: firstName,
                last_name: lastName,
                name: [prefix, firstName, lastName].filter(Boolean).join(' ').trim(),
                phone: t?.phone || '',
                year: resolvedYear ?? null,
                semester: resolvedSemester ?? null,
            };
        });
    },

    // Get active semester
    async getActiveSemester() {
        const semester = await prisma.semesters.findFirst({
            where: { is_active: true },
            include: { academic_years: true },
            orderBy: { id: 'desc' }
        });
        if (!semester) return null;
        return {
            id: semester.id,
            year: semester.academic_years?.year_name || '',
            semester_number: semester.semester_number,
            academic_year_id: semester.academic_year_id,
        };
    }
};
