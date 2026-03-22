import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Questions for section 1 (ด้านการจัดการเรียนการสอน)
const section1Questions = [
    "มีการชี้แจงประมวลผลรายวิชามีข้อมูลที่สำคัญ",
    "ผู้สอนได้อธิบายประมวลการสอนและทำความเข้าใจกับผู้เรียนอย่างชัดเจนในชั่วโมงแรกของการเรียน",
    "ผู้สอนสร้างบรรยากาศการเรียนรู้ที่ดีและสนับสนุนการเรียนรู้",
    "ผู้สอนใช้กิจกรรมการเรียนการสอนที่ให้ผู้เรียนได้ลงมือทำหรือปฏิบัติ",
    "ผู้สอนใช้กิจกรรมการเรียนการสอนที่กระตุ้นให้ผู้เรียนได้คิด วิเคราะห์ ค้นคว้าเพิ่มเติม วิพากษ์วิจารณ์ เสนอความคิดหรือทดลองแนวทางใหม่ ๆ หรือแสวงหาโอกาสที่เป็นประโยชน์",
    "ผู้สอนใช้วิธีการที่หลากหลายในการวัดและประเมินผลรายวิชา และมีการประเมินผู้เรียนเป็นระยะ",
    "สอนประเมินผลผู้เรียนตรงตามที่ระบุให้ในประมวลรายวิชา กรณีมีการเปลี่ยนแปลงวิธีการหรือสัดส่วนคะแนนไปจากประมวลรายวิชา ผู้สอนได้อธิบายเหตุผลความจำเป็นให้ผู้เรียนรับทราบและเข้าใจ",
    "ผู้สอนมีเกณฑ์ในการตรวจให้คะแนนหรือแนวทางในการให้คะแนนชิ้นงานหรืองานมอบหมายที่ชัดเจน และได้แจ้งเกณฑ์หรือแนวทางการให้คะแนนให้ผู้เรียนได้รับทราบ",
    "ผู้สอนตรวจงานของผู้เรียนและส่งงานคืนพร้อมข้อมูลป้อนกลับ (feedback) แก่ผู้เรียนภายในระยะเวลาที่เหมาะสม",
    "เมื่อสิ้นสุดรายวิชา ผู้เรียนได้รับความรู้และ/หรือทักษะครบถ้วนตามที่กำหนดไว้ในผลลัพธ์การเรียนรู้ ระบุไว้ในประมวลรายวิชา",
];

// Questions for section 2 (ด้านบุคลิกภาพและความเป็นมืออาชีพ)
const section2Questions = [
    "ผู้สอนมีความเป็นธรรมต่อผู้เรียน ปฏิบัติต่อผู้เรียนทุกคนโดยเสมอภาค ไม่เลือกปฏิบัติ",
    "ผู้สอนสามารถสื่อสาร อธิบาย และถ่ายทอดความคิดกับผู้เรียนได้เป็นอย่างดี",
    "ผู้สอนมีบุคลิกภาพที่เหมาะสม ทั้งด้านการแต่งกาย การวางตัว การใช้คำพูด",
    "กรณีผู้เรียนมีข้อสงสัยเรื่องการให้คะแนนงานหรือผลการเรียน ผู้สอนเปิดโอกาสให้ผู้เรียนซักถามได้",
];


