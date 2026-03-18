import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ScheduleFeature } from '@/features/student/components/ScheduleFeature';

export default async function SchedulePage() {
    const session = await getSession() as any;
    if (!session || session.role !== 'student') {
        redirect('/login');
    }

    return (
        <ScheduleFeature session={session} />
    );
}
