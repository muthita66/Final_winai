INSERT INTO project_types (name) VALUES ('โครงการตามแผนปฏิบัติการ'), ('โครงการเร่งด่วน'), ('โครงการพิเศษ'), ('กิจกรรมพัฒนาผู้เรียน') ON CONFLICT (name) DO NOTHING;
INSERT INTO budget_types (name) VALUES ('เงินงบประมาณ (งบอุดหนุน)'), ('เงินนอกงบประมาณ'), ('เงินรายได้สถานศึกษา'), ('เงินบริจาค') ON CONFLICT (name) DO NOTHING;
INSERT INTO learning_subject_groups (group_name) VALUES ('ภาษาไทย'), ('คณิตศาสตร์'), ('วิทยาศาสตร์และเทคโนโลยี'), ('สังคมศึกษา ศาสนา และวัฒนธรรม'), ('สุขศึกษาและพลศึกษา'), ('ศิลปะ'), ('การงานอาชีพ'), ('ภาษาต่างประเทศ') ON CONFLICT (group_name) DO NOTHING;
