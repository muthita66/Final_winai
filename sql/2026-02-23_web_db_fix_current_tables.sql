-- WinAI School DB fixes for current web app (checked on 2026-02-23)
-- Purpose:
--   1) Normalize/prepare advisor storage table used by Director page (`john_subject_sections`)
--   2) Backfill advisor rows from current teaching assignments
--   3) Backfill missing evaluation_periods from current semesters
--   4) Create missing tables used by Director/Teacher features (projects, finance_records, student_fitness_tests)
--
-- Notes:
--   - This script is idempotent (safe to re-run).
--   - Some app services are still stubbed in code (projects/finance/fitness save), so this script prepares DB first.
--   - Advisor table may already exist (auto-created by app); this script upgrades it for Thai text and adds indexes/FK.

BEGIN;

-- ============================================================================
-- 1) Advisor table (`john_subject_sections`) used by Director > Advisors page
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.john_subject_sections (
    id          SERIAL PRIMARY KEY,
    subject_id  INTEGER NULL,
    teacher_id  INTEGER NULL,
    year        INTEGER NULL,
    semester    INTEGER NULL,
    class_level VARCHAR(100) NULL,
    classroom   VARCHAR(100) NULL,
    day_of_week VARCHAR(20) NULL,
    time_range  VARCHAR(50) NULL,
    room        VARCHAR(100) NULL
);

-- Widen columns if table was auto-created earlier with VARCHAR(10).
ALTER TABLE public.john_subject_sections
    ALTER COLUMN class_level TYPE VARCHAR(100),
    ALTER COLUMN classroom TYPE VARCHAR(100),
    ALTER COLUMN room TYPE VARCHAR(100);

-- Add FK to teachers if missing (safe while table is empty or valid).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.john_subject_sections'::regclass
          AND conname = 'john_subject_sections_teacher_id_fkey'
    ) THEN
        ALTER TABLE public.john_subject_sections
            ADD CONSTRAINT john_subject_sections_teacher_id_fkey
            FOREIGN KEY (teacher_id)
            REFERENCES public.teachers(id)
            ON DELETE SET NULL
            ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_john_subject_sections_teacher_id
    ON public.john_subject_sections (teacher_id);

CREATE INDEX IF NOT EXISTS idx_john_subject_sections_advisor_lookup
    ON public.john_subject_sections (year, semester, class_level, classroom)
    WHERE subject_id IS NULL;

-- Optional stronger uniqueness for advisors (one row per class/term) can be enabled later.
-- CREATE UNIQUE INDEX IF NOT EXISTS ux_john_subject_sections_advisor_room_term
--     ON public.john_subject_sections (year, semester, class_level, classroom)
--     WHERE subject_id IS NULL;

-- Backfill advisor rows from existing teaching assignments:
-- pick the teacher who teaches the most subjects in each class/term.
WITH ranked_advisors AS (
    SELECT
        NULLIF(regexp_replace(ay.year_name, '[^0-9]', '', 'g'), '')::INTEGER AS year,
        s.semester_number AS semester,
        gl.name AS class_level,
        c.room_name AS classroom,
        ta.teacher_id,
        COUNT(*) AS subject_count,
        ROW_NUMBER() OVER (
            PARTITION BY ay.year_name, s.semester_number, gl.name, c.room_name
            ORDER BY COUNT(*) DESC, ta.teacher_id ASC
        ) AS rn
    FROM public.teaching_assignments ta
    JOIN public.semesters s
      ON s.id = ta.semester_id
    JOIN public.academic_years ay
      ON ay.id = s.academic_year_id
    JOIN public.classrooms c
      ON c.id = ta.classroom_id
    JOIN public.grade_levels gl
      ON gl.id = c.grade_level_id
    WHERE ta.classroom_id IS NOT NULL
      AND ta.teacher_id IS NOT NULL
    GROUP BY ay.year_name, s.semester_number, gl.name, c.room_name, ta.teacher_id
)
INSERT INTO public.john_subject_sections (
    subject_id, teacher_id, year, semester, class_level, classroom, day_of_week, time_range, room
)
SELECT
    NULL,
    r.teacher_id,
    r.year,
    r.semester,
    r.class_level,
    r.classroom,
    NULL,
    NULL,
    NULL
