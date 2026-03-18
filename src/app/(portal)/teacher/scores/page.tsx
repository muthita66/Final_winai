import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ScoresFeature } from '@/features/teacher/components/ScoresFeature';

export default async function TeacherScores() {
    const session = await getSession() as any;
    if (!session || session.role !== 'teacher') redirect('/login');
    return <ScoresFeature session={session} />;
}
