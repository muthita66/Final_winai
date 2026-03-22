import { prisma } from '@/lib/prisma';

export const TeacherBehaviorService = {
    async getBehaviorTypes() {
        return prisma.behavior_types.findMany({
            where: { is_active: true },
            orderBy: { name: 'asc' }
        });
    },

    async getLevels() {
        return prisma.levels.findMany({
            orderBy: { name: 'asc' }
        });
    },

    async getClassrooms(level_id?: number | string) {
        const id = level_id ? Number(level_id) : undefined;
        return prisma.classrooms.findMany({
            where: id && !isNaN(id) ? { grade_level_id: id } : undefined,
            include: { levels: { select: { name: true } } },
            orderBy: { room_name: 'asc' }
        });
    },

    async getAcademicYears() {
        return prisma.academic_years.findMany({
            orderBy: { year_name: 'desc' }
        });
    },

    async getSemesters() {
        // Just return unique semester numbers or all semesters?
        // Usually, we want unique semester numbers for the filter (1, 2)
        // or a list of semesters linked to academic years.
        // Let's return unique semester numbers for the dropdown.
        const semesters = await prisma.semesters.findMany({
            select: { semester_number: true },
            distinct: ['semester_number'],
            orderBy: { semester_number: 'asc' }
        });
        return semesters.map(s => s.semester_number);
    },

    async getFilteredStudents(params: {
        teacher_id?: number;
        year?: number;
        semester?: number;
        level_id?: number;
        classroom_id?: number;
    }) {
        const { teacher_id, year, semester, level_id, classroom_id } = params;
        
        // If filtering by room, we look for students in that room.
        // If no filters, we fallback to advisory students like before.
        
        let targetClassroomIds: number[] = [];
        
        if (classroom_id) {
            targetClassroomIds = [classroom_id];
        } else if (level_id) {
            const rooms = await prisma.classrooms.findMany({
                where: { grade_level_id: level_id },
                select: { id: true }
            });
            targetClassroomIds = rooms.map(r => r.id);
        } else if (teacher_id) {
            // Default: All rooms where this teacher is an advisor
            const advisors = await prisma.classroom_advisors.findMany({
                where: { teacher_id },
                select: { classroom_id: true }
            });
            targetClassroomIds = advisors.map(a => a.classroom_id);
        } else {
            // No filters and no teacher_id (Global view for Director, get all classrooms)
            const allRooms = await prisma.classrooms.findMany({ select: { id: true } });
            targetClassroomIds = allRooms.map(r => r.id);
        }

        const validClassroomIds = targetClassroomIds.filter(id => !isNaN(id));
        if (validClassroomIds.length === 0) return [];

        console.log(`Searching students for room IDs: ${validClassroomIds}, year: ${year}`);
        
        let students = await (prisma.students as any).findMany({
            where: {
                classroom_students: {
                    some: {
                        classroom_id: { in: validClassroomIds },
                        ...(year && !isNaN(year) ? { academic_year: year } : {})
                    }
                }
            },
            include: {
                name_prefixes: true,
                classroom_students: {
                    where: {
                        classroom_id: { in: validClassroomIds }
                    },
                    include: { classrooms: { include: { levels: true } } },
                    orderBy: { academic_year: 'desc' }
                },
                genders: true,
                student_statuses: true,
                behavior_records: {
                    orderBy: { created_at: 'desc' },
                    select: { 
                        points_awarded: true,
                        status: true,
                        reject_reason: true,
                        created_at: true 
                    }
                }
            },
            orderBy: { student_code: 'asc' }
        });

        if (students.length === 0 && year && !isNaN(year)) {
            console.log(`Fallback: No students for year ${year}, searching all years for these rooms`);
            students = await (prisma.students as any).findMany({
                where: {
                    classroom_students: {
                        some: {
                            classroom_id: { in: validClassroomIds }
                        }
                    }
                },
                include: {
                    name_prefixes: true,
                    classroom_students: {
                        where: {
                            classroom_id: { in: validClassroomIds }
                        },
                        include: { classrooms: { include: { levels: true } } },
                        orderBy: { academic_year: 'desc' }
                    },
                    genders: true,
                    student_statuses: true,
                    behavior_records: {
                        orderBy: { created_at: 'desc' },
                        select: { 
                            points_awarded: true,
                            status: true,
                            reject_reason: true,
                            created_at: true 
                        }
                    }
                },
                orderBy: { student_code: 'asc' }
            });
        }

        const mapped = (students as any[]).map((s: any) => {
            // Find the most relevant classroom record for this query
            let cs = s.classroom_students[0];
            if (classroom_id) {
                cs = s.classroom_students.find((rs: any) => rs.classroom_id === classroom_id) || cs;
            } else if (year) {
                cs = s.classroom_students.find((rs: any) => rs.academic_year === year) || cs;
            }

            const c = cs?.classrooms;
            const records = s.behavior_records || [];
            
            // Current Score (Sum of all APPROVED points)
            const behaviorScore = records
                .filter((r: any) => r.status === 'APPROVED')
                .reduce((acc: number, curr: any) => acc + (curr.points_awarded || 0), 100);
            
            // Latest record for status
            const latest = records[0]; // Already sorted by created_at DESC

            return {
                id: s.id,
                student_code: s.student_code,
                roll_number: cs?.roll_number,
                prefix: s.name_prefixes?.prefix_name || '',
                first_name: s.first_name,
                last_name: s.last_name,
                gender: s.genders?.name || '',
                class_level: c?.levels?.name || '',
                class_level_id: c?.grade_level_id,
                classroom_id: c?.id,
                room: c?.room_name || '',
                behavior_score: behaviorScore,
                latest_status: latest?.status || null,
                latest_reason: latest?.reject_reason || null
            };
        }).sort((a: any, b: any) => {
            // Sort by roll_number first (ASC, nulls at the end)
            const rollA = a.roll_number !== null && a.roll_number !== undefined ? Number(a.roll_number) : 999999;
            const rollB = b.roll_number !== null && b.roll_number !== undefined ? Number(b.roll_number) : 999999;
            
            if (rollA !== rollB) {
                return rollA - rollB;
            }
            
            // If roll_number same, sort by student_code (ASC)
            return a.student_code.localeCompare(b.student_code);
        });

        return mapped;
    },

    async recordBehavior(data: {
        student_id: number;
        behavior_type_id: number;
        reporter_user_id: number;
        points: number;
        note?: string;
        semester_id?: number;
        academic_year?: number;
        semester_number?: number;
    }) {
        let semester_id = data.semester_id;
        
        // If semester_id not provided, try to resolve it from year/semester
        if (!semester_id && data.academic_year && data.semester_number) {
            const sem = await prisma.semesters.findFirst({
                where: {
                    academic_years: { year_name: String(data.academic_year) },
                    semester_number: data.semester_number
                },
                select: { id: true }
            });
            semester_id = sem?.id;
        }

        // Determine if auto-approved (Director role)
        const user = await prisma.users.findUnique({
            where: { id: data.reporter_user_id },
            include: { 
                roles: true,
                teachers: {
                    include: { 
                        teacher_positions: true,
                        departments: true,
                    }
                }
            }
        });
        const isDirector = user?.roles?.role_name === 'director';
        const isDiscipline = 
            user?.teachers?.teacher_positions?.title?.includes('ปกครอง') ||
            (user?.teachers as any)?.departments?.department_name?.includes('ปกครอง') ||
            (user?.teachers as any)?.departments?.department_name?.includes('กิจการนักเรียน');
        const canAutoApprove = isDirector || isDiscipline;

        return prisma.behavior_records.create({
            data: {
                student_id: data.student_id,
                behavior_type_id: data.behavior_type_id,
                reporter_user_id: data.reporter_user_id,
                points_awarded: data.points,
                note: data.note,
                semester_id: semester_id,
                status: canAutoApprove ? 'APPROVED' : 'PENDING',
                incident_date: new Date(),
                approved_at: canAutoApprove ? new Date() : null,
                approved_by_user_id: canAutoApprove ? data.reporter_user_id : null
            }
        });
    },

    async getPendingRecords() {
        return prisma.behavior_records.findMany({
            where: { status: 'PENDING' },
            include: {
                students: {
                    include: {
                        name_prefixes: true,
                        classroom_students: {
                            include: { classrooms: { include: { levels: true } } },
                            orderBy: { academic_year: 'desc' },
                            take: 1
                        }
                    }
                },
                behavior_types: true,
                semesters: { include: { academic_years: true } }
            },
            orderBy: { created_at: 'desc' }
        });
    },

    async updateRecordStatus(params: {
        id: number;
        status: 'APPROVED' | 'REJECTED';
        user_id: number;
        reason?: string;
    }) {
        return prisma.behavior_records.update({
            where: { id: params.id },
            data: {
                status: params.status,
                approved_by_user_id: params.user_id,
                approved_at: new Date(),
                reject_reason: params.reason
            }
        });
    },

    async getStudentBehaviorHistory(studentId: number, userId: number, role: string) {
        const records = await prisma.behavior_records.findMany({
            where: {
                student_id: studentId
            },
            include: {
                behavior_types: true,
                semesters: { include: { academic_years: true } }
            },
            orderBy: { created_at: 'desc' }
        });

        // Collect all unique user IDs for reporters and approvers
        const userIds = Array.from(new Set([
            ...records.map(r => r.reporter_user_id),
            ...records.map(r => r.approved_by_user_id)
        ].filter((id): id is number => id !== null)));

        if (userIds.length === 0) return records;

        // Fetch users with their profiles
        const users = await prisma.users.findMany({
            where: { id: { in: userIds } },
            include: {
                teachers: { include: { name_prefixes: true } },
                students: { include: { name_prefixes: true } }
            }
        });

        // Create a map for easy lookup
        const userMap = new Map(users.map(u => [u.id, u]));

        const formatName = (user: any) => {
            if (!user) return null;
            if (user.teachers) {
                const t = user.teachers;
                return `${t.name_prefixes?.prefix_name || ''}${t.first_name} ${t.last_name}`;
            }
            if (user.students) {
                const s = user.students;
                return `${s.name_prefixes?.prefix_name || ''}${s.first_name} ${s.last_name}`;
            }
            return user.username;
        };

        return records.map(r => ({
            ...r,
            reporter_name: r.reporter_user_id ? formatName(userMap.get(r.reporter_user_id)) : null,
            approver_name: r.approved_by_user_id ? formatName(userMap.get(r.approved_by_user_id)) : null
        }));
    }
}
