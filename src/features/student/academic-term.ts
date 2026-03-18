export function getCurrentAcademicYearBE(date = new Date()) {
    const month = date.getMonth() + 1; // 1-12
    const yearBE = date.getFullYear() + 543;
    // Thai academic year starts in May. Jan-Apr belong to the previous academic year.
    return month < 5 ? yearBE - 1 : yearBE;
}

export function getAcademicSemesterDefault(date = new Date()) {
    return 1;
}

export function getRecentAcademicYearsBE(count = 5, anchorYear = getCurrentAcademicYearBE()) {
    return Array.from({ length: count }, (_, index) => anchorYear - index);
}

export function getAcademicYearOptions(currentValue?: number, count = 5) {
    const base = getRecentAcademicYearsBE(count);
    if (typeof currentValue === "number" && Number.isFinite(currentValue) && !base.includes(currentValue)) {
        return [currentValue, ...base].sort((a, b) => b - a);
    }
    return base;
}

export function getAcademicYearOptionsForStudent(classLevel: string, currentValue?: number) {
    const anchorYear = getCurrentAcademicYearBE();
    if (!classLevel) return getAcademicYearOptions(currentValue, 5);

    // Extract the numeric level (e.g., "M.1/2" -> 1, "ม.4" -> 4, "มัธยมศึกษาปีที่ 3" -> 3)
    const match = classLevel.match(/(ม\.|m\.|มัธยมศึกษาปีที่\s*)(\d)/i);
    if (!match || match.length < 3) return getAcademicYearOptions(currentValue, 5);

    const level = parseInt(match[2], 10);
    if (isNaN(level) || level < 1 || level > 6) return getAcademicYearOptions(currentValue, 5);

    // Calculate how many years to show:
    // ม.1-3: level years (1, 2, 3)
    // ม.4-6: level - 3 years (1, 2, 3)
    const yearsToShow = level > 3 ? level - 3 : level;

    const base = getRecentAcademicYearsBE(yearsToShow, anchorYear);

    return base;
}
