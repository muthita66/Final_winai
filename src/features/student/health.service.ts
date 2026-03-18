import { prisma } from '@/lib/prisma';

/**
 * Health service — stubbed out because presentATOM has no health_records
 * or student_fitness_tests tables. Returns empty data.
 */
export const HealthService = {
    async getHealthData(student_id: number) {
        if (!student_id) return null;

        // 1. Health Profile (Blood Type)
        const profile = await prisma.student_health_profiles.findUnique({
            where: { student_id }
        });

        // 2. Latest Checkup (Weight, Height, Vision)
        const checkup = await (prisma as any).student_health_checkups.findFirst({
            where: { student_id },
            orderBy: { checkup_date: 'desc' }
        });

        // 3. Allergies
        const allergiesList = await (prisma as any).student_allergies.findMany({
            where: { student_id },
            include: { allergens: true }
        });
        const allergiesText = (allergiesList as any[]).map((a: any) => a.allergens?.name).filter(Boolean).join(', ');

        // 4. Diseases (Chronic Illness)
        const diseasesList = await (prisma as any).student_diseases.findMany({
            where: { student_id },
            include: { diseases: true }
        });
        const chronicIllnessText = (diseasesList as any[]).map((d: any) => d.diseases?.name).filter(Boolean).join(', ');

        // 5. Vaccinations
        const vaccinationsList = await (prisma as any).vaccination_records.findMany({
            where: { student_id },
            include: { vaccines: true },
            orderBy: { administered_date: 'desc' }
        });
        const vaccinations = (vaccinationsList as any[]).map((v: any) => ({
            name: v.vaccines?.name || 'ไม่ระบุ',
            date: v.administered_date ? v.administered_date.toISOString().split('T')[0] : '',
            status: v.remark || (v.dose_number ? `เข็มที่ ${v.dose_number}` : 'ได้รับแล้ว')
        }));

        // 6. Fitness Records
        const fitnessList = await (prisma as any).student_fitness_records.findMany({
            where: { student_id },
            include: { fitness_test_criteria: true },
            orderBy: { test_date: 'desc' }
        });
        const fitness = (fitnessList as any[]).map((f: any) => ({
            test_name: f.test_name || f.fitness_test_criteria?.test_name || 'ไม่ระบุ',
            result_value: Number(f.test_result) || 0,
            standard_value: Number(f.fitness_test_criteria?.passing_threshold) || 0,
            status: f.is_passed ? 'ผ่าน' : 'ไม่ผ่าน'
        }));

        return {
            student_id,
            weight: Number(checkup?.weight) || null,
            height: Number(checkup?.height) || null,
            blood_type: profile?.blood_type || null,
            allergies: allergiesText || "",
            chronic_illness: chronicIllnessText || "",
            vision_left: checkup?.vision_left || null,
            vision_right: checkup?.vision_right || null,
            vaccinations,
            fitness,
        };
    },

    async updateHealthData(student_id: number, data: any) {
        if (!student_id) return { success: false, message: 'Missing student ID' };

        // 1. Update profile (Blood Type)
        if (data.blood_type) {
            await prisma.student_health_profiles.upsert({
                where: { student_id },
                create: { student_id, blood_type: data.blood_type },
                update: { blood_type: data.blood_type }
            });
        }

        // 2. Add/Update checkup record (Weight, Height, Vision)
        if (data.weight || data.height || data.vision_left || data.vision_right) {
            const today = new Date();
            const startOfDay = new Date(today);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(today);
            endOfDay.setHours(23, 59, 59, 999);

            const existing = await (prisma as any).student_health_checkups.findFirst({
                where: {
                    student_id,
                    checkup_date: {
                        gte: startOfDay,
                        lt: endOfDay
                    }
                }
            });

            const updateFields = {
                weight: data.weight ? Number(data.weight) : undefined,
                height: data.height ? Number(data.height) : undefined,
                vision_left: data.vision_left || undefined,
                vision_right: data.vision_right || undefined
            };

            if (existing) {
                await (prisma as any).student_health_checkups.update({
                    where: { id: existing.id },
                    data: updateFields
                });
            } else {
                await (prisma as any).student_health_checkups.create({
                    data: {
                        student_id,
                        checkup_date: new Date(),
                        weight: data.weight ? Number(data.weight) : null,
                        height: data.height ? Number(data.height) : null,
                        vision_left: data.vision_left || null,
                        vision_right: data.vision_right || null,
                        recorded_by: student_id
                    }
                });
            }
        }

        // 3. Allergies (Sync)
        if (typeof data.allergies === 'string') {
            const names = data.allergies.split(',').map((s: string) => s.trim()).filter(Boolean);
            // Delete old
            await (prisma as any).student_allergies.deleteMany({ where: { student_id } });
            // Link new
            for (const name of names) {
                let allergen = await (prisma as any).allergens.findUnique({ where: { name } });
                if (!allergen) {
                    allergen = await (prisma as any).allergens.create({ data: { name } });
                }
                await (prisma as any).student_allergies.create({
                    data: { student_id, allergen_id: allergen.id }
                }).catch(() => {});
            }
        }

        // 4. Chronic Illness / Diseases (Sync)
        if (typeof data.chronic_illness === 'string') {
            const names = data.chronic_illness.split(',').map((s: string) => s.trim()).filter(Boolean);
            // Delete old
            await (prisma as any).student_diseases.deleteMany({ where: { student_id } });
            // Link new
            for (const name of names) {
                let disease = await (prisma as any).diseases.findUnique({ where: { name } });
                if (!disease) {
                    disease = await (prisma as any).diseases.create({ data: { name } });
                }
                await (prisma as any).student_diseases.create({
                    data: { student_id, disease_id: disease.id }
                }).catch(() => {});
            }
        }

        // 5. Vaccinations (Sync)
        if (Array.isArray(data.vaccinations)) {
            // This is complex - for simplicity, we'll try to sync by name/date
            // But usually vaccination records are historical, so we might just add new ones if they don't exist
            for (const v of data.vaccinations) {
                if (!v.name) continue;
                let vaccine = await (prisma as any).vaccines.findUnique({ where: { name: v.name } });
                if (!vaccine) {
                    vaccine = await (prisma as any).vaccines.create({ data: { name: v.name } });
                }
                
                const adminDate = v.date ? new Date(v.date) : new Date();
                
                await (prisma as any).vaccination_records.upsert({
                    where: {
                        student_id_vaccine_id_dose_number: {
                            student_id,
                            vaccine_id: vaccine.id,
                            dose_number: 1 // Default to 1 if not specified
                        }
                    },
                    create: {
                        student_id,
                        vaccine_id: vaccine.id,
                        administered_date: adminDate,
                        remark: v.status || null,
                        dose_number: 1
                    },
                    update: {
                        administered_date: adminDate,
                        remark: v.status || null
                    }
                }).catch(() => {});
            }
        }

        return { success: true };
    }
};
