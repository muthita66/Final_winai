import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardFeature } from '@/features/director/components/DashboardFeature';

export default async function DirectorDashboard() {
    const session = await getSession() as any;
    if (!session || session.role !== 'director') redirect('/login');
    return <DashboardFeature session={session} />;
}
