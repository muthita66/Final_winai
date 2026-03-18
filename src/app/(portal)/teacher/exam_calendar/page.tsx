import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ExamCalendarFeature } from '@/features/teacher/components/ExamCalendarFeature';

export default async function TeacherExamCalendar() {
    const session = await getSession() as any;
    if (!session || session.role !== 'teacher') redirect('/login');
    return <ExamCalendarFeature session={session} />;
}
