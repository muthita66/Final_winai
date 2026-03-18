import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CalendarFeature } from '@/features/teacher/components/CalendarFeature';

export default async function TeacherActivityCalendar() {
    const session = await getSession() as any;
    if (!session || session.role !== 'teacher') redirect('/login');
    return <CalendarFeature session={session} />;
}