export async function GET() {
    const fs = require('fs');
    const logFile = 'd:/new/WinAi_SeeuNextLift/seeder_debug.log';
    const log = (msg: string) => { try { fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`); } catch(e) {} };
    
    log("fix-grades API called.");

    const results: Record<string, any> = {};
    const errors: string[] = [];

    // Step 1: Check current columns in grade_categories
    try {
        const cols: any[] = await prisma.$queryRaw`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'grade_categories'
        `;
        results.grade_categories_cols = cols.map((c: any) => c.column_name);

        // Add missing "name" column
        if (!cols.find((c: any) => c.column_name === 'name')) {
            await prisma.$executeRawUnsafe(
                `ALTER TABLE grade_categories ADD COLUMN IF NOT EXISTS name VARCHAR(100) NOT NULL DEFAULT 'Category'`
            );
            results.added_grade_categories_name = true;
        }

        // Add missing "weight_percent" column
        if (!cols.find((c: any) => c.column_name === 'weight_percent')) {
            await prisma.$executeRawUnsafe(
                `ALTER TABLE grade_categories ADD COLUMN IF NOT EXISTS weight_percent DECIMAL(5,2) NOT NULL DEFAULT 100.00`
            );
            results.added_grade_categories_weight_percent = true;
        }
    } catch (e: any) {
        errors.push('grade_categories: ' + e.message);
    }

    // Step 2: Check current columns in assessment_items
    try {
        const cols2: any[] = await prisma.$queryRaw`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'assessment_items'
        `;
        results.assessment_items_cols = cols2.map((c: any) => c.column_name);

        // Add missing "name" column
        if (!cols2.find((c: any) => c.column_name === 'name')) {
            await prisma.$executeRawUnsafe(
                `ALTER TABLE assessment_items ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL DEFAULT 'Item'`
            );
            results.added_assessment_items_name = true;
        }

        // Add missing "max_score" column
        if (!cols2.find((c: any) => c.column_name === 'max_score')) {
            await prisma.$executeRawUnsafe(
                `ALTER TABLE assessment_items ADD COLUMN IF NOT EXISTS max_score DECIMAL(5,2) NOT NULL DEFAULT 100.00`
            );
            results.added_assessment_items_max_score = true;
        }
    } catch (e: any) {
        errors.push('assessment_items: ' + e.message);
    }

    // Step 4: Seed evaluation form, sections, and questions
    try {
        log("Seeding evaluation - check existing form...");
        // Check if the teaching evaluation form already exists
        const existingForms: any[] = await prisma.$queryRaw`
            SELECT id FROM evaluation_forms WHERE form_name = 'ประเมินการสอน' LIMIT 1
        `;

        if (existingForms.length === 0) {
            log("Form not found. Seeding...");
            // Get/create an evaluation category for teaching
            let categoryId: number;
            const catRows: any[] = await prisma.$queryRaw`
                SELECT id FROM evaluation_categories WHERE name = 'การประเมินการสอน' LIMIT 1
            `;
            if (catRows.length > 0) {
                categoryId = catRows[0].id;
                log(`Existing category found: ${categoryId}`);
            } else {
                log("Creating new category 'การประเมินการสอน'...");
                const newCat: any[] = await prisma.$queryRaw`
                    INSERT INTO evaluation_categories (name, target_type, description)
                    VALUES ('การประเมินการสอน', 'teaching', 'แบบประเมินประสิทธิภาพการสอนของครู')
                    RETURNING id
                `;
                categoryId = newCat[0].id;
                log(`New category created: ${categoryId}`);
            }

            log(`Creating form 'ประเมินการสอน' for category ${categoryId}...`);
            // Create the form
            const formRows: any[] = await prisma.$queryRaw`
                INSERT INTO evaluation_forms (category_id, form_name, description, is_active)
                VALUES (${categoryId}, 'ประเมินการสอน', 'แบบประเมินประสิทธิภาพการสอน', true)
                RETURNING id
            `;
            const formId = formRows[0].id;
            results.created_form_id = formId;
            log(`Created form ID: ${formId}`);

            // Create section 1
            const sec1Rows: any[] = await prisma.$queryRaw`
                INSERT INTO evaluation_sections (form_id, section_name, section_description, order_number)
                VALUES (${formId}, 'ตอนที่ 1 : ด้านการจัดการเรียนการสอน', 'ประเมินด้านการจัดการเรียนการสอนของครูผู้สอน', 1)
                RETURNING id
            `;
            const sec1Id = sec1Rows[0].id;

            // Create section 2
            const sec2Rows: any[] = await prisma.$queryRaw`
                INSERT INTO evaluation_sections (form_id, section_name, section_description, order_number)
                VALUES (${formId}, 'ตอนที่ 2 : ด้านบุคลิกภาพและความเป็นมืออาชีพ', 'ประเมินด้านบุคลิกภาพและความเป็นมืออาชีพของครูผู้สอน', 2)
                RETURNING id
            `;
            const sec2Id = sec2Rows[0].id;

            // Insert questions for section 1
            for (let i = 0; i < section1Questions.length; i++) {
                await prisma.$executeRawUnsafe(
                    `INSERT INTO evaluation_questions (section_id, question_text, question_type, order_number, is_required)
                     VALUES ($1, $2, 'scale', $3, true)`,
                    sec1Id, section1Questions[i], i + 1
                );
            }

            // Insert questions for section 2
            for (let i = 0; i < section2Questions.length; i++) {
                await prisma.$executeRawUnsafe(
                    `INSERT INTO evaluation_questions (section_id, question_text, question_type, order_number, is_required)
                     VALUES ($1, $2, 'scale', $3, true)`,
                    sec2Id, section2Questions[i], i + 1
                );
            }

            results.seeded_evaluation = {
                form_id: formId,
                section1_id: sec1Id,
                section2_id: sec2Id,
                section1_questions: section1Questions.length,
                section2_questions: section2Questions.length,
            };
        } else {
            results.evaluation_form_already_exists = existingForms[0].id;
            // Count existing questions
            const qCount: any[] = await prisma.$queryRaw`
                SELECT COUNT(*)::int as count FROM evaluation_questions eq
                JOIN evaluation_sections es ON es.id = eq.section_id
                JOIN evaluation_forms ef ON ef.id = es.form_id
                WHERE ef.form_name = 'ประเมินการสอน'
            `;
            results.existing_question_count = qCount[0].count;
        }
    } catch (e: any) {
        errors.push('evaluation_seed: ' + e.message);
    }

    return NextResponse.json({ success: errors.length === 0, results, errors });
}
