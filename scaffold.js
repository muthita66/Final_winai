const fs = require('fs');
const path = require('path');

const pages = {
    student: ['activities', 'conduct', 'evaluation', 'grades', 'health', 'learning_results', 'profile', 'registration', 'schedule'],
    teacher: ['advisor_evaluation', 'attendance', 'calendar', 'exam_calendar', 'fitness', 'grade_cut', 'score_input', 'scores', 'student_profile', 'students', 'teaching_evaluation'],
    director: ['activities', 'advisors', 'curriculum', 'evaluation', 'finance', 'projects', 'student_count', 'students', 'subjects', 'teachers'],
};

const baseDir = path.join(__dirname, 'src', 'app', '(portal)');

Object.keys(pages).forEach(role => {
    pages[role].forEach(page => {
        const dir = path.join(baseDir, role, page);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const filePath = path.join(dir, 'page.tsx');
        if (!fs.existsSync(filePath)) {
            const content = `import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function ${page.charAt(0).toUpperCase() + page.slice(1).replace(/_([a-z])/g, (g) => g[1].toUpperCase())}Page() {
    const session = await getSession() as any;
    if (!session || session.role !== '${role}') {
        redirect('/login');
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-slate-800">หน้า ${page.replace('_', ' ')} (${role})</h1>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <p className="text-slate-600">กำลังโอนย้ายระบบมาเป็น Next.js สำหรับหน้านี้...</p>
            </div>
        </div>
    );
}
`;
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Created ${role}/${page}/page.tsx`);
        }
    });
});
