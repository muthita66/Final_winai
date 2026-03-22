"use client";

import { useState, useEffect } from "react";
import { StudentApiService } from "@/services/student-api.service";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Skeleton } from "@/components/Skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface ProfileFeatureProps {
    session: any;
}

export function ProfileFeature({ session }: ProfileFeatureProps) {
    const student = session;
    const router = useRouter();

    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);

    // Queries
    const profileQuery = useQuery({
        queryKey: ["student", "profile"],
        queryFn: () => StudentApiService.getProfile(),
    });

    const advisorQuery = useQuery({
        queryKey: ["student", "advisor", "latest"],
        queryFn: () => StudentApiService.getAdvisor(),
    });

    // Mutation
    const updateProfileMutation = useMutation({
        mutationFn: (data: any) => StudentApiService.updateProfile(data),
        onSuccess: (updatedProfile: any) => {
            queryClient.setQueryData(["student", "profile"], updatedProfile);
            queryClient.invalidateQueries({ queryKey: ["student", "profile"] });
            setIsEditing(false);
            toast.success("อัปเดตข้อมูลส่วนตัวสำเร็จ");
        },
        onError: (error: any) => {
            console.error("Failed to update profile", error);
            toast.error("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่");
        },
    });

    // Form State (Sync with query data)
    const [formData, setFormData] = useState({
        prefix: "",
        first_name: "",
        last_name: "",
        birthday: "",
        phone: "",
        address: ""
    });

    useEffect(() => {
        if (profileQuery.data) {
            const birthdayValue = (profileQuery.data as any).birthday || (profileQuery.data as any).date_of_birth;
            setFormData({
                prefix: profileQuery.data.prefix || "",
                first_name: profileQuery.data.first_name || "",
                last_name: profileQuery.data.last_name || "",
                birthday: birthdayValue ? new Date(birthdayValue).toISOString().split('T')[0] : "",
                phone: profileQuery.data.phone || "",
                address: profileQuery.data.address || ""
            });
        }
    }, [profileQuery.data]);

    const profile = profileQuery.data;
    const isLoading = profileQuery.isLoading || advisorQuery.isLoading;
    const fetchError = profileQuery.error ? (profileQuery.error as any).message : null;

    // Process advisor data
    const getAdvisors = () => {
        if (advisorQuery.isLoading) return ["กำลังโหลด..."];
        if (advisorQuery.error) return ["-"];

        const advDataAny = advisorQuery.data as any;
        const advisorsList = advDataAny?.advisors || (advDataAny?.advisor ? [advDataAny.advisor] : []);

        if (advisorsList.length > 0) {
            return advisorsList.map((a: any) => `${a.teacher_code || ""} ${a.first_name || ""} ${a.last_name || ""}`.trim());
        }
        return ["-"];
    };

    const advisors = getAdvisors();

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        updateProfileMutation.mutate(formData);
    };

    const formatThaiDate = (dateStr: string) => {
        if (!dateStr) return "-";
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return "-";
        return date.toLocaleDateString("th-TH-u-ca-buddhist", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    };

    const getFullDisplayName = (p: any) => {
        const name = [p.prefix, p.first_name, p.last_name].filter(Boolean).join(' ').trim();
        return name || p.student_code || "-";
    };

    const getLevelRoomDisplay = (p: any) => {
        const classLevel = String(p?.class_level || "").trim();
        const room = String(p?.room || "").trim();

        if (!classLevel && !room) return "-";
        if (!room) return classLevel || "-";
        if (!classLevel) return room;
        if (room === classLevel || room.startsWith(`${classLevel}/`)) return room;

        return `${classLevel}/${room}`;
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="bg-gradient-to-br from-teal-800 to-teal-900 rounded-3xl p-8 shadow-lg">
                    <Skeleton variant="rounded" className="h-6 w-20 mb-4 bg-white/20" />
                    <Skeleton variant="rounded" className="h-8 w-48 mb-2 bg-white/20" />
                    <Skeleton variant="rounded" className="h-4 w-72 bg-white/20" />
                </div>
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <div key={i}>
                                <Skeleton variant="rounded" className="h-4 w-24 mb-2" />
                                <Skeleton variant="rounded" className="h-10 w-full" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (fetchError || !profile) {
        return (
            <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 text-center text-red-500">
                <p>{fetchError || "ไม่พบข้อมูลนักเรียน"}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Hero Section */}
            <section className="bg-gradient-to-br from-teal-800 to-teal-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row gap-6 items-center">
                <div className="relative z-10 flex-1 text-center md:text-left">
                    <div className="inline-block bg-white/20 px-3 py-0.5 rounded-full text-xs font-medium mb-2 backdrop-blur-sm border border-white/20">
                        Profile
                    </div>
                    <h1 className="text-2xl font-bold mb-1">ข้อมูลส่วนตัว</h1>
                    <p className="text-teal-200 text-sm">
                        อัปเดตข้อมูลส่วนตัวให้เป็นปัจจุบัน
                    </p>
                </div>

                <div className="relative z-10 flex gap-4">
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 min-w-[140px]">
                        <div className="text-teal-200 text-xs mb-1">รหัสนักเรียน</div>
                        <div className="text-xl font-bold tracking-tight">{profile.student_code || "-"}</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 min-w-[120px]">
                        <div className="text-teal-200 text-xs mb-1">ระดับ/ห้อง</div>
                        <div className="text-lg font-bold mt-1 tracking-tight">
                            {getLevelRoomDisplay(profile)}
                        </div>
                    </div>
                </div>

                {/* Decoration */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                    <div className="absolute -top-24 -left-24 w-64 h-64 bg-teal-500 rounded-full blur-3xl opacity-30"></div>
                    <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-teal-500 rounded-full blur-3xl opacity-40"></div>
                </div>
            </section>

            {/* Profile Info Grid */}
            <section className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">ข้อมูลพื้นฐาน</h3>
                    </div>
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="text-sm font-medium text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            แก้ไขข้อมูล
                        </button>
                    )}
                </div>

                {!isEditing ? (
                    <div className="w-full">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            <div className="flex gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
                                <div className="bg-white w-10 h-10 rounded-full flex items-center justify-center text-teal-500 shadow-sm shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                </div>
                                <div>
                                    <div className="text-sm text-slate-500 font-medium mb-1">ชื่อ-นามสกุล</div>
                                    <div className="text-slate-800 font-semibold">{getFullDisplayName(profile)}</div>
                                </div>
                            </div>

                            <div className="flex gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
                                <div className="bg-white w-10 h-10 rounded-full flex items-center justify-center text-teal-500 shadow-sm shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                </div>
                                <div>
                                    <div className="text-sm text-slate-500 font-medium mb-1">ครูที่ปรึกษา</div>
                                    <div className="text-slate-800 font-semibold space-y-1">
                                        {advisors.map((adv: string, idx: number) => (
                                            <div key={idx} className="block">{adv}</div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
                                <div className="bg-white w-10 h-10 rounded-full flex items-center justify-center text-pink-500 shadow-sm shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" /></svg>
                                </div>
                                <div>
                                    <div className="text-sm text-slate-500 font-medium mb-1">วันเกิด</div>
                                    <div className="text-slate-800 font-semibold">{formatThaiDate((profile as any).birthday || (profile as any).date_of_birth)}</div>
                                </div>
                            </div>

                            <div className="flex gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
                                <div className="bg-white w-10 h-10 rounded-full flex items-center justify-center text-green-500 shadow-sm shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                </div>
                                <div>
                                    <div className="text-sm text-slate-500 font-medium mb-1">เบอร์โทรติดต่อ</div>
                                    <div className="text-slate-800 font-semibold">{profile.phone || "-"}</div>
                                </div>
                            </div>

                            <div className="col-span-1 md:col-span-2 flex gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
                                <div className="bg-white w-10 h-10 rounded-full flex items-center justify-center text-rose-500 shadow-sm shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                </div>
                                <div>
                                    <div className="text-sm text-slate-500 font-medium mb-1">ที่อยู่ปัจจุบัน</div>
                                    <div className="text-slate-800 font-semibold">{profile.address || "-"}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-2">คำนำหน้าชื่อ</label>
                                <select
                                    name="prefix"
                                    value={formData.prefix}
                                    onChange={handleInputChange}
                                    className="w-full md:w-1/3 border border-slate-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                                >
                                    <option value={""}>{"\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E04\u0E33\u0E19\u0E33\u0E2B\u0E19\u0E49\u0E32"}</option>
                                    <option value={"\u0E40\u0E14\u0E47\u0E01\u0E0A\u0E32\u0E22"}>{"\u0E40\u0E14\u0E47\u0E01\u0E0A\u0E32\u0E22"}</option>
                                    <option value={"\u0E40\u0E14\u0E47\u0E01\u0E2B\u0E0D\u0E34\u0E07"}>{"\u0E40\u0E14\u0E47\u0E01\u0E2B\u0E0D\u0E34\u0E07"}</option>
                                    <option value={"\u0E19\u0E32\u0E22"}>{"\u0E19\u0E32\u0E22"}</option>
                                    <option value={"\u0E19\u0E32\u0E07\u0E2A\u0E32\u0E27"}>{"\u0E19\u0E32\u0E07\u0E2A\u0E32\u0E27"}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">ชื่อ</label>
                                <input
                                    type="text"
                                    name="first_name"
                                    value={formData.first_name}
                                    onChange={handleInputChange}
                                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">นามสกุล</label>
                                <input
                                    type="text"
                                    name="last_name"
                                    value={formData.last_name}
                                    onChange={handleInputChange}
                                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">วันเกิด</label>
                                <input
                                    type="date"
                                    name="birthday"
                                    value={formData.birthday}
                                    onChange={handleInputChange}
                                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">เบอร์โทรศัพท์</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                />
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-2">ที่อยู่ปัจจุบัน</label>
                                <textarea
                                    name="address"
                                    value={formData.address}
                                    onChange={handleInputChange}
                                    rows={3}
                                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 border-t border-slate-200 pt-6">
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                disabled={updateProfileMutation.isPending}
                                className="px-6 py-2.5 rounded-xl text-slate-600 font-medium hover:bg-slate-200 transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="submit"
                                disabled={updateProfileMutation.isPending}
                                className="px-6 py-2.5 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors shadow-sm flex items-center justify-center gap-2 min-w-[120px]"
                            >
                                {updateProfileMutation.isPending ? (
                                    <>
                                        <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        กำลังบันทึก...
                                    </>
                                ) : "บันทึกข้อมูล"}
                            </button>
                        </div>
                    </form>
                )}
            </section>
        </div>
    );
}
