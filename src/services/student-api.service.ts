import { fetchApi } from './api-client';

export const StudentApiService = {
    // --- Dashboard ---
    async getDashboardSummary() {
        return fetchApi<any>('/api/student/dashboard');
    },

    // ---- Registration ----
    async searchSubjects(keyword: string, year?: number, semester?: number, class_level?: string, room?: string) {
        let url = `/api/student/registration/search?keyword=${encodeURIComponent(keyword)}`;
        if (year) url += `&year=${year}`;
        if (semester) url += `&semester=${semester}`;
        if (class_level) url += `&class_level=${encodeURIComponent(class_level)}`;
        if (room) url += `&room=${encodeURIComponent(room)}`;
        return fetchApi<any[]>(url);
    },

    async browseSubjects(year: number, semester: number, class_level: string, room: string) {
        const query = new URLSearchParams({
            year: year.toString(),
            semester: semester.toString(),
            class_level,
            room
        });
        return fetchApi<any[]>(`/api/student/registration/browse?${query.toString()}`);
    },

    async addToCart(section_id: number, year: number, semester: number) {
        return fetchApi<any>('/api/student/registration/add', {
            method: 'POST',
            body: JSON.stringify({ section_id, year, semester })
        });
    },

    async getCart(year: number, semester: number) {
        return fetchApi<any[]>(`/api/student/registration/cart?year=${year}&semester=${semester}`);
    },

    async getRegistered(year: number, semester: number) {
        return fetchApi<any[]>(`/api/student/registration/registered?year=${year}&semester=${semester}`);
    },

    async confirmCart(year: number, semester: number) {
        return fetchApi<any>('/api/student/registration/confirm', {
            method: 'POST',
            body: JSON.stringify({ year, semester })
        });
    },

    async removeCartItem(id: number) {
        return fetchApi<any>(`/api/student/registration/remove/${id}`, {
            method: 'DELETE'
        });
    },

    async getAdvisor(year?: number, semester?: number) {
        const params = new URLSearchParams();
        if (year && semester) {
            params.append("year", year.toString());
            params.append("semester", semester.toString());
        }
        return fetchApi<{ advisors: any[] }>(`/api/student/advisor?${params.toString()}`);
    },

    async getAdvisorTeacherEvaluationTemplate(teacher_id: number, year: number, semester: number) {
        const params = new URLSearchParams({
            action: "template",
            teacher_id: teacher_id.toString(),
            year: year.toString(),
            semester: semester.toString(),
        });
        return fetchApi<any>(`/api/student/advisor-evaluation?${params.toString()}`);
    },

    async submitAdvisorTeacherEvaluation(
        teacher_id: number,
        data: { name: string; score: number }[],
        year: number,
        semester: number,
        feedback: string
    ) {
        return fetchApi<any>('/api/student/advisor-evaluation', {
            method: 'POST',
            body: JSON.stringify({
                teacher_id,
                data,
                year,
                semester,
                feedback
            })
        });
    },

    // --- Schedule ---
    async getClassSchedule(year: number, semester: number) {
        return fetchApi<any[]>(`/api/student/schedule/class?year=${year}&semester=${semester}`);
    },

    async getExamSchedule(year: number, semester: number) {
        return fetchApi<any[]>(`/api/student/schedule/exam?year=${year}&semester=${semester}`);
    },

    // --- Profile ---
    async getProfile() {
        return fetchApi<any>(`/api/student/profile`);
    },

    async updateProfile(data: any) {
        return fetchApi<any>('/api/student/profile', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    // --- Grades ---
    async getGrades(year?: number, semester?: number) {
        const params = new URLSearchParams();
        if (year) params.append("year", year.toString());
        if (semester) params.append("semester", semester.toString());
        return fetchApi<any[]>(`/api/student/grades?${params.toString()}`);
    },

    // --- Health ---
    async getHealth() {
        return fetchApi<any>(`/api/student/health`);
    },

    async updateHealth(data: any) {
        return fetchApi<any>('/api/student/health', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    // --- Evaluation ---
    async getEvaluationTopics(year?: number, semester?: number) {
        const params = new URLSearchParams({ action: 'topics' });
        if (year) params.append("year", year.toString());
        if (semester) params.append("semester", semester.toString());
        return fetchApi<any[]>(`/api/student/evaluation?${params.toString()}`);
    },

    async getEvaluationStatus(year: number, semester: number, section_id?: number) {
        const params = new URLSearchParams({
            action: 'competency',
            year: year.toString(),
            semester: semester.toString()
        });
        if (section_id) params.append("section_id", section_id.toString());
        return fetchApi<any[]>(`/api/student/evaluation?${params.toString()}`);
    },

    async getEvaluatedSections(year: number, semester: number) {
        const params = new URLSearchParams({
            action: 'evaluated_sections',
            year: year.toString(),
            semester: semester.toString()
        });
        return fetchApi<number[]>(`/api/student/evaluation?${params.toString()}`);
    },

    async submitEvaluation(
        data: { name: string, score: number }[],
        year: number,
        semester: number,
        section_id: number | null,
        feedback: string
    ) {
        return fetchApi<any>('/api/student/evaluation', {
            method: 'POST',
            body: JSON.stringify({
                data,
                year,
                semester,
                section_id,
                feedback
            })
        });
    },

    // --- Learning Results ---
    async getAdvisorEvaluation(year: number, semester: number) {
        const params = new URLSearchParams({
            action: 'advisor_evaluation',
            year: year.toString(),
            semester: semester.toString()
        });
        return fetchApi<any[]>(`/api/student/learning-results?${params.toString()}`);
    },

    async getSubjectEvaluation(section_id: number, year: number, semester: number, subject_id?: number) {
        const params = new URLSearchParams({
            action: 'subject_evaluation',
            section_id: section_id.toString(),
            year: year.toString(),
            semester: semester.toString()
        });
        if (subject_id) params.append("subject_id", subject_id.toString());
        return fetchApi<any[]>(`/api/student/learning-results?${params.toString()}`);
    },

    // --- Conduct ---
    async getConductScore() {
        return fetchApi<any>(`/api/student/conduct?action=score`);
    },

    async getConductHistory() {
        return fetchApi<any[]>(`/api/student/conduct?action=history`);
    },

    // --- Activities ---
    async getAllActivities() {
        return fetchApi<any[]>('/api/student/activities');
    }
};
