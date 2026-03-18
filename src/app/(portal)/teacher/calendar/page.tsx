import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { TeachingScheduleFeature } from '@/features/teacher/components/TeachingScheduleFeature';

export default async function TeacherCalendar() {
    const session = await getSession() as any;
    if (!session || session.role !== 'teacher') redirect('/login');
    return <TeachingScheduleFeature session={session} />;
}
