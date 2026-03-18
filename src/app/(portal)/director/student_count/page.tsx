import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { StudentCountFeature } from '@/features/director/components/StudentCountFeature';

export default async function DirectorStudentCount() {
    const session = await getSession() as any;
    if (!session || session.role !== 'director') redirect('/login');
    return <StudentCountFeature />;
}
