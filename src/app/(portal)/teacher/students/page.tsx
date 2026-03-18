import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { StudentsFeature } from '@/features/teacher/components/StudentsFeature';

export default async function TeacherStudents() {
    const session = await getSession() as any;
    if (!session || session.role !== 'teacher') redirect('/login');
    return <StudentsFeature session={session} />;
}
