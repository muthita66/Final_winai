import { fetchApi } from './api-client';

export const DirectorApiService = {
    // --- Dashboard ---
    async getSummary(filters?: { gender?: string; class_level?: string; room?: string; subject_id?: number; learning_group_id?: number }) {
        const params = new URLSearchParams();
        if (filters?.gender) params.append('gender', filters.gender);
        if (filters?.class_level) params.append('class_level', filters.class_level);
        if (filters?.room) params.append('room', filters.room);
        if (filters?.subject_id) params.append('subject_id', filters.subject_id.toString());
        if (filters?.learning_group_id) params.append('learning_group_id', filters.learning_group_id.toString());
        return fetchApi<any>(`/api/director/dashboard?${params.toString()}`);
    },
    async getFilterOptions() {
        return fetchApi<any>('/api/director/dashboard?action=filters');
    },

    // --- Teachers CRUD ---
    async getTeachers(search?: string) {
        const q = search ? `?search=${encodeURIComponent(search)}` : '';
        return fetchApi<any[]>(`/api/director/teachers${q}`);
    },
    async getTeacherPositions() {
        return fetchApi<any[]>('/api/director/teacher-positions');
    },
    async createTeacher(data: any) {
        return fetchApi<any>('/api/director/teachers', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateTeacher(id: number, data: any) {
        return fetchApi<any>('/api/director/teachers', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
    },
    async deleteTeacher(id: number) {
        return fetchApi<any>(`/api/director/teachers?id=${id}`, { method: 'DELETE' });
    },

    // --- Students CRUD ---
    async getStudents(filters?: { search?: string; class_level?: string; room?: string }) {
        const params = new URLSearchParams();
        if (filters?.search) params.append('search', filters.search);
        if (filters?.class_level) params.append('class_level', filters.class_level);
        if (filters?.room) params.append('room', filters.room);
        return fetchApi<any[]>(`/api/director/students?${params.toString()}`);
    },
    async createStudent(data: any) {
        return fetchApi<any>('/api/director/students', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateStudent(id: number, data: any) {
        return fetchApi<any>('/api/director/students', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
    },
    async deleteStudent(id: number) {
        return fetchApi<any>(`/api/director/students?id=${id}`, { method: 'DELETE' });
    },

    // --- Student Count ---
    async getStudentCount() {
        return fetchApi<any[]>('/api/director/student-count');
    },

    async getLearningSubjectGroups() {
        return fetchApi<any[]>('/api/director/subject-groups');
    },
    async getSubjectCategories() {
        return fetchApi<any[]>('/api/director/subject-categories');
    },
    async getSubjects(filters?: { search?: string; level?: string; group?: string; category?: string }) {
        const params = new URLSearchParams();
        if (filters?.search) params.append('search', filters.search);
        if (filters?.level) params.append('level', filters.level);
        if (filters?.group) params.append('group', filters.group);
        if (filters?.category) params.append('category', filters.category);
        return fetchApi<any[]>(`/api/director/subjects?${params.toString()}`);
    },
    async createSubject(data: any) {
        return fetchApi<any>('/api/director/subjects', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateSubject(id: number, data: any) {
        return fetchApi<any>('/api/director/subjects', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
    },
    async deleteSubject(id: number) {
        return fetchApi<any>(`/api/director/subjects?id=${id}`, { method: 'DELETE' });
    },

    // --- Curriculum (Sections) ---
    async getSections(year?: number, semester?: number) {
        const params = new URLSearchParams();
        if (year) params.append('year', year.toString());
        if (semester) params.append('semester', semester.toString());
        return fetchApi<any[]>(`/api/director/curriculum?${params.toString()}`);
    },
    async createSection(data: any) {
        return fetchApi<any>('/api/director/curriculum', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateSection(id: number, data: any) {
        return fetchApi<any>('/api/director/curriculum', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
    },
    async deleteSection(id: number) {
        return fetchApi<any>(`/api/director/curriculum?id=${id}`, { method: 'DELETE' });
    },

    // --- Advisors ---
    async getAdvisors(filters?: { year?: number; semester?: number; class_level?: string; room?: string }) {
        const params = new URLSearchParams();
        if (filters?.year) params.append('year', filters.year.toString());
        if (filters?.semester) params.append('semester', filters.semester.toString());
        if (filters?.class_level) params.append('class_level', filters.class_level);
        if (filters?.room) params.append('room', filters.room);
        return fetchApi<any[]>(`/api/director/advisors?${params.toString()}`);
    },
    async createAdvisor(data: any) {
        return fetchApi<any>('/api/director/advisors', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateAdvisor(id: number, data: any) {
        return fetchApi<any>('/api/director/advisors', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
    },
    async deleteAdvisor(id: number) {
        return fetchApi<any>(`/api/director/advisors?id=${id}`, { method: 'DELETE' });
    },

    // --- Activities ---
    async getActivities(search?: string) {
        const q = search ? `?search=${encodeURIComponent(search)}` : '';
        return fetchApi<any[]>(`/api/director/activities${q}`);
    },
    async createActivity(data: any) {
        return fetchApi<any>('/api/director/activities', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateActivity(id: number, data: any) {
        return fetchApi<any>('/api/director/activities', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
    },
    async deleteActivity(id: number) {
        return fetchApi<any>(`/api/director/activities?id=${id}`, { method: 'DELETE' });
    },
    async getEventTypesLookup() {
        return fetchApi<any[]>('/api/director/lookups/event-types');
    },
    async getDepartmentsLookup() {
        return fetchApi<any[]>('/api/director/lookups/departments');
    },
    async getTargetTypes() {
        return fetchApi<any[]>('/api/options/target-types');
    },

    // --- Projects ---
    async getProjects(search?: string, year?: number, semester?: number) {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (year) params.append('year', year.toString());
        if (semester) params.append('semester', semester.toString());
        const q = params.toString();
        return fetchApi<any[]>(`/api/director/projects${q ? `?${q}` : ''}`);
    },
    async createProject(data: any) {
        return fetchApi<any>('/api/director/projects', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateProject(id: number, data: any) {
        return fetchApi<any>('/api/director/projects', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
    },
    async deleteProject(id: number) {
        return fetchApi<any>(`/api/director/projects?id=${id}`, { method: 'DELETE' });
    },

    // --- Lookups ---
    async getProjectTypes() {
        return fetchApi<any[]>('/api/director/lookups/project-types');
    },
    async getBudgetTypes() {
        return fetchApi<any[]>('/api/director/lookups/budget-types');
    },
    async getDepartments() {
        return fetchApi<any[]>('/api/director/lookups/departments');
    },
    async getExpenseCategories() {
        return fetchApi<any[]>('/api/director/lookups/expense-categories');
    },
    async getLearningSubjectGroupsLookup() {
        return fetchApi<any[]>('/api/director/lookups/learning-subject-groups');
    },

    // --- Finance ---
    async getFinanceRecords() {
        return fetchApi<any[]>('/api/director/finance');
    },
    async createFinanceRecord(data: any) {
        return fetchApi<any>('/api/director/finance', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateFinanceRecord(id: number, data: any) {
        return fetchApi<any>('/api/director/finance', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
    },
    async deleteFinanceRecord(id: number) {
        return fetchApi<any>(`/api/director/finance?id=${id}`, { method: 'DELETE' });
    },

    // --- Evaluation ---
    async getEvaluationSummary(year?: number, semester?: number, type?: string) {
        const params = new URLSearchParams();
        if (year) params.append('year', year.toString());
        if (semester) params.append('semester', semester.toString());
        if (type) params.append('type', type);
        const q = params.toString();
        return fetchApi<any[]>(`/api/director/evaluation${q ? `?${q}` : ''}`);
    },
    async getEvaluationResults(year: number, semester: number, type: string, filters?: { subject_id?: number; class_level?: string; room?: string; department_id?: number }) {
        const params = new URLSearchParams({ type, year: year.toString(), semester: semester.toString() });
        if (filters?.subject_id) params.append('subject_id', filters.subject_id.toString());
        if (filters?.department_id) params.append('department_id', filters.department_id.toString());
        if (filters?.class_level) params.append('class_level', filters.class_level);
        if (filters?.room) params.append('room', filters.room);
        return fetchApi<any[]>(`/api/director/evaluation?${params.toString()}`);
    },

    // --- Actors (Database Explorer) ---
    async getActors() {
        return fetchApi<any[]>('/api/director/actors');
    },
    async getActorData(name: string) {
        return fetchApi<any>(`/api/director/actors?name=${encodeURIComponent(name)}`);
    },
    async getGradeLevels() {
        return fetchApi<string[]>('/api/director/grade-levels');
    },
    async getClassrooms() {
        return fetchApi<string[]>('/api/director/classrooms');
    },
    async getAcademicYears() {
        return fetchApi<any[]>('/api/director/lookups/academic-years');
    },
    async getSubjectsLookup(search?: string) {
        const q = search ? `?search=${encodeURIComponent(search)}` : '';
        return fetchApi<any[]>(`/api/director/lookups/subjects${q}`);
    }
};
