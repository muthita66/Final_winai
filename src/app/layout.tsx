import './globals.css';
import { Inter } from 'next/font/google';
import Providers from '@/components/Providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
    title: 'WinAI School',
    description: 'ระบบจัดการโรงเรียน WinAI - ตรวจสอบเกรด ตารางเรียน สุขภาพ และอื่นๆ',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'WinAI School',
    },
};

export const viewport = {
    themeColor: '#4f46e5',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={`${inter.className} bg-slate-50 min-h-screen text-slate-800`}>
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
