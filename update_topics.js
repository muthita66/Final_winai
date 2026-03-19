const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    const questionsText = [
        "1.1 มีการชี้แจงประมวลผลรายวิชามีข้อมูลที่สำคัญ",
        "1.2 ผู้สอนได้อธิบายประมวลการสอนและทำความเข้าใจกับผู้เรียนอย่างชัดเจนในชั่วโมงแรกของการเรียน",
        "1.3 ผู้สอนสร้างบรรยากาศการเรียนรู้ที่ดีและสนับสนุนการเรียนรู้",
        "1.4 ผู้สอนใช้กิจกรรมการเรียนการสอนที่ให้ผู้เรียนได้ลงมือทำหรือปฏิบัติ",
        "1.5 ผู้สอนใช้กิจกรรมการเรียนการสอนที่กระตุ้นให้ผู้เรียนได้คิด วิเคราะห์ ค้นคว้าเพิ่มเติม วิพากษ์วิจารณ์ เสนอความคิดหรือทดลองแนวทางใหม่ ๆ หรือแสวงหาโอกาสที่เป็นประโยชน์",
        "1.6 ผู้สอนใช้วิธีการที่หลากหลายในการวัดและประเมินผลรายวิชา และมีการประเมินผู้เรียนเป็นระยะ",
        "1.7 สอนประเมินผลผู้เรียนตรงตามที่ระบุให้ในประมวลรายวิชา กรณีมีการเปลี่ยนแปลงวิธีการหรือสัดส่วนคะแนนไปจากประมวลรายวิชา ผู้สอนได้อธิบายเหตุผลความจำเป็นให้ผู้เรียนรับทราบและเข้าใจ",
        "1.8 ผู้สอนมีเกณฑ์ในการตรวจให้คะแนนหรือแนวทางในการให้คะแนนชิ้นงานหรืองานมอบหมายที่ชัดเจน และได้แจ้งเกณฑ์หรือแนวทางการให้คะแนนให้ผู้เรียนได้รับทราบ",
        "1.9 สอนประเมินผลผู้เรียนตรงตามที่ระบุให้ในประมวลรายวิชา กรณีมีการเปลี่ยนแปลงวิธีการหรือสัดส่วนคะแนนไปจากประมวลรายวิชา ผู้สอนได้อธิบายเหตุผลความจำเป็นให้ผู้เรียนรับทราบและเข้าใจ",
        "1.10 ผู้สอนตรวจงานของผู้เรียนและส่งงานคืนพร้อมข้อมูลป้อนกลับ(feedback) แก่ผู้เรียนภายในระยะเวลาที่เหมาะสม",
        "1.11 เมื่อสิ้นสุดรายวิชา ผู้เรียนได้รับความรู้และ/หรือทักษะครบถ้วนตามที่กำหนดไว้ในผลลัพธ์การเรียนรู้ ระบุไว้ในประมวลรายวิชา",
        "2.1 ผู้สอนมีความเป็นธรรมต่อผู้เรียน ปฏิบัติต่อผู้เรียนทุกคนโดยเสมอภาค ไม่เลือกปฏิบัติ",
        "2.2 ผู้สอนสามารถสื่อสาร อธิบาย และถ่ายทอดความคิดกับผู้เรียนได้เป็นอย่างดี",
        "2.3 ผู้สอนมีบุคลิกภาพที่เหมาะสม ทั้งด้านการแต่งกาย การวางตัว การใช้คำพูด",
        "2.4 กรณีผู้เรียนมีข้อสงสัยเรื่องการให้คะแนนงานหรือผลการเรียน ผู้สอนเปิดโอกาสให้ผู้เรียนซักถามได้"
    ];

    try {
        const forms = await prisma.$queryRawUnsafe(`
            SELECT ef.*, eft.type_code
            FROM evaluation_forms ef
            LEFT JOIN evaluation_form_types eft ON eft.id = ef.type_id
            ORDER BY ef.id ASC
        `);

        if (forms.length === 0) {
            console.log("No evaluation forms found.");
            return;
        }

        const form = forms.find(f => String(f.type_code || '').toLowerCase() !== 'advisor') || forms[0];
        console.log("Found evaluation form ID:", form.id);

        let sections = await prisma.evaluation_sections.findMany({
            where: { form_id: form.id }
        });

        if (sections.length === 0) {
            console.log("Creating default section...");
            const newSection = await prisma.evaluation_sections.create({
                data: {
                    form_id: form.id,
                    section_name: 'ประเมินการสอน',
                    order_number: 1
                }
            });
            sections = [newSection];
        }

        const sectionId = sections[0].id;

        console.log("Deleting old questions...");
        await prisma.$queryRawUnsafe(`
            DELETE FROM evaluation_questions WHERE section_id = $1
        `, sectionId);
        
        await prisma.$queryRawUnsafe(`
            DELETE FROM evaluation_questions WHERE form_id = $1
        `, form.id).catch(() => {});

        console.log("Inserting new questions...");
        for (let i = 0; i < questionsText.length; i++) {
            const q = questionsText[i];
            try {
                await prisma.$executeRawUnsafe(`
                    INSERT INTO evaluation_questions (section_id, question_text, question_type, order_number)
                    VALUES ($1, $2, 'scale', $3)
                `, sectionId, q, i + 1);
            } catch (err) {
                await prisma.$executeRawUnsafe(`
                    INSERT INTO evaluation_questions (form_id, section_id, question_text, question_type, order_number)
                    VALUES ($1, $2, $3, 'scale', $4)
                `, form.id, sectionId, q, i + 1);
            }
        }

        console.log("Success! Updated evaluation topics.");
    } catch (error) {
        console.error("Error updating topics:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
