"use client";

import { useState } from "react";
import { AdvisorTeacherEvaluationFeature } from "@/features/student/components/AdvisorTeacherEvaluationFeature";
import { LearningResultsFeature } from "@/features/student/components/LearningResultsFeature";

interface AdvisorEvaluationHubFeatureProps {
    session: { [key: string]: unknown };
}

export function AdvisorEvaluationHubFeature({ session }: AdvisorEvaluationHubFeatureProps) {
    const [activeTab, setActiveTab] = useState<"evaluate_teacher" | "teacher_result">("evaluate_teacher");

    return (
        <div className="space-y-4">
            <section className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
                <div className="inline-flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab("evaluate_teacher")}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "evaluate_teacher"
                            ? "bg-teal-600 text-white"
                            : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                            }`}
                    >
                        ประเมินครู
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("teacher_result")}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "teacher_result"
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                            }`}
                    >
                        ผลประเมินจากครู
                    </button>
                </div>
            </section>

            {activeTab === "evaluate_teacher" ? (
                <AdvisorTeacherEvaluationFeature session={session} />
            ) : (
                <LearningResultsFeature
                    session={session}
                    initialTab="advisor"
                    hideResultTabs
                />
            )}
        </div>
    );
}
