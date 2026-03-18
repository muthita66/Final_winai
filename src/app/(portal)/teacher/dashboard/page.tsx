import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardFeature } from '@/features/teacher/components/DashboardFeature';

export default async function TeacherDashboard() {
    const session = await getSession() as any;
    if (!session || session.role !== 'teacher') redirect('/login');
    return <DashboardFeature session={session} />;
}
