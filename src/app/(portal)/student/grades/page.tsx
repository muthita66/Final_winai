import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { GradesFeature } from '@/features/student/components/GradesFeature';

export default async function GradesPage() {
    const session = await getSession() as any;
    if (!session || session.role !== 'student') {
        redirect('/login');
    }

    return (
        <GradesFeature session={session} />
    );
}
