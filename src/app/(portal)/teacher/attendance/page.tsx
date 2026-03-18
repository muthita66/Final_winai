import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AttendanceFeature } from '@/features/teacher/components/AttendanceFeature';

export default async function TeacherAttendance() {
    const session = await getSession() as any;
    if (!session || session.role !== 'teacher') redirect('/login');
    return <AttendanceFeature session={session} />;
}
