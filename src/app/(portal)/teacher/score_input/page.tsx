import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ScoreInputFeature } from '@/features/teacher/components/ScoreInputFeature';

export default async function TeacherScoreInput() {
    const session = await getSession() as any;
    if (!session || session.role !== 'teacher') redirect('/login');
    return <ScoreInputFeature session={session} />;
}
