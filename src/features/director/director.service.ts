import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

function formatTimePart(value: Date | null | undefined) {
    if (!value) return '';
    const d = new Date(value);
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

function roomOnlyLabel(classLevel: string, roomName: string) {
    const level = String(classLevel || '').trim();
    const room = String(roomName || '').trim();
    if (!room) return '';
    if (level && room.startsWith(`${level}/`)) return room.slice(level.length + 1).trim();
    const slash = room.lastIndexOf('/');
    return slash >= 0 ? room.slice(slash + 1).trim() : room;
}

async function resolveAdvisorTerm(year?: number, semester?: number) {
    const normalizedYear = Number(year);
    const normalizedSemester = Number(semester);

    if (Number.isFinite(normalizedYear) && Number.isFinite(normalizedSemester)) {
        return { year: normalizedYear, semester: normalizedSemester };
    }

    const current = await prisma.semesters.findFirst({
        where: { is_active: true },
        include: { academic_years: { select: { year_name: true } } },
        orderBy: { id: 'desc' },
    }) || await prisma.semesters.findFirst({
        include: { academic_years: { select: { year_name: true } } },
        orderBy: { id: 'desc' },
    });

    const fallbackYear = new Date().getFullYear() + 543;
    return {
        year: Number(current?.academic_years?.year_name) || fallbackYear,
        semester: Number(current?.semester_number) || 1,
    };
}

function mapAdvisorRecord(
    row: any,
    term: { year: number; semester: number }
) {
    return {
        id: row.id,
        teacher_id: row.teacher_id,
        classroom_id: row.classroom_id,
        class_level: String((row.classrooms as any)?.levels?.name || ''),
        room: roomOnlyLabel(
            String((row.classrooms as any)?.levels?.name || ''),
            String(row.classrooms?.room_name || '')
        ),
        year: term.year,
        semester: term.semester,
        teachers: row.teachers || null,
    };
}

function parseTimeRange(value: unknown) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const m = raw.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!m) return null;
    return { start: m[1], end: m[2] };
}

async function resolveSemesterIdFromPayload(data: any) {
    if (data?.semester_id) {
        const semesterId = Number(data.semester_id);
        if (Number.isFinite(semesterId) && semesterId > 0) return semesterId;
    }

    const year = data?.year != null ? Number(data.year) : NaN;
    const semester = data?.semester != null ? Number(data.semester) : NaN;
    if (!Number.isFinite(year) || !Number.isFinite(semester)) {
        throw new Error('กรุณาระบุปีการศึกษาและภาคเรียน');
    }

    const found = await prisma.semesters.findFirst({
        where: {
            semester_number: semester,
            academic_years: { year_name: String(year) },
        },
        select: { id: true },
        orderBy: { id: 'desc' },
    });

    if (!found) throw new Error(`ไม่พบภาคเรียน ปี ${year} ภาค ${semester}`);
    return found.id;
}

async function resolveClassroomIdFromPayload(data: any) {
    if (data?.classroom_id !== undefined && data?.classroom_id !== null && String(data.classroom_id) !== '') {
        const classroomId = Number(data.classroom_id);
        if (Number.isFinite(classroomId) && classroomId > 0) return classroomId;
    }

    const classLevel = String(data?.class_level || '').trim();
    const classroomName = String(data?.classroom || '').trim();
    if (!classLevel && !classroomName) return null;
    if (!classLevel || !classroomName) return null;

    const classrooms = await prisma.classrooms.findMany({
        include: {
            levels: { select: { name: true } },
        },
    });

    const classroom = classrooms.find((c) => {
        const levelName = String(c.levels?.name || '');
        const fullRoomName = String(c.room_name || '');
        const shortRoomName = roomOnlyLabel(levelName, fullRoomName);
        if (classLevel && levelName !== classLevel) return false;
        return fullRoomName === classroomName || shortRoomName === classroomName;
    }) || classrooms.find((c) => String(c.room_name || '') === classroomName);

    if (!classroom) {
        throw new Error(`ไม่พบห้องเรียน ${classLevel}/${classroomName}`);
    }

    return classroom.id;
}

async function upsertSingleClassSchedule(teachingAssignmentId: number, data: any) {
    const dayName = String(data?.day_of_week || '').trim();
    const range = parseTimeRange(data?.time_range);

    if (!dayName || !range) return;

    const [day, periods] = await Promise.all([
        prisma.day_of_weeks.findFirst({
            where: {
                OR: [
                    { day_name_th: dayName },
                    { day_name_en: dayName },
                    { short_name: dayName },
                ],
            },
            select: { id: true },
        }),
        prisma.periods.findMany({ select: { id: true, start_time: true, end_time: true } }),
    ]);

    if (!day) return;

    const period = periods.find((p) => {
        const start = formatTimePart(p.start_time);
        const end = formatTimePart(p.end_time);
        return start === range.start && end === range.end;
    });

    if (!period) return;

    const existing = await prisma.class_schedules.findFirst({
        where: { teaching_assignment_id: teachingAssignmentId },
        orderBy: { id: 'asc' },
        select: { id: true },
    });

    if (existing) {
        await prisma.class_schedules.update({
            where: { id: existing.id },
            data: {
                day_id: day.id,
                period_id: period.id,
            },
        });
        return;
    }

    await prisma.class_schedules.create({
        data: {
            teaching_assignment_id: teachingAssignmentId,
            day_id: day.id,
            period_id: period.id,
        },
    });
}

