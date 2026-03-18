import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { StudentProfileFeature } from '@/features/teacher/components/StudentProfileFeature';

export default async function TeacherStudentProfile() {
    const session = await getSession() as any;
    if (!session || session.role !== 'teacher') redirect('/login');
    return <StudentProfileFeature session={session} />;
}
