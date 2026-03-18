import { errorResponse } from "@/lib/api-response";

export function parseIntegerParam(
    raw: string | null | undefined,
    options?: { required?: boolean; min?: number }
) {
    const required = options?.required ?? false;
    const min = options?.min;

    if (raw == null || raw === "" || raw === "null" || raw === "undefined") {
        if (required) {
            return { ok: false as const, error: "Missing required parameter" };
        }
        return { ok: true as const, value: undefined as number | undefined };
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
        return { ok: false as const, error: "Invalid integer parameter" };
    }

    if (typeof min === "number" && parsed < min) {
        return { ok: false as const, error: `Parameter must be >= ${min}` };
    }

    return { ok: true as const, value: parsed };
}

export function parseStudentIdFromSession(session: unknown) {
    const sessionLike = (session ?? null) as { id?: string | number | null } | null;

    if (!sessionLike || sessionLike.id == null) {
        return { ok: false as const, response: errorResponse("Unauthorized", 401) };
    }

    const parsed = Number.parseInt(String(sessionLike.id), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return { ok: false as const, response: errorResponse("Unauthorized", 401) };
    }

    return { ok: true as const, studentId: parsed };
}
