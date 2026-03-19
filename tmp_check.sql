SELECT e.id, e.title, e.start_datetime, al.form_id 
FROM events e 
LEFT JOIN activity_evaluation_link al ON al.event_id = e.id 
WHERE e.start_datetime::date = '2026-03-23';

SELECT ep.user_id, ep.status, e.title 
FROM event_participants ep 
JOIN events e ON e.id = ep.event_id 
WHERE e.start_datetime::date = '2026-03-23';
