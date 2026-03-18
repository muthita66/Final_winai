import { prisma } from '@/lib/prisma';

type AttendanceRecordInput = { enrollment_id: number; status: string; remark?: string };
type UiAttendanceRecordInput = { student_id: number; section_id: number; date: string; status: string; remark?: string };

export const TeacherAttendanceService = {
    async getAttendanceList(teacher_id: number, teaching_assignment_id: number, date: string) {
        // Get students enrolled in this teaching assignment
        const enrollments = await prisma.enrollments.findMany({
            where: { teaching_assignment_id },
            include: {
                students: {
                    include: { name_prefixes: true }
                }
            },
            distinct: ['student_id']
        });

        // Find or create attendance session for this date
        let session = await prisma.attendance_sessions.findFirst({
            where: {
                teaching_assignment_id,
                session_date: new Date(date),
            }
        });

        // Get existing records if session exists
        let existingRecords: any[] = [];
        if (session) {
            existingRecords = await prisma.attendance_records.findMany({
                where: { attendance_session_id: session.id }
            });
        }

        return enrollments.map(e => {
            const student = e.students;
            if (!student) return null;
            const record = existingRecords.find(r => r.enrollment_id === e.id);
            return {
                enrollment_id: e.id,
                student_id: student.id,
                student_code: student.student_code,
                prefix: student.name_prefixes?.prefix_name || '',
                first_name: student.first_name,
                last_name: student.last_name,
                status: record?.status || null,
                remark: record?.remark || '',
                record_id: record?.id || null,
            };
        }).filter(Boolean);
    },

    async saveAttendance(
        teaching_assignment_id: number | UiAttendanceRecordInput[],
        date?: string,
        records?: AttendanceRecordInput[]
    ): Promise<{ success: boolean; count?: number }> {
        if (Array.isArray(teaching_assignment_id)) {
            const uiRecords = teaching_assignment_id;
            if (uiRecords.length === 0) return { success: true, count: 0 };

            const first = uiRecords[0];
            const sectionId = Number(first.section_id);
            const sessionDate = String(first.date || '').trim();
            if (!sectionId || Number.isNaN(sectionId)) throw new Error('section_id required');
            if (!sessionDate) throw new Error('date required');

            const enrollments = await prisma.enrollments.findMany({
                where: {
                    teaching_assignment_id: sectionId,
                    student_id: { in: uiRecords.map((r) => Number(r.student_id)).filter((n) => Number.isFinite(n)) },
                },
                select: { id: true, student_id: true },
            });
            const enrollmentMap = new Map<number, number>();
            enrollments.forEach((e) => enrollmentMap.set(e.student_id, e.id));

            const normalizedRecords: AttendanceRecordInput[] = [];
            uiRecords.forEach((r) => {
                    const enrollment_id = enrollmentMap.get(Number(r.student_id));
                    if (!enrollment_id) return;
                    normalizedRecords.push({
                        enrollment_id,
                        status: String(r.status || 'present'),
                        remark: r.remark,
                    });
                });

            return this.saveAttendance(sectionId, sessionDate, normalizedRecords);
        }

        const taId = Number(teaching_assignment_id);
        if (!taId || Number.isNaN(taId)) throw new Error('teaching_assignment_id required');
        if (!date) throw new Error('date required');
        const normalized = Array.isArray(records) ? records : [];

        return this.saveAttendanceByEnrollment(taId, date, normalized);
    },

    async saveAttendanceByEnrollment(
        teaching_assignment_id: number,
        date: string,
        records: AttendanceRecordInput[]
    ) {
        // Find or create session
        let session = await prisma.attendance_sessions.findFirst({
            where: {
                teaching_assignment_id,
                session_date: new Date(date),
            }
        });

        if (!session) {
            session = await prisma.attendance_sessions.create({
                data: {
                    teaching_assignment_id,
                    session_date: new Date(date),
                }
            });
        }

        // Upsert records
        for (const rec of records) {
            const existing = await prisma.attendance_records.findFirst({
                where: {
                    attendance_session_id: session.id,
                    enrollment_id: rec.enrollment_id,
                }
            });

            if (existing) {
                await prisma.attendance_records.update({
                    where: { id: existing.id },
                    data: { status: rec.status, remark: rec.remark || null }
                });
            } else {
                await prisma.attendance_records.create({
                    data: {
                        attendance_session_id: session.id,
                        enrollment_id: rec.enrollment_id,
                        status: rec.status,
                        remark: rec.remark || null,
                    }
                });
            }
        }

        return { success: true };
    },
};