FROM ranked_advisors r
WHERE r.rn = 1
  AND NOT EXISTS (
      SELECT 1
      FROM public.john_subject_sections j
      WHERE j.subject_id IS NULL
        AND COALESCE(j.year, -1) = COALESCE(r.year, -1)
        AND COALESCE(j.semester, -1) = COALESCE(r.semester, -1)
        AND COALESCE(j.class_level, '') = COALESCE(r.class_level, '')
        AND COALESCE(j.classroom, '') = COALESCE(r.classroom, '')
  );

-- ============================================================================
-- 2) Backfill evaluation periods from semesters (used by student evaluation)
-- ============================================================================

INSERT INTO public.evaluation_periods (name, semester_id, start_date, end_date, is_active)
SELECT
    CONCAT('Evaluation Period ', ay.year_name, ' / Semester ', s.semester_number) AS name,
    s.id AS semester_id,
    COALESCE(s.start_date, CURRENT_DATE) AS start_date,
    COALESCE(s.end_date, (COALESCE(s.start_date, CURRENT_DATE) + INTERVAL '90 days')::DATE) AS end_date,
    COALESCE(s.is_active, FALSE) AS is_active
FROM public.semesters s
JOIN public.academic_years ay
  ON ay.id = s.academic_year_id
LEFT JOIN public.evaluation_periods ep
  ON ep.semester_id = s.id
WHERE ep.id IS NULL;

-- ============================================================================
-- 3) Missing tables for current web pages (Director Projects / Finance, Teacher Fitness)
--    DB is prepared here; app code may still need to be switched from stub to real CRUD.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.projects (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    year         INTEGER NULL,
    semester     INTEGER NULL,
    objective    TEXT NULL,
    department   VARCHAR(150) NULL,
    budget_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    budget_used  NUMERIC(12,2) NOT NULL DEFAULT 0,
    status       VARCHAR(30) NULL DEFAULT 'draft',
    created_at   TIMESTAMP(6) NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_term
    ON public.projects (year, semester, id DESC);

CREATE TABLE IF NOT EXISTS public.finance_records (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    type        VARCHAR(30) NOT NULL, -- expected values: income / expense
    amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
    note        TEXT NULL,
    record_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMP(6) NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_records_record_date
    ON public.finance_records (record_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_finance_records_type
    ON public.finance_records (type);

CREATE TABLE IF NOT EXISTS public.student_fitness_tests (
    id             SERIAL PRIMARY KEY,
    student_id     INTEGER NOT NULL,
    teacher_id     INTEGER NULL,
    test_name      VARCHAR(150) NOT NULL,
    result_value   VARCHAR(100) NULL,
    standard_value VARCHAR(100) NULL,
    status         VARCHAR(30) NULL,
    year           INTEGER NULL,
    semester       INTEGER NULL,
    test_date      DATE NULL DEFAULT CURRENT_DATE,
    created_at     TIMESTAMP(6) NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_student_fitness_tests_student
        FOREIGN KEY (student_id) REFERENCES public.students(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_student_fitness_tests_teacher
        FOREIGN KEY (teacher_id) REFERENCES public.teachers(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_student_fitness_tests_student_term
    ON public.student_fitness_tests (student_id, year, semester);

CREATE INDEX IF NOT EXISTS idx_student_fitness_tests_teacher
    ON public.student_fitness_tests (teacher_id);

-- Prevent exact duplicates (same student/test/term/day) while allowing retries on different dates.
CREATE UNIQUE INDEX IF NOT EXISTS ux_student_fitness_tests_student_test_term_date
    ON public.student_fitness_tests (student_id, test_name, COALESCE(year, 0), COALESCE(semester, 0), COALESCE(test_date, DATE '1900-01-01'));

COMMIT;

-- ============================================================================
-- 4) Verification queries (run after script)
-- ============================================================================

-- SELECT COUNT(*) AS advisor_rows FROM public.john_subject_sections WHERE subject_id IS NULL;
-- SELECT year, semester, class_level, classroom, teacher_id FROM public.john_subject_sections WHERE subject_id IS NULL ORDER BY year DESC, semester DESC, class_level, classroom;
-- SELECT COUNT(*) AS evaluation_period_rows FROM public.evaluation_periods;
-- SELECT COUNT(*) AS project_rows FROM public.projects;
-- SELECT COUNT(*) AS finance_rows FROM public.finance_records;
-- SELECT COUNT(*) AS fitness_rows FROM public.student_fitness_tests;
