import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { GradeCutFeature } from '@/features/teacher/components/GradeCutFeature';

export default async function TeacherGradeCut() {
    const session = await getSession() as any;
    if (!session || session.role !== 'teacher') redirect('/login');
    return <GradeCutFeature session={session} />;
}
