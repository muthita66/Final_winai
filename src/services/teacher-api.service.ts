import { fetchApi } from './api-client';

export const TeacherApiService = {
    // --- Dashboard ---
    async getDashboardSummary(teacher_id?: number) {
        const params = new URLSearchParams({ action: 'summary' });
        if (teacher_id) params.set('teacher_id', String(teacher_id));
        return fetchApi<any>(`/api/teacher/dashboard?${params.toString()}`);
    },

    // --- Teaching Schedule ---
    async getTeachingSchedule(teacher_id: number) {
        return fetchApi<any[]>(`/api/teacher/teaching-schedule?teacher_id=${teacher_id}`);
    },

    // --- Activity Calendar ---
    async getCalendarEvents() {
        return fetchApi<any[]>('/api/teacher/calendar');
    },
    async getDepartments() {
        return fetchApi<any[]>('/api/teacher/calendar?action=departments');
    },
    async getEventTypes() {
        return fetchApi<any[]>('/api/teacher/calendar?action=event-types');
    },
    async getTargetTypes() {
        return fetchApi<any[]>('/api/teacher/calendar?action=target-types');
    },
    async getTargetOptions(targetType: string) {
        return fetchApi<any[]>(`/api/options/targets?targetType=${targetType}`);
    },
    async addCalendarEvent(data: {
        title: string;
        description?: string;
        event_date: string;
        start_time?: string;
        end_date?: string;
        end_time?: string;
        responsible_teacher_id?: number | null;
        location?: string | null;
        visibility?: string;
        userId?: number | null;
        department_id?: number | null;
        event_type_id?: number | null;
        semester_id?: number | null;
        targets?: { target_type: string; target_value?: string | null }[];
    }) {
        return fetchApi<any>('/api/teacher/calendar', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateCalendarEvent(id: number, data: {
        title?: string;
        description?: string;
        event_date?: string;
        start_time?: string;
        end_date?: string;
        end_time?: string;
        responsible_teacher_id?: number | null;
        location?: string | null;
        visibility?: string;
        department_id?: number | null;
        event_type_id?: number | null;
        semester_id?: number | null;
        targets?: { target_type: string; target_value?: string | null }[];
    }) {
        return fetchApi<any>('/api/teacher/calendar', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
    },
    async deleteCalendarEvent(id: number) {
        return fetchApi<any>(`/api/teacher/calendar?action=delete&id=${id}`, { method: 'DELETE' });
    },

    // --- Exam Calendar ---
    async getExamSchedule(teacher_id: number) {
        return fetchApi<any[]>(`/api/teacher/exam-calendar?teacher_id=${teacher_id}`);
    },

    // --- Students (advisor) ---
    async getAdvisoryStudents(teacher_id: number, year?: number, semester?: number, sub_mode: string = 'attributes') {
        const params = new URLSearchParams();
        params.set('teacher_id', String(teacher_id));
        if (year) params.set('year', String(year));
        if (semester) params.set('semester', String(semester));
        params.set('sub_mode', sub_mode);
        return fetchApi<any[]>(`/api/teacher/students?${params.toString()}`);
    },

    // --- Student Profile ---
    async getStudentProfile(student_id: number, teacher_id?: number) {
        const params = new URLSearchParams();
        params.set('student_id', String(student_id));
        if (teacher_id) params.set('teacher_id', String(teacher_id));
        return fetchApi<any>(`/api/teacher/student-profile?${params.toString()}`);
    },
    async getStudentAdvisorEvaluationTemplate(student_id: number, teacher_id: number, year: number, semester: number, sub_mode: string = 'attributes') {
        const params = new URLSearchParams({
            student_id: String(student_id),
            teacher_id: String(teacher_id),
            year: String(year),
            semester: String(semester),
            sub_mode,
        });
        return fetchApi<any>(`/api/teacher/student-profile/advisor-evaluation?${params.toString()}`);
    },
    async saveStudentAdvisorEvaluation(payload: {
        student_id: number;
        teacher_id: number;
        year: number;
        semester: number;
        data: { name: string; score: number }[];
        feedback?: string;
        sub_mode?: string;
    }) {
        return fetchApi<any>('/api/teacher/student-profile/advisor-evaluation', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },
    async uploadStudentPhoto(student_id: number, teacher_id: number, file: File) {
        const formData = new FormData();
        formData.set('student_id', String(student_id));
        formData.set('teacher_id', String(teacher_id));
        formData.set('file', file);

        const response = await fetch('/api/teacher/student-profile/photo', {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();
        if (!response.ok || !data?.success) {
            throw new Error(data?.message || 'Failed to upload photo');
        }
        return data.data as { photo_url: string };
    },
    async deleteStudentPhoto(student_id: number, teacher_id: number) {
        const params = new URLSearchParams({
            student_id: String(student_id),
            teacher_id: String(teacher_id),
        });
        return fetchApi<any>(`/api/teacher/student-profile/photo?${params.toString()}`, {
            method: 'DELETE',
        });
    },

    // --- Scores ---
    async getTeacherSubjects(teacher_id: number) {
        return fetchApi<any[]>(`/api/teacher/scores?action=subjects&teacher_id=${teacher_id}`);
    },
    async getScoreHeaders(section_id: number) {
        return fetchApi<any[]>(`/api/teacher/scores?action=headers&section_id=${section_id}`, { cache: 'no-store' });
    },
    async getSectionStudents(section_id: number) {
        return fetchApi<any[]>(`/api/teacher/scores?action=students&section_id=${section_id}`);
    },
    async getScores(header_id: number) {
        return fetchApi<any[]>(`/api/teacher/scores?action=scores&header_id=${header_id}`);
    },
    async getSectionScores(section_id: number) {
        return fetchApi<any[]>(`/api/teacher/scores?action=all_scores&section_id=${section_id}`);
    },
    async getIndicators(subject_id: number) {
        return fetchApi<any[]>(`/api/teacher/scores?action=indicators&subject_id=${subject_id}`);
    },
    async getScoreCategories(section_id: number) {
        return fetchApi<any[]>(`/api/teacher/scores?action=categories&section_id=${section_id}`);
    },
    async getGradeCategoryTypes() {
        return fetchApi<any[]>('/api/teacher/scores?action=category_types');
    },
    async addGradeCategoryType(type_name: string) {
        return fetchApi<any>('/api/teacher/scores', {
            method: 'POST',
            body: JSON.stringify({ action: 'category_type_add', type_name })
        });
    },
    async updateGradeCategoryType(id: number, type_name: string) {
        return fetchApi<any>('/api/teacher/scores', {
            method: 'POST',
            body: JSON.stringify({ action: 'category_type_update', id, type_name })
        });
    },
    async deleteGradeCategoryType(id: number) {
        return fetchApi<any>('/api/teacher/scores', {
            method: 'POST',
            body: JSON.stringify({ action: 'category_type_delete', id })
        });
    },
    async addScoreCategory(section_id: number, name: string, weight_percent: number, category_type_id?: number) {
        return fetchApi<any>('/api/teacher/scores', {
            method: 'POST',
            body: JSON.stringify({ action: 'category_add', section_id, name, weight_percent, category_type_id })
        });
    },
    async updateScoreCategory(id: number, name: string, weight_percent: number, category_type_id?: number) {
        return fetchApi<any>('/api/teacher/scores', {
            method: 'POST',
            body: JSON.stringify({ action: 'category_update', id, name, weight_percent, category_type_id })
        });
    },
    async deleteScoreCategory(id: number) {
        return fetchApi<any>('/api/teacher/scores', { 
            method: 'POST', 
            body: JSON.stringify({ action: 'category_delete', id }) 
        });
    },
    async addScoreHeader(section_id: number, header_name: string, max_score: number, indicator_ids?: number[], category_id?: number) {
        return fetchApi<any>('/api/teacher/scores', {
            method: 'POST',
            body: JSON.stringify({ action: 'header_add', section_id, header_name, max_score, indicator_ids, category_id })
        });
    },
    async updateScoreHeader(id: number, title: string, max_score: number, indicator_ids?: number[], category_id?: number) {
        return fetchApi<any>('/api/teacher/scores', {
            method: 'POST',
            body: JSON.stringify({ action: 'header_update', id, title, max_score, indicator_ids, category_id })
        });
    },
    async deleteScoreHeader(id: number) {
        return fetchApi<any>('/api/teacher/scores', { 
            method: 'POST', 
            body: JSON.stringify({ action: 'header_delete', id }) 
        });
    },
    async saveScores(header_id: number, scores: { student_id: number; score: number; is_passed?: boolean | null }[]) {
        return fetchApi<any>('/api/teacher/scores', {
            method: 'POST',
            body: JSON.stringify({ action: 'save', header_id, scores })
        });
    },

    // --- Grade Cut ---
    async getGradeThresholds(section_id: number) {
        return fetchApi<any>(`/api/teacher/grade-cut?action=thresholds&section_id=${section_id}`, { cache: 'no-store' });
    },
    async getGradeSummary(section_id: number) {
        return fetchApi<any[]>(`/api/teacher/grade-cut?action=summary&section_id=${section_id}`, { cache: 'no-store' });
    },
    async saveGradeThresholds(section_id: number, thresholds: any) {
        return fetchApi<any>('/api/teacher/grade-cut', {
            method: 'POST',
            body: JSON.stringify({ action: 'save_thresholds', section_id, thresholds })
        });
    },
    async resetGradeThresholds(section_id: number) {
        return fetchApi<any>('/api/teacher/grade-cut', {
            method: 'POST',
            body: JSON.stringify({ action: 'reset_thresholds', section_id })
        });
    },
    async calculateGrades(section_id: number) {
        return fetchApi<any>('/api/teacher/grade-cut', {
            method: 'POST',
            body: JSON.stringify({ action: 'calculate', section_id })
        });
    },
    async getGradeScaleGroups() {
        return fetchApi<any[]>('/api/teacher/grade-cut?action=scale_groups&section_id=1'); // section_id is just a placeholder to pass validation if any, but service doesn't use it for this action
    },
    async selectGradeScaleGroup(section_id: number, group_id: number | null) {
        return fetchApi<any>('/api/teacher/grade-cut', {
            method: 'POST',
            body: JSON.stringify({ action: 'select_scale_group', section_id, group_id })
        });
    },

    // --- Fitness ---
    async getAcademicYears() {
        return fetchApi<any[]>('/api/teacher/fitness?action=years');
    },
    async getAdvisorClasses(teacher_id: number) {
        return fetchApi<any[]>(`/api/teacher/fitness?action=advisor-classes&teacher_id=${teacher_id}`);
    },
    async getFitnessCriteria(test_name: string, class_level: string, year?: number) {
        const params = new URLSearchParams({ action: 'criteria', test_name, class_level });
        if (year) params.set('year', year.toString());
        return fetchApi<any>(`/api/teacher/fitness?${params.toString()}`);
    },
    async getAllFitnessCriteria(filters?: { test_name?: string; class_level?: string; year?: number }) {
        const params = new URLSearchParams({ action: 'list-all-criteria' });
        if (filters?.test_name) params.set('test_name', filters.test_name);
        if (filters?.class_level) params.set('class_level', filters.class_level);
        if (filters?.year) params.set('year', filters.year.toString());
        return fetchApi<any[]>(`/api/teacher/fitness?${params.toString()}`);
    },
    async upsertFitnessCriteria(data: any) {
        return fetchApi<any>('/api/teacher/fitness', {
            method: 'POST',
            body: JSON.stringify({ action: 'upsert-criteria', ...data })
        });
    },
    async deleteFitnessCriteria(id: number) {
        return fetchApi<any>('/api/teacher/fitness', {
            method: 'POST',
            body: JSON.stringify({ action: 'delete-criteria', id })
        });
    },
    async getFitnessStudents(teacher_id: number, class_level: string, room: string, year?: number, semester?: number | string) {
        const params = new URLSearchParams({ action: 'students', teacher_id: String(teacher_id), class_level, room });
        if (year) params.set('year', String(year));
        if (semester && semester !== 'all') params.set('semester', String(semester));
        return fetchApi<any[]>(`/api/teacher/fitness?${params.toString()}`);
    },
    async saveFitnessTest(data: any) {
        return fetchApi<any>('/api/teacher/fitness', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    // --- Attendance ---
    async getAttendanceStudents(teacher_id: number, section_id: number, date: string) {
        return fetchApi<any[]>(`/api/teacher/attendance?action=list&teacher_id=${teacher_id}&section_id=${section_id}&date=${date}`);
    },
    async saveAttendance(data: any[]) {
        return fetchApi<any>('/api/teacher/attendance', {
            method: 'POST',
            body: JSON.stringify({ records: data })
        });
    },

    // --- Teaching Evaluation ---
    async getTeachingEvaluation(teacher_id: number, year?: number, semester?: number) {
        const params = new URLSearchParams();
        params.set('teacher_id', String(teacher_id));
        if (year) params.set('year', String(year));
        if (semester) params.set('semester', String(semester));
        return fetchApi<any[]>(`/api/teacher/teaching-evaluation?${params.toString()}`);
    },

    async getTeachingEvaluationDetailed(teacher_id: number, section_id?: number, year?: number, semester?: number) {
        const params = new URLSearchParams({ action: 'results' });
        params.append("teacher_id", teacher_id.toString());
        if (section_id) params.append("section_id", section_id.toString());
        if (year) params.append("year", year.toString());
        if (semester) params.append("semester", semester.toString());
        return fetchApi<any>(`/api/teacher/teaching-evaluation?${params.toString()}`);
    },

    async getSectionStudentsForEvaluation(teacher_id: number, section_id: number, year: number, semester: number) {
        const params = new URLSearchParams({ action: 'students' });
        params.append("teacher_id", teacher_id.toString());
        params.append("section_id", section_id.toString());
        params.append("year", year.toString());
        params.append("semester", semester.toString());
        return fetchApi<any[]>(`/api/teacher/teaching-evaluation?${params.toString()}`);
    },

    async getTeachingStudentEvaluationResults(teacher_id: number, section_id: number, year: number, semester: number) {
        const params = new URLSearchParams({ action: 'student-results' });
        params.append("teacher_id", teacher_id.toString());
        params.append("section_id", section_id.toString());
        params.append("year", year.toString());
        params.append("semester", semester.toString());
        return fetchApi<any[]>(`/api/teacher/teaching-evaluation?${params.toString()}`);
    },

    async getSubjectEvaluationTemplate(teacher_id: number, student_id: number, section_id: number, year: number, semester: number) {
        const params = new URLSearchParams({ action: 'template' });
        params.append("teacher_id", teacher_id.toString());
        params.append("student_id", student_id.toString());
        params.append("section_id", section_id.toString());
        params.append("year", year.toString());
        params.append("semester", semester.toString());
        return fetchApi<any>(`/api/teacher/teaching-evaluation?${params.toString()}`);
    },

    async submitSubjectEvaluation(data: {
        teacher_id: number;
        student_id: number;
        section_id: number;
        year: number;
        semester: number;
        data: { name: string; score: number }[];
        feedback?: string;
    }) {
        return fetchApi<any>('/api/teacher/teaching-evaluation', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    // --- Advisor Evaluation ---
    async getAdvisorEvaluation(teacher_id: number, year?: number, semester?: number) {
        const params = new URLSearchParams();
        params.set('teacher_id', String(teacher_id));
        if (year) params.set('year', String(year));
        if (semester) params.set('semester', String(semester));
        return fetchApi<any[]>(`/api/teacher/advisor-evaluation?${params.toString()}`);
    },
    async getAdvisorStudentResults(teacher_id: number, year?: number, semester?: number) {
        const params = new URLSearchParams();
        params.set('teacher_id', String(teacher_id));
        params.set('mode', 'student_results');
        if (year) params.set('year', String(year));
        if (semester) params.set('semester', String(semester));
        return fetchApi<any[]>(`/api/teacher/advisor-evaluation?${params.toString()}`);
    },
    async getAllTeachers() {
        return fetchApi<any[]>('/api/teacher/teachers');
    },

    // --- Section Exam Schedule ---
    async getSectionExamSchedule(section_id: number) {
        return fetchApi<any[]>(`/api/teacher/exam-schedule?section_id=${section_id}`);
    },
    async saveSectionExamSchedule(data: { section_id: number; exam_type: string; exam_date: string; start_time: string; end_time: string }) {
        return fetchApi<any>('/api/teacher/exam-schedule', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    // --- Behavior ---
    async getBehaviorMetadata() {
        return fetchApi<any>('/api/teacher/behavior?action=init');
    },
    async getBehaviorClassrooms(level_id?: number) {
        const params = new URLSearchParams({ action: 'classrooms' });
        if (level_id) params.set('level_id', String(level_id));
        return fetchApi<any[]>(`/api/teacher/behavior?${params.toString()}`);
    },
    async getBehaviorFilteredStudents(params: { 
        teacher_id: number; 
        year?: number; 
        semester?: number; 
        level_id?: number; 
        classroom_id?: number;
    }) {
        const urlParams = new URLSearchParams({ action: 'students' });
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) urlParams.set(key, String(value));
        });
        return fetchApi<any[]>(`/api/teacher/behavior?${urlParams.toString()}`);
    },
    async recordBehavior(payload: {
        student_id: number;
        behavior_type_id: number;
        points: number;
        note?: string;
        year?: number;
        semester?: number;
    }) {
        return fetchApi<any>('/api/teacher/behavior', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },
    async getBehaviorPendingRecords() {
        return fetchApi<any[]>('/api/teacher/behavior?action=pending');
    },
    async approveBehaviorRecord(id: number) {
        return fetchApi<any>('/api/teacher/behavior', {
            method: 'POST',
            body: JSON.stringify({ action: 'approve', id })
        });
    },
    async rejectBehaviorRecord(id: number, reason?: string) {
        return fetchApi<any>('/api/teacher/behavior', {
            method: 'POST',
            body: JSON.stringify({ action: 'reject', id, reason })
        });
    },
    async getBehaviorHistory(studentId: number) {
        return fetchApi<any[]>(`/api/teacher/behavior?action=history&student_id=${studentId}`);
    }
};
