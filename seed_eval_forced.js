const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

const section2Questions = [
    "ผู้สอนมีความเป็นธรรมต่อผู้เรียน ปฏิบัติต่อผู้เรียนทุกคนโดยเสมอภาค ไม่เลือกปฏิบัติ",
    "ผู้สอนสามารถสื่อสาร อธิบาย และถ่ายทอดความคิดกับผู้เรียนได้เป็นอย่างดี",
    "ผู้สอนมีบุคลิกภาพที่เหมาะสม ทั้งด้านการแต่งกาย การวางตัว การใช้คำพูด",
    "กรณีผู้เรียนมีข้อสงสัยเรื่องการให้คะแนนงานหรือผลการเรียน ผู้สอนเปิดโอกาสให้ผู้เรียนซักถามได้",
];

async function main() {
    console.log("Checking for existing form...");
    const existingForms = await prisma.$queryRaw`
        SELECT id FROM evaluation_forms WHERE form_name = 'ประเมินการสอน' LIMIT 1
    `;

    if (existingForms.length > 0) {
        console.log("Form already exists with ID:", existingForms[0].id);
        const qCount = await prisma.$queryRaw`
            SELECT COUNT(*)::int as count FROM evaluation_questions eq
            JOIN evaluation_sections es ON es.id = eq.section_id
            JOIN evaluation_forms ef ON ef.id = es.form_id
            WHERE ef.form_name = 'ประเมินการสอน'
        `;
        console.log("Existing question count:", qCount[0].count);
        return;
    }

    console.log("Seeding evaluation category...");
    let categoryId;
    const catRows = await prisma.$queryRaw`
        SELECT id FROM evaluation_categories WHERE name = 'การประเมินการสอน' LIMIT 1
    `;
    if (catRows.length > 0) {
        categoryId = catRows[0].id;
    } else {
        const newCat = await prisma.$queryRaw`
            INSERT INTO evaluation_categories (name, engine_type, description)
            VALUES ('การประเมินการสอน', 'teaching', 'แบบประเมินประสิทธิภาพการสอนของครู')
            RETURNING id
        `;
        categoryId = newCat[0].id;
    }

    console.log("Creating form...");
    const formRows = await prisma.$queryRaw`
        INSERT INTO evaluation_forms (category_id, form_name, description, is_active)
        VALUES (${categoryId}, 'ประเมินการสอน', 'แบบประเมินประสิทธิภาพการสอน', true)
        RETURNING id
    `;
    const formId = formRows[0].id;

    console.log("Creating sections...");
    const sec1Rows = await prisma.$queryRaw`
        INSERT INTO evaluation_sections (form_id, section_name, section_description, order_number)
        VALUES (${formId}, 'ตอนที่ 1 : ด้านการจัดการเรียนการสอน', 'ประเมินด้านการจัดการเรียนการสอนของครูผู้สอน', 1)
        RETURNING id
    `;
    const sec1Id = sec1Rows[0].id;

    const sec2Rows = await prisma.$queryRaw`
        INSERT INTO evaluation_sections (form_id, section_name, section_description, order_number)
        VALUES (${formId}, 'ตอนที่ 2 : ด้านบุคลิกภาพและความเป็นมืออาชีพ', 'ประเมินด้านบุคลิกภาพและความเป็นมืออาชีพของครูผู้สอน', 2)
        RETURNING id
    `;
    const sec2Id = sec2Rows[0].id;

    console.log("Inserting section 1 questions...");
    for (let i = 0; i < section1Questions.length; i++) {
        await prisma.$executeRawUnsafe(
            `INSERT INTO evaluation_questions (section_id, question_text, question_type, order_number, is_required)
             VALUES ($1, $2, 'scale', $3, true)`,
            sec1Id, section1Questions[i], i + 1
        );
    }

    console.log("Inserting section 2 questions...");
    for (let i = 0; i < section2Questions.length; i++) {
        await prisma.$executeRawUnsafe(
            `INSERT INTO evaluation_questions (section_id, question_text, question_type, order_number, is_required)
             VALUES ($1, $2, 'scale', $3, true)`,
            sec2Id, section2Questions[i], i + 1
        );
    }

    console.log("Seed complete!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