export const DirectorService = {
    // --- Dashboard Summary ---
    async getSummary() {
        const students = await prisma.students.count();
        const teachers = await prisma.teachers.count();
        const subjects = await prisma.subjects.count();
        const activities = await prisma.events.count();

        // Gender counts through genders relation
        const maleGender = await prisma.genders.findFirst({ where: { name: { contains: 'ชาย', mode: 'insensitive' } } });
        const femaleGender = await prisma.genders.findFirst({ where: { name: { contains: 'หญิง', mode: 'insensitive' } } });

        const male = maleGender ? await prisma.students.count({ where: { gender_id: maleGender.id } }) : 0;
        const female = femaleGender ? await prisma.students.count({ where: { gender_id: femaleGender.id } }) : 0;

        return { students, teachers, subjects, activities, income: 0, expense: 0, male, female };
    },

    // --- Teachers CRUD ---
    async getTeachers(search?: string) {
        const where: any = {};
        if (search) {
            const parts = search.trim().split(/\s+/);
            if (parts.length > 1) {
                where.AND = parts.map(p => ({
                    OR: [
                        { first_name: { contains: p, mode: 'insensitive' } },
                        { last_name: { contains: p, mode: 'insensitive' } },
                    ]
                }));
            } else {
                where.OR = [
                    { teacher_code: { contains: search, mode: 'insensitive' } },
                    { first_name: { contains: search, mode: 'insensitive' } },
                    { last_name: { contains: search, mode: 'insensitive' } },
                ];
            }
        }
        const rows = await prisma.teachers.findMany({
            where,
            include: {
                name_prefixes: true,
                teacher_positions: true,
                departments: true,
                learning_subject_groups: true,
                classroom_advisors: {
                    include: {
                        classrooms: {
                            include: { levels: true }
                        }
                    }
                }
            },
            orderBy: { teacher_code: 'asc' }
        });

        return rows.map(r => {
            const advisor = r.classroom_advisors?.[0];
            const classLevel = advisor?.classrooms?.levels?.name || '';
            const room = roomOnlyLabel(classLevel, advisor?.classrooms?.room_name || '');
            const classRoom = classLevel && room ? `${classLevel}/${room}` : (classLevel || room || '');

            return {
                ...r,
                prefix: r.name_prefixes?.prefix_name || '',
                department_id: r.department_id,
                learning_subject_group_id: r.learning_subject_group_id,
                department: r.learning_subject_groups?.group_name || '',
                position: r.teacher_positions?.title || '',
                advisor_class: classRoom,
                advisor_level: classLevel,
                advisor_room: room
            };
        });
    },

    async createTeacher(data: any) {
        const hash = await bcrypt.hash(data.password || '1234', 10);

        // Create user first
        const user = await prisma.users.create({
            data: {
                username: data.teacher_code,
                email: data.email || `${data.teacher_code}@school.local`,
                password_hash: hash,
                role_id: data.role_id || 2, // Teacher role
            }
        });

        // Then create teacher linked to user
        const lastTeacher = await prisma.teachers.findFirst({ orderBy: { id: 'desc' } });
        const newId = (lastTeacher?.id || 0) + 1;

        return prisma.teachers.create({
            data: {
                id: newId,
                user_id: user.id,
                teacher_code: data.teacher_code,
                first_name: data.first_name,
                last_name: data.last_name,
                phone: data.phone || null,
                prefix_id: data.prefix_id || null,
                position_id: data.position_id || null,
                department_id: data.department_id || null,
                learning_subject_group_id: data.learning_subject_group_id || null,
            }
        });
    },

    async updateTeacher(id: number, data: any) {
        const updateData: any = {};
        if (data.first_name) updateData.first_name = data.first_name;
        if (data.last_name) updateData.last_name = data.last_name;
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.prefix_id !== undefined) updateData.prefix_id = data.prefix_id;
        if (data.position_id !== undefined) updateData.position_id = data.position_id;
        if (data.department_id !== undefined) updateData.department_id = data.department_id;
        if (data.status) updateData.status = data.status;

        // Update password on users table if provided
        if (data.password) {
            const teacher = await prisma.teachers.findUnique({ where: { id }, select: { user_id: true } });
            if (teacher?.user_id) {
                const hash = await bcrypt.hash(data.password, 10);
                await prisma.users.update({ where: { id: teacher.user_id }, data: { password_hash: hash } });
            }
        }

        return prisma.teachers.update({ where: { id }, data: updateData });
    },

    async deleteTeacher(id: number) {
        const teacher = await prisma.teachers.findUnique({ where: { id }, select: { user_id: true } });
        await prisma.teachers.delete({ where: { id } });
        if (teacher?.user_id) {
            await prisma.users.delete({ where: { id: teacher.user_id } }).catch(() => { });
        }
    },

    // --- Students CRUD ---
    async getStudents(filters?: { search?: string; class_level?: string; room?: string }) {
        const where: any = {};
        if (filters?.search) {
            const s = filters.search.trim();
            const parts = s.split(/\s+/);
            if (parts.length > 1) {
                where.AND = parts.map(p => ({
                    OR: [
                        { first_name: { contains: p, mode: 'insensitive' } },
                        { last_name: { contains: p, mode: 'insensitive' } },
                    ]
                }));
            } else {
                where.OR = [
                    { student_code: { contains: s, mode: 'insensitive' } },
                    { first_name: { contains: s, mode: 'insensitive' } },
                    { last_name: { contains: s, mode: 'insensitive' } },
                ];
            }
        }
        if (filters?.class_level || filters?.room) {
            where.classroom_students = { some: { classrooms: {} } };
            if (filters.class_level) {
                where.classroom_students.some.classrooms.levels = { name: { contains: filters.class_level.trim(), mode: 'insensitive' } };
            }
            if (filters.room) {
                where.classroom_students.some.classrooms.room_name = { contains: filters.room.trim(), mode: 'insensitive' };
            }
        }
        const rows = await (prisma.students as any).findMany({
            where,
            include: {
                name_prefixes: true,
                classroom_students: { 
                    include: { classrooms: { include: { levels: true } } },
                    take: 1
                },
                genders: true,
                student_statuses: true,
            },
            orderBy: { student_code: 'asc' }
        });

        const mapped = (rows as any[]).map(r => {
            const cs = r.classroom_students?.[0];
            const currentClassroom = cs?.classrooms;
            const classLevel = currentClassroom?.levels?.name || '';
            const roomName = currentClassroom?.room_name || '';

            return {
                ...r,
                prefix: r.name_prefixes?.prefix_name || '',
                class_level: classLevel.trim(),
                room: roomOnlyLabel(classLevel, roomName),
                gender: r.genders?.name || '',
                status: r.student_statuses?.status_name || '',
                roll_number: cs?.roll_number,
            };
        });

        return mapped.sort((a, b) => {
            const aNum = a.roll_number != null ? Number(a.roll_number) : 999999;
            const bNum = b.roll_number != null ? Number(b.roll_number) : 999999;
            if (aNum !== bNum) return aNum - bNum;
            return String(a.student_code || '').localeCompare(String(b.student_code || ''));
        });
    },

    async createStudent(data: any) {
        const hash = await bcrypt.hash(data.password || '1234', 10);

        // Create user first
        const user = await prisma.users.create({
            data: {
                username: data.student_code,
                email: data.email || `${data.student_code}@school.local`,
                password_hash: hash,
                role_id: data.role_id || 1, // Student role
            }
        });

        const lastStudent = await prisma.students.findFirst({ orderBy: { id: 'desc' } });
        const newStudentId = (lastStudent?.id || 0) + 1;

        const student = await prisma.students.create({
            data: {
                id: newStudentId,
                user_id: user.id,
                student_code: data.student_code,
                first_name: data.first_name,
                last_name: data.last_name,
                date_of_birth: data.date_of_birth ? new Date(data.date_of_birth) : null,
                phone: data.phone || null,
                address: data.address || null,
                prefix_id: data.prefix_id || null,
                gender_id: data.gender_id || null,
                status_id: data.status_id || null,
            }
        });

        if (data.classroom_id) {
            await prisma.classroom_students.create({
                data: {
                    student_id: student.id,
                    classroom_id: Number(data.classroom_id),
                    academic_year: data.academic_year || (new Date().getFullYear() + 543)
                }
            });
        }

        return student;
    },

    async updateStudent(id: number, data: any) {
        const updateData: any = {};
        if (data.first_name) updateData.first_name = data.first_name;
        if (data.last_name) updateData.last_name = data.last_name;
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.address !== undefined) updateData.address = data.address;
        if (data.classroom_id !== undefined) {
            const academicYear = data.academic_year || (new Date().getFullYear() + 543);
            if (data.classroom_id === null) {
                await prisma.classroom_students.deleteMany({
                    where: { student_id: id, academic_year: academicYear }
                });
            } else {
                const existingMapping = await prisma.classroom_students.findFirst({
                    where: { student_id: id, academic_year: academicYear }
                });
                if (existingMapping) {
                    await prisma.classroom_students.update({
                        where: { id: existingMapping.id },
                        data: { classroom_id: Number(data.classroom_id) }
                    });
                } else {
                    await prisma.classroom_students.create({
                        data: {
                            student_id: id,
                            classroom_id: Number(data.classroom_id),
                            academic_year: academicYear
                        }
                    });
                }
            }
        }
        if (data.prefix_id !== undefined) updateData.prefix_id = data.prefix_id;
        if (data.gender_id !== undefined) updateData.gender_id = data.gender_id;
        if (data.status_id !== undefined) updateData.status_id = data.status_id;
        if (data.date_of_birth) updateData.date_of_birth = new Date(data.date_of_birth);

        // Update password on users table if provided
        if (data.password) {
            const student = await prisma.students.findUnique({ where: { id }, select: { user_id: true } });
            if (student?.user_id) {
                const hash = await bcrypt.hash(data.password, 10);
                await prisma.users.update({ where: { id: student.user_id }, data: { password_hash: hash } });
            }
        }

        return prisma.students.update({ where: { id }, data: updateData });
    },

    async deleteStudent(id: number) {
        const student = await prisma.students.findUnique({ where: { id }, select: { user_id: true } });
        // Delete related records via Raw SQL if models are missing from Prisma
        await prisma.enrollments.deleteMany({ where: { student_id: id } });
        await prisma.students.delete({ where: { id } });
        if (student?.user_id) {
            await prisma.users.delete({ where: { id: student.user_id } }).catch(() => { });
        }
    },

    // --- Student Count ---
    async getStudentCount() {
        const maleGender = await prisma.genders.findFirst({ where: { name: { contains: 'ชาย', mode: 'insensitive' } } });
        const femaleGender = await prisma.genders.findFirst({ where: { name: { contains: 'หญิง', mode: 'insensitive' } } });

        const students = await (prisma.students as any).findMany({
            include: {
                classroom_students: {
                    include: { classrooms: { include: { levels: true } } },
                    orderBy: { academic_year: 'desc' },
                    take: 1
                }
            }
        });

        // Group by class_level + room
        const counts = new Map<string, { class_level: string; room: string; total: number; male: number; female: number }>();
        (students as any[]).forEach(s => {
            const currentClassroom = s.classroom_students?.[0]?.classrooms;
            const level = (currentClassroom?.levels?.name || 'ไม่ระบุ').trim();
            const room = roomOnlyLabel(
                currentClassroom?.levels?.name || '',
                currentClassroom?.room_name || ''
            ) || 'ไม่ระบุ';

            const isMale = maleGender && s.gender_id === maleGender.id;
            const isFemale = femaleGender && s.gender_id === femaleGender.id;

            const key = `${level}-${room}`;
            const existing = counts.get(key) || { class_level: level, room, total: 0, male: 0, female: 0 };
            existing.total++;
            if (isMale) existing.male++;
            if (isFemale) existing.female++;
            counts.set(key, existing);
        });

        return Array.from(counts.values()).sort((a, b) => {
            if (a.class_level !== b.class_level) return a.class_level.localeCompare(b.class_level);
            return a.room.localeCompare(b.room);
        });
    },

    // --- Subjects CRUD ---
    async getLearningSubjectGroups() {
        return prisma.$queryRaw`SELECT id, group_name FROM learning_subject_groups ORDER BY group_name ASC`;
    },
    async getSubjectCategories() {
        return prisma.subject_categories.findMany({
            orderBy: { id: 'asc' }
        });
    },
    async getTeacherPositions() {
        return prisma.teacher_positions.findMany({
            orderBy: { title: 'asc' }
        });
    },
    async getSubjects(filters?: { search?: string; level?: string; group?: string; category?: string }) {
        const where: any = {};
        if (filters?.search) {
            where.OR = [
                { subject_code: { contains: filters.search, mode: 'insensitive' } },
                { subject_name: { contains: filters.search, mode: 'insensitive' } },
            ];
        }
        if (filters?.level) {
            // Regex-based fallback for level filtering (Thai school convention)
            // ม.1 -> 21, ม.2 -> 22, ม.3 -> 23, ม.4 -> 31, ม.5 -> 32, ม.6 -> 33
            let codePrefix = "";
            if (filters.level === "ม.1") codePrefix = "21";
            else if (filters.level === "ม.2") codePrefix = "22";
            else if (filters.level === "ม.3") codePrefix = "23";
            else if (filters.level === "ม.4") codePrefix = "31";
            else if (filters.level === "ม.5") codePrefix = "32";
            else if (filters.level === "ม.6") codePrefix = "33";

            where.OR = [
                {
                    teaching_assignments: {
                        some: {
                            classrooms: {
                                levels: { name: filters.level }
                            }
                        }
                    }
                }
            ];

            if (codePrefix) {
                // Add code-based check if teaching assignment doesn't exist yet
                where.OR.push({ 
                    subject_code: { 
                        contains: codePrefix, 
                        mode: 'insensitive' 
                    } 
                });
            }
        }
        if (filters?.group) {
            where.learning_subject_groups = {
                group_name: filters.group
            };
        }
        if (filters?.category) {
            where.subject_categories = {
                category_name: filters.category
            };
        }

        const rows = await (prisma.subjects as any).findMany({
            where,
            include: {
                learning_subject_groups: true,
                subject_categories: true,
                evaluation_types: true,
                teaching_assignments: {
                    include: { classrooms: { include: { levels: true } } },
                    take: 1
                }
            },
            orderBy: { subject_code: 'asc' }
        });

        const deriveLevelFromCode = (code: string) => {
            if (!code) return '';
            // Match pattern like ท21101 (Thai) or EN21101 (English)
            // The first digit of the number part indicates the level
            const match = code.match(/[A-Zก-ฮ]+(\d)(\d)/i);
            if (match) {
                const type = match[1]; // 2=Secondary 1-3, 3=Secondary 4-6
                const level = match[2];
                if (type === '2') return `ม.${level}`;
                if (type === '3') return `ม.${Number(level) + 3}`;
            }
            return '';
        };

        return (rows as any[]).map(r => ({
            ...r,
            name: r.subject_name,
            subject_type: r.subject_categories?.category_name || '',
            subject_group: r.learning_subject_groups?.group_name || '',
            level: (r as any).level || (r.teaching_assignments?.[0]?.classrooms as any)?.levels?.name || deriveLevelFromCode(r.subject_code),
        }));
    },

    async createSubject(data: any) {
        const lastSubject = await prisma.subjects.findFirst({ orderBy: { id: 'desc' } });
        const newSubjectId = (lastSubject?.id || 0) + 1;

        return prisma.subjects.create({
            data: {
                id: newSubjectId,
                subject_code: data.subject_code,
                subject_name: data.subject_name,
                credit: data.credit || 1.0,
                // level: data.class_level || data.level || null, // REMOVED until DB is fixed
                learning_subject_group_id: data.learning_subject_group_id || null,
                subject_categories_id: data.subject_categories_id || null,
                evaluation_type_id: data.evaluation_type_id || null,
            }
        });
    },

    async updateSubject(id: number, data: any) {
        const updateData: any = {};
        if (data.subject_name) updateData.subject_name = data.subject_name;
        if (data.credit !== undefined) updateData.credit = data.credit;
        if (data.learning_subject_group_id !== undefined) updateData.learning_subject_group_id = data.learning_subject_group_id;
        if (data.subject_categories_id !== undefined) updateData.subject_categories_id = data.subject_categories_id;
        // if (data.class_level !== undefined || data.level !== undefined) updateData.level = data.class_level || data.level; // REMOVED until DB is fixed
        return prisma.subjects.update({ where: { id }, data: updateData });
    },

    async deleteSubject(id: number) {
        return prisma.subjects.delete({ where: { id } });
    },

    // --- Curriculum (Teaching Assignments) ---
    async getSections(yearOrSemesterId?: number, semesterNumber?: number) {
        const where: any = {};
        if (typeof semesterNumber === 'number' && typeof yearOrSemesterId === 'number') {
            const semester = await prisma.semesters.findFirst({
                where: {
                    semester_number: semesterNumber,
                    academic_years: { year_name: String(yearOrSemesterId) },
                },
                select: { id: true },
                orderBy: { id: 'desc' },
            });
            if (semester) where.semester_id = semester.id;
            else where.semester_id = -1; // no match -> empty result
        } else if (yearOrSemesterId) {
            // Backward compatible: treat first arg as semester_id
            where.semester_id = yearOrSemesterId;
        }

        return prisma.teaching_assignments.findMany({
            where,
            include: {
                subjects: { include: { learning_subject_groups: true } },
                teachers: { include: { name_prefixes: true } },
                classrooms: { include: { levels: true } },
                semesters: { include: { academic_years: true } },
                class_schedules: {
                    include: {
                        day_of_weeks: true,
                        periods: true,
                    },
                    orderBy: [{ day_id: 'asc' }, { period_id: 'asc' }],
                },
                enrollments: { select: { id: true } },
            },
            orderBy: [{ semester_id: 'desc' }, { id: 'desc' }]
        }).then((rows) => rows.map((row) => {
            const firstSchedule = row.class_schedules?.[0];
            const dayName = firstSchedule?.day_of_weeks?.day_name_th || '';
            const timeRange = firstSchedule?.periods
                ? `${formatTimePart(firstSchedule.periods.start_time)}-${formatTimePart(firstSchedule.periods.end_time)}`
                : '';

            return {
                ...row,
                year: row.semesters?.academic_years?.year_name || '',
                semester: row.semesters?.semester_number || null,
                class_level: row.classrooms?.levels?.name || '',
                classroom: row.classrooms?.room_name || '',
                day_of_week: dayName,
                time_range: timeRange,
                subjects: row.subjects ? { ...row.subjects, name: row.subjects.subject_name, subject_group: (row.subjects as any).learning_subject_groups?.group_name || '' } : row.subjects,
            };
        }));
    },

    async createSection(data: any) {
        const subject_id = Number(data?.subject_id);
        const teacher_id = Number(data?.teacher_id);
        if (!Number.isFinite(subject_id) || subject_id <= 0) throw new Error('กรุณาเลือกรายวิชา');
        if (!Number.isFinite(teacher_id) || teacher_id <= 0) throw new Error('กรุณาเลือกผู้สอน');

        const semester_id = await resolveSemesterIdFromPayload(data);
        const classroom_id = await resolveClassroomIdFromPayload(data);

        const created = await prisma.teaching_assignments.create({
            data: {
                subject_id,
                teacher_id,
                semester_id,
                classroom_id,
                capacity: data.capacity || null,
                status: data.status || 'open',
            }
        });

        await upsertSingleClassSchedule(created.id, data);
        return created;
    },

    async updateSection(id: number, data: any) {
        const updateData: any = {};
        if (data.subject_id !== undefined) {
            const subject_id = Number(data.subject_id);
            if (!Number.isFinite(subject_id) || subject_id <= 0) throw new Error('subject_id ไม่ถูกต้อง');
            updateData.subject_id = subject_id;
        }
        if (data.teacher_id !== undefined) {
            const teacher_id = Number(data.teacher_id);
            if (!Number.isFinite(teacher_id) || teacher_id <= 0) throw new Error('teacher_id ไม่ถูกต้อง');
            updateData.teacher_id = teacher_id;
        }
        if (
            data.classroom_id !== undefined ||
            data.class_level !== undefined ||
            data.classroom !== undefined
        ) {
            updateData.classroom_id = await resolveClassroomIdFromPayload(data);
        }
        if (
            data.semester_id !== undefined ||
            data.year !== undefined ||
            data.semester !== undefined
        ) {
            updateData.semester_id = await resolveSemesterIdFromPayload(data);
        }
        if (data.capacity !== undefined) updateData.capacity = data.capacity;
        if (data.status) updateData.status = data.status;

        const updated = await prisma.teaching_assignments.update({ where: { id }, data: updateData });
        await upsertSingleClassSchedule(id, data);
        return updated;
    },

    async deleteSection(id: number) {
        // Delete related records
        await prisma.student_scores.deleteMany({
            where: { assessment_items: { grade_categories: { teaching_assignment_id: id } } }
        });
        await prisma.assessment_items.deleteMany({
            where: { grade_categories: { teaching_assignment_id: id } }
        });
        await prisma.grade_categories.deleteMany({ where: { teaching_assignment_id: id } });
        await prisma.attendance_records.deleteMany({
            where: { attendance_sessions: { teaching_assignment_id: id } }
        });
        await prisma.attendance_sessions.deleteMany({ where: { teaching_assignment_id: id } });
        await prisma.class_schedules.deleteMany({ where: { teaching_assignment_id: id } });
        await prisma.final_grades.deleteMany({
            where: { enrollments: { teaching_assignment_id: id } }
        });
        await prisma.enrollments.deleteMany({ where: { teaching_assignment_id: id } });
        return prisma.teaching_assignments.delete({ where: { id } });
    },

    // --- Advisors (use classroom_advisors + classrooms/levels) ---
    async getAdvisors(filters?: { year?: number; semester?: number; class_level?: string; room?: string }) {
        const term = await resolveAdvisorTerm(filters?.year, filters?.semester);
        const where: any = {};
        
        if (filters?.class_level || filters?.room) {
            where.classrooms = {};
            if (filters.class_level) {
                where.classrooms.levels = { name: { contains: filters.class_level.trim(), mode: 'insensitive' } };
            }
            if (filters.room) {
                const r = filters.room.trim();
                // Ensure room '1' doesn't match 'ม.1/2' by checking for slash or exact match
                where.classrooms.OR = [
                    { room_name: { endsWith: `/${r}` } },
                    { room_name: r }
                ];
            }
        }

        const rows = await prisma.classroom_advisors.findMany({
            where,
            include: {
                teachers: {
                    include: { name_prefixes: true },
                },
                classrooms: {
                    include: {
                        levels: true,
                    },
                },
            },
            orderBy: { id: 'asc' },
        });

        return rows
            .map((row) => mapAdvisorRecord(row, term))
            .sort((a, b) =>
                String(a.class_level || '').localeCompare(String(b.class_level || ''), 'th')
                || String(a.room || '').localeCompare(String(b.room || ''), 'th')
                || Number(a.id) - Number(b.id)
            );
    },

    async createAdvisor(data: any) {
        const teacher_id = Number(data?.teacher_id);
        const class_level = String(data?.class_level || '').trim();
        const room = String(data?.room || '').trim();
        const term = await resolveAdvisorTerm(
            data?.year != null ? Number(data.year) : undefined,
            data?.semester != null ? Number(data.semester) : undefined
        );

        if (!Number.isFinite(teacher_id) || teacher_id <= 0) throw new Error('teacher_id is required');
        if (!class_level) throw new Error('class_level is required');
        if (!room) throw new Error('room is required');

        const teacher = await prisma.teachers.findUnique({
            where: { id: teacher_id },
            select: { id: true },
        });
        if (!teacher) throw new Error('Teacher not found');

        const classroom_id = await resolveClassroomIdFromPayload({
            class_level,
            classroom: room,
        });
        if (!classroom_id) throw new Error('Classroom not found');

        const duplicate = await prisma.classroom_advisors.findFirst({
            where: {
                teacher_id,
                classroom_id,
            },
            select: { id: true },
        });
        if (duplicate) throw new Error('Advisor assignment already exists');

        const created = await prisma.classroom_advisors.create({
            data: {
                teacher_id,
                classroom_id,
            },
            include: {
                teachers: { include: { name_prefixes: true } },
                classrooms: { include: { levels: true } },
            },
        });

        return mapAdvisorRecord(created, term);
    },

    async updateAdvisor(id: number, data: any) {
        const nid = Number(id);
        const teacher_id = data?.teacher_id != null ? Number(data.teacher_id) : 0;
        const class_level = String(data?.class_level || '').trim();
        const room = String(data?.room || '').trim();
        const term = await resolveAdvisorTerm(
            data?.year != null ? Number(data.year) : undefined,
            data?.semester != null ? Number(data.semester) : undefined
        );

        if (!Number.isFinite(teacher_id) || teacher_id <= 0) throw new Error('teacher_id is required');
        if (!class_level) throw new Error('class_level is required');
        if (!room) throw new Error('room is required');

        const existing = await prisma.classroom_advisors.findUnique({
            where: { id: nid },
            select: { id: true },
        });
        if (!existing) throw new Error('Advisor record not found');

        const classroom_id = await resolveClassroomIdFromPayload({
            class_level,
            classroom: room,
        });
        if (!classroom_id) throw new Error('Classroom not found');

        const duplicate = await prisma.classroom_advisors.findFirst({
            where: {
                id: { not: nid },
                teacher_id,
                classroom_id,
            },
            select: { id: true },
        });
        if (duplicate) throw new Error('Advisor assignment already exists');

        const updated = await prisma.classroom_advisors.update({
            where: { id: nid },
            data: {
                teacher_id,
                classroom_id,
            },
            include: {
                teachers: { include: { name_prefixes: true } },
                classrooms: { include: { levels: true } },
            },
        });

        return mapAdvisorRecord(updated, term);
    },

    async deleteAdvisor(id: number) {
        if (!id || Number.isNaN(Number(id))) throw new Error('id is required');
        const existing = await prisma.classroom_advisors.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!existing) throw new Error('Advisor record not found');

        return prisma.classroom_advisors.delete({ where: { id } });
    },

    // --- Activities (Events) ---
    async getActivities(search?: string) {
        try {
            let query = `
                SELECT *,
                    TO_CHAR(start_datetime, 'YYYY-MM-DD') as start_date_str,
                    TO_CHAR(start_datetime, 'HH24:MI') as start_time_str,
                    TO_CHAR(end_datetime, 'YYYY-MM-DD') as end_date_str,
                    TO_CHAR(end_datetime, 'HH24:MI') as end_time_str
                FROM events 
                WHERE 1=1`;
            const params: any[] = [];
            if (search) {
                query += ` AND (title ILIKE $1 OR description ILIKE $1 OR location ILIKE $1)`;
                params.push(`%${search}%`);
            }
            query += ` ORDER BY start_datetime DESC`;

            const rows = await prisma.$queryRawUnsafe(query, ...params);

            if (!rows || (rows as any).length === 0) return [];

            const [teachers, depts, types] = await Promise.all([
                this.getTeachers(),
                this.getDepartments(),
                this.getEventTypes()
            ]);

            const tMap = new Map((teachers || []).map((t: any) => [t.id, t]));
            const dMap = new Map((depts || []) .map((d: any) => [d.id, d.department_name]));
            const etMap = new Map((types || []) .map((t: any) => [t.id, t.name]));

            return (rows as any[]).map((r: any) => {
                const teacher = tMap.get(r.teacher_id) as any;
                
                return {
                    id: r.id,
                    name: r.title,
                    date: r.start_date_str, // YYYY-MM-DD string
                    start_time: r.start_time_str, // HH:mm string
                    end_date: r.end_date_str, // YYYY-MM-DD string
                    end_time: r.end_time_str, // HH:mm string
                    location: r.location || '',
                    visibility: r.visibility,
                    note: r.description || '',
                    created_by: '',
                    teacher_id: r.teacher_id,
                    teacher_name: teacher ? `${teacher.prefix || ''}${teacher.first_name} ${teacher.last_name || ''}` : '',
                    department_id: r.department_id,
                    department_name: dMap.get(r.department_id) || '',
                    event_type_id: r.event_type_id,
                    event_type_name: etMap.get(r.event_type_id) || '',
                };
            });
        } catch (error: any) {
            console.error('Error in resilient getActivities:', error);
            return [];
        }
    },

    async createActivity(data: any) {
        // Build YYYY-MM-DD HH:mm:ss strings directly to avoid JS timezone shifts
        const startDateString = data.start_date || new Date().toISOString().split('T')[0];
        const startTimeString = data.start_time || "00:00";
        const start = `${startDateString} ${startTimeString}:00`;

        const endDateString = data.end_date || startDateString;
        const endTimeString = data.end_time || "23:59";
        const end = `${endDateString} ${endTimeString}:00`;

        const title = data.title || data.name || '';
        const description = data.description || data.note || '';
        const location = data.location || '';
        const visibility = String(data.visibility || 'public');
        const is_all_day = data.is_all_day ?? (data.start_time ? false : true);
        const created_by = data.created_by ? Number(data.created_by) : null;
        const teacher_id = data.teacher_id ? Number(data.teacher_id) : null;
        const department_id = data.department_id ? Number(data.department_id) : null;
        const event_type_id = data.event_type_id ? Number(data.event_type_id) : null;

        const res = await prisma.$queryRawUnsafe(`
            INSERT INTO events (
                title, description, start_datetime, end_datetime, 
                is_all_day, location, visibility, created_by,
                teacher_id, department_id, event_type_id
            ) VALUES (
                $1, $2, $3::timestamp, $4::timestamp, 
                $5, $6, $7, $8, 
                $9, $10, $11
            ) RETURNING id
        `, 
        title, description, start, end, 
        is_all_day, location, visibility, created_by,
        teacher_id, department_id, event_type_id
        );
        return (res as any)[0];
    },

    async updateActivity(id: number, data: any) {
        const nid = Number(id);
        const current = await (prisma.events as any).findUnique({ where: { id: nid } });
        if (!current) throw new Error('Activity not found');

        const startDate = data.date || data.start_date || new Date(current.start_datetime).toISOString().split('T')[0];
        const startTime = data.start_time || new Date(current.start_datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
        const start = `${startDate} ${startTime}:00`;

        const endDate = data.end_date || new Date(current.end_datetime).toISOString().split('T')[0];
        const endTime = data.end_time || new Date(current.end_datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
        const end = `${endDate} ${endTime}:00`;

        const title = data.title || data.name || current.title;
        const description = data.description !== undefined ? data.description : (data.note !== undefined ? data.note : current.description);
        const location = data.location !== undefined ? data.location : current.location;
        const visibility = data.visibility !== undefined ? String(data.visibility) : current.visibility;
        
        // Use current as any to avoid lint for possibly missing fields in generated client
        const c = current as any;
        const teacher_id = data.teacher_id !== undefined ? (data.teacher_id ? Number(data.teacher_id) : null) : c.teacher_id;
        const department_id = data.department_id !== undefined ? (data.department_id ? Number(data.department_id) : null) : c.department_id;
        const event_type_id = data.event_type_id !== undefined ? (data.event_type_id ? Number(data.event_type_id) : null) : c.event_type_id;

        return prisma.$executeRawUnsafe(`
            UPDATE events 
            SET title = $1, 
                description = $2, 
                start_datetime = $3::timestamp, 
                end_datetime = $4::timestamp, 
                location = $5, 
                visibility = $6, 
                teacher_id = $7, 
                department_id = $8, 
                event_type_id = $9
            WHERE id = $10
        `, 
        title, 
        description, 
        start, 
        end, 
        location, 
        visibility, 
        teacher_id, 
        department_id, 
        event_type_id, 
        nid
        );
    },

    async getEventTypes() {
        return prisma.event_types.findMany({ orderBy: { name: 'asc' } });
    },

    async getDepartments() {
        return prisma.departments.findMany({ orderBy: { department_name: 'asc' } });
    },

    async deleteActivity(id: number) {
        await prisma.event_participants.deleteMany({ where: { event_id: id } });
        await prisma.event_targets.deleteMany({ where: { event_id: id } });
        await prisma.$executeRawUnsafe(`DELETE FROM activity_evaluation_link WHERE event_id = $1`, id).catch(() => {});
        return prisma.events.delete({ where: { id } });
    },

    // --- Projects ---
    async getProjects(year?: number, semester?: number, search?: string) {
        let query = `SELECT p.*, ay.year_name as year_label 
                     FROM projects p 
                     LEFT JOIN academic_years ay ON p.academic_year_id = ay.id 
                     WHERE 1=1`;
        const params: any[] = [];
        let idx = 1;
        if (year) {
            query += ` AND p.academic_year_id = $${idx++}`;
            params.push(year);
        }
        if (search) {
            query += ` AND (p.project_name ILIKE $${idx} OR p.project_code ILIKE $${idx})`;
            params.push(`%${search}%`);
            idx++;
        }
        query += ` ORDER BY p.id DESC`;

        const rows: any[] = await prisma.$queryRawUnsafe(query, ...params);

        // Fetch related data for mapping
        const [pTypes, bTypes, sGroups, teachers] = await Promise.all([
            this.getProjectTypes(),
            this.getBudgetTypes(),
            this.getDepartments(),
            this.getTeachers()
        ]);

        const ptMap = new Map(((pTypes || []) as any[]).map((t: any) => [t.id, t.name]));
        const btMap = new Map(((bTypes || []) as any[]).map((t: any) => [t.id, t.name]));
        const sgMap = new Map(((sGroups || []) as any[]).map((g: any) => [g.id, g.department_name]));
        const tMap = new Map((teachers || []).map((t: any) => [t.id, t]));

        return rows.map(r => {
            const name = r.project_name || r.name || '';
            const budget_total = Number(r.allocated_budget || r.total_budget || 0);
            const budget_used_sem1 = Number(r.budget_used_sem1 || 0);
            const budget_used_sem2 = Number(r.budget_used_sem2 || 0);
            const budget_used = budget_used_sem1 + budget_used_sem2;
            const budget_remaining = budget_total - budget_used;
            const teacher_id = r.teacher_id;
            const t = tMap.get(teacher_id) as any;
            const tName = t ? `${t.prefix || ''}${t.first_name} ${t.last_name}` : '';

            return {
                id: r.id,
                project_code: r.project_code || '',
                name,
                description: r.description || '',
                year: r.academic_year_id,
                year_label: r.year_label || String(r.academic_year_id || ''),
                semester: 1, 
                budget_total,
                budget_used_sem1,
                budget_used_sem2,
                budget_remaining,
                status: r.status || 'Approved',
                teacher_id,
                teacher_name: tName,
                project_type_id: r.project_type_id,
                project_type: ptMap.get(r.project_type_id) || '',
                budget_type_id: r.budget_type_id,
                budget_type: btMap.get(r.budget_type_id) || '',
                learning_subject_group_id: r.department_id,
                department: sgMap.get(r.department_id) || '',
                start_date: r.start_date,
                end_date: r.end_date,
            };
        });
    },

    async createProject(row: any) {
        const lastRow = await prisma.$queryRaw`SELECT id FROM projects ORDER BY id DESC LIMIT 1` as any[];
        const newId = (lastRow[0]?.id || 0) + 1;

        const data = row;
        const name = data.name || '';
        const budget = Number(data.budget_total) || 0;
        const academic_year_id = Number(data.year) || null;
        const desc = data.objective || data.description || '';
        const pt_id = data.project_type_id ? Number(data.project_type_id) : null;
        const bt_id = data.budget_type_id ? Number(data.budget_type_id) : null;
        const dept_id = data.department_id || data.learning_subject_group_id ? Number(data.department_id || data.learning_subject_group_id) : null;
        const t_id = data.teacher_id ? Number(data.teacher_id) : null;
        const status = data.status || 'Approved';
        const start = data.start_date ? new Date(data.start_date).toISOString() : null;
        const end = data.end_date ? new Date(data.end_date).toISOString() : null;
        const code = data.project_code || null;

        const cols = [
            'id', 'project_name', 'description', 'academic_year_id', 'teacher_id', 
            'status', 'project_type_id', 'budget_type_id', 'allocated_budget',
            'department_id', 'start_date', 'end_date', 'budget_used_sem1', 'budget_used_sem2',
            'project_code'
        ];
        const vals = [
            newId, name, desc, academic_year_id, t_id, 
            status, pt_id, bt_id, budget,
            dept_id, start, end, Number(data.budget_used_sem1 || 0), Number(data.budget_used_sem2 || 0),
            code
        ];

        const placeholders = vals.map((_, i) => {
            const pos = i + 1;
            if (pos === 11 || pos === 12) return `$${pos}::date`;
            return `$${pos}`;
        }).join(', ');
        const sql = `INSERT INTO projects (${cols.join(', ')}) VALUES (${placeholders})`;
        console.log('CREATE SQL:', sql);
        return await prisma.$executeRawUnsafe(sql, ...vals);
    },

    async updateProject(id: number, data: any) {
        const sets: string[] = [];
        const p: any[] = [];
        let idx = 1;

        if (data.name !== undefined) { sets.push(`project_name = $${idx++}`); p.push(data.name); }
        if (data.project_code !== undefined) { sets.push(`project_code = $${idx++}`); p.push(data.project_code || null); }
        if (data.project_type_id !== undefined) { sets.push(`project_type_id = $${idx++}`); p.push(data.project_type_id ? Number(data.project_type_id) : null); }
        if (data.budget_type_id !== undefined) { sets.push(`budget_type_id = $${idx++}`); p.push(data.budget_type_id ? Number(data.budget_type_id) : null); }
        if (data.department_id !== undefined || data.learning_subject_group_id !== undefined) { 
            sets.push(`department_id = $${idx++}`); 
            p.push(data.department_id || data.learning_subject_group_id ? Number(data.department_id || data.learning_subject_group_id) : null); 
        }
        if (data.objective !== undefined || data.description !== undefined) { sets.push(`description = $${idx++}`); p.push(data.objective || data.description); }
        if (data.year !== undefined) { sets.push(`academic_year_id = $${idx++}`); p.push(data.year ? Number(data.year) : null); }
        if (data.budget_total !== undefined) { sets.push(`allocated_budget = $${idx++}`); p.push(Number(data.budget_total)); }
        if (data.budget_used_sem1 !== undefined) { sets.push(`budget_used_sem1 = $${idx++}`); p.push(Number(data.budget_used_sem1)); }
        if (data.budget_used_sem2 !== undefined) { sets.push(`budget_used_sem2 = $${idx++}`); p.push(Number(data.budget_used_sem2)); }
        if (data.status !== undefined) { sets.push(`status = $${idx++}`); p.push(data.status); }
        if (data.teacher_id !== undefined) { sets.push(`teacher_id = $${idx++}`); p.push(data.teacher_id ? Number(data.teacher_id) : null); }
        if (data.start_date !== undefined) { sets.push(`start_date = $${idx++}::date`); p.push(data.start_date ? new Date(data.start_date).toISOString() : null); }
        if (data.end_date !== undefined) { sets.push(`end_date = $${idx++}::date`); p.push(data.end_date ? new Date(data.end_date).toISOString() : null); }

        if (sets.length === 0) return;
        p.push(id);
        const sql = `UPDATE projects SET ${sets.join(', ')} WHERE id = $${idx}`;
        console.log('UPDATE SQL:', sql);
        return await prisma.$executeRawUnsafe(sql, ...p);
    },

    async getProjectTypes() {
        return prisma.$queryRaw`SELECT id, name, description FROM project_types ORDER BY name ASC`;
    },

    async getBudgetTypes() {
        return prisma.$queryRaw`SELECT id, name FROM budget_types ORDER BY name ASC`;
    },

    async deleteProject(id: number) {
        return prisma.projects.delete({ where: { id } });
    },

    // --- Finance ---
    async getFinanceRecords() {
        // Use raw query for finance records as well to be safe
        const rows: any[] = await prisma.$queryRaw`
            SELECT e.*, p.project_name as p_name, p.name as alt_p_name, c.name as cat_name
            FROM project_expenses e
            LEFT JOIN projects p ON e.project_id = p.id
            LEFT JOIN expense_categories c ON e.expense_category_id = c.id
            ORDER BY e.expense_date DESC
        `;
        return rows.map(r => ({
            id: r.id,
            title: r.title,
            amount: Number(r.amount),
            date: r.expense_date,
            project_id: r.project_id,
            project_name: r.p_name || r.alt_p_name || '',
            category_id: r.expense_category_id,
            category_name: r.cat_name || '',
            receipt_number: r.receipt_number || ''
        }));
    },

    async createFinanceRecord(data: any) {
        const p_id = Number(data.project_id);
        const cat_id = data.category_id ? Number(data.category_id) : null;
        const title = data.title;
        const amount = Number(data.amount);
        const date = data.date ? new Date(data.date).toISOString() : new Date().toISOString();
        const receipt = data.receipt_number || null;

        return prisma.$executeRawUnsafe(`
            INSERT INTO project_expenses (project_id, expense_category_id, title, amount, expense_date, receipt_number)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, p_id, cat_id, title, amount, date, receipt);
    },

    async updateFinanceRecord(id: number, data: any) {
        let sets = "";
        let p: any[] = [];
        let idx = 1;
        if (data.project_id !== undefined) { sets += `project_id = $${idx++}, `; p.push(Number(data.project_id)); }
        if (data.category_id !== undefined) { sets += `expense_category_id = $${idx++}, `; p.push(data.category_id ? Number(data.category_id) : null); }
        if (data.title !== undefined) { sets += `title = $${idx++}, `; p.push(data.title); }
        if (data.amount !== undefined) { sets += `amount = $${idx++}, `; p.push(Number(data.amount)); }
        if (data.date !== undefined) { sets += `expense_date = $${idx++}, `; p.push(new Date(data.date).toISOString()); }
        if (data.receipt_number !== undefined) { sets += `receipt_number = $${idx++}, `; p.push(data.receipt_number); }

        if (!sets) return;
        sets = sets.slice(0, -2);
        p.push(id);
        return prisma.$executeRawUnsafe(`UPDATE project_expenses SET ${sets} WHERE id = $${idx}`, ...p);
    },

    async deleteFinanceRecord(id: number) {
        return prisma.project_expenses.delete({ where: { id } });
    },

    async getExpenseCategories() {
        return prisma.$queryRaw`SELECT id, name FROM expense_categories ORDER BY name ASC`;
    },

    // --- Evaluation Summary ---
    async getEvaluationSummary(year?: number, semester?: number) {
        void year;
        void semester;
        // Use raw SQL for evaluation summary as these models are currently missing from schema.prisma
        const rows: any[] = await prisma.$queryRawUnsafe(`
            SELECT 
                ef.id, 
                ef.name, 
                (SELECT COUNT(*)::int FROM evaluation_questions eq WHERE eq.form_id = ef.id) as questions_count,
                (SELECT COUNT(*)::int FROM evaluation_responses er WHERE er.form_id = ef.id) as responses_count
            FROM evaluation_forms ef
            ORDER BY ef.id ASC
        `);

        return rows.map((f: any) => ({
            id: f.id,
            name: f.name,
            type: '', // type column missing or unknown
            questions_count: f.questions_count,
            responses_count: f.responses_count,
        }));
    },

    async getGradeLevels() {
        return prisma.levels.findMany({
            select: { name: true },
            orderBy: { id: 'asc' }
        }).then(rows => rows.map(r => r.name));
    },

    async getClassrooms() {
        const classrooms = await prisma.classrooms.findMany({
            include: { levels: true }
        });
        
        // Return unique room parts as the user wants "ห้อง" separate
        const rooms = new Set<string>();
        classrooms.forEach(c => {
            const levelName = (c as any).levels?.name || '';
            const roomOnly = roomOnlyLabel(levelName, c.room_name || '');
            if (roomOnly) rooms.add(roomOnly);
        });

        return Array.from(rooms).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    },

    async getAcademicYears() {
        return prisma.academic_years.findMany({
            orderBy: { year_name: 'desc' },
            select: { id: true, year_name: true, is_active: true }
        });
    }
};
