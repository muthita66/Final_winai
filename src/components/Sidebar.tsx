import Link from 'next/link';
import { getSession } from '@/lib/auth';
import SidebarNav from './SidebarNav';

export default async function Sidebar() {
    const session = await getSession();
    const role = session?.role || 'guest';

    // Dynamic Navigation Links mapping based on user role
    const roleLinks = {
        director: [
            { name: 'แดชบอร์ด', href: '/director/dashboard' },
            { name: 'จัดการครู', href: '/director/teachers' },
            { name: 'ข้อมูลนักเรียน', href: '/director/students' },
            { name: 'จัดการหลักสูตร', href: '/director/curriculum' },
            { name: 'โครงสร้างและรายวิชา', href: '/director/subjects' },
            { name: 'ครูที่ปรึกษา', href: '/director/advisors' },
            { name: 'โครงการและงบประมาณ', href: '/director/projects' },
            { name: 'กิจกรรม', href: '/director/activities' },
            { name: 'ผลการประเมิน', href: '/director/evaluation' },
            { name: 'บันทึกคะแนนพฤติกรรม', href: '/director/behavior' },
            { name: 'ข้อมูลทุก Actor', href: '/director/actors' },
        ],
        teacher: [
            { name: 'แดชบอร์ด', href: '/teacher/dashboard' },
            { name: 'ตารางสอน', href: '/teacher/calendar' },
            { name: 'รายชื่อนักเรียน', href: '/teacher/students' },
            { name: 'บันทึกเวลาเรียน', href: '/teacher/attendance' },
            { name: 'บันทึกสุขภาพ', href: '/teacher/fitness' },
            { name: 'ข้อมูลรายวิชา', href: '/teacher/scores' },
            { name: 'การประเมินนักเรียน', href: '/teacher/teaching_evaluation' },
            { name: 'ผลการประเมิน', href: '/teacher/advisor_evaluation' },
            { name: 'บันทึกคะแนนพฤติกรรม', href: '/teacher/behavior' },
            { name: 'ปฏิทินกิจกรรม', href: '/teacher/activity_calendar' },
        ],
        student: [
            { name: 'แดชบอร์ด', href: '/student/dashboard' },
            { name: 'ลงทะเบียนเรียน', href: '/student/registration' },
            { name: 'ตารางเรียน', href: '/student/schedule' },
            { name: 'ข้อมูลส่วนตัว', href: '/student/profile' },
            { name: 'ผลการศึกษา', href: '/student/grades' },
            { name: 'ผลประเมินสุขภาพ', href: '/student/health' },
            { name: 'การประเมิน', href: '/student/evaluation' },
            { name: 'ผลการประเมิน', href: '/student/learning_results' },
            { name: 'ผลคะแนนพฤติกรรม', href: '/student/conduct' },
            { name: 'ปฏิทินกิจกรรม', href: '/student/activities' },
        ],
        guest: [
            { name: 'เข้าสู่ระบบ', href: '/login' },
        ]
    };

    const links = roleLinks[role as keyof typeof roleLinks] || roleLinks.guest;

    return (
        <aside className="fixed left-0 top-16 bottom-0 w-64 bg-slate-50 border-r border-slate-200 p-4 flex flex-col transition-transform duration-300">
            <SidebarNav links={links} />

            <div className="p-4 mt-auto border-t border-slate-200 text-xs text-slate-400 text-center">
                Powered by Next.js & Prisma
            </div>
        </aside>
    );
}
