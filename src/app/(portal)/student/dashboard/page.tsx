import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardFeature } from '@/features/student/components/DashboardFeature';

export default async function StudentDashboard() {
    const session = await getSession() as {
        role?: string;
        name?: string;
        code?: string;
        class_level?: string;
        room?: string;
    } | null;
    if (!session || session.role !== 'student') {
        redirect('/login');
    }

    return <DashboardFeature session={session} />;
}
