import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { TeachingEvaluationFeature } from '@/features/teacher/components/TeachingEvaluationFeature';

export default async function TeacherTeachingEvaluation() {
    const session = await getSession() as any;
    if (!session || session.role !== 'teacher') redirect('/login');
    return <TeachingEvaluationFeature session={session} />;
}
