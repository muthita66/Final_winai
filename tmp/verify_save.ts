import { TeacherCalendarService } from '../src/features/teacher/calendar.service';

async function testSave() {
    try {
        console.log('Attempting to add a test event with "grade_level" visibility...');
        const result = await TeacherCalendarService.add({
            title: 'Test Event Move',
            event_date: '2026-03-21',
            start_time: '10:00',
            visibility: 'grade_level',
            target_values: ['1', '2']
        });
        console.log('Result:', JSON.stringify(result, null, 2));
        console.log('Save SUCCESS');
        
        // Cleanup the test event
        if (result && result.id) {
            await TeacherCalendarService.remove(result.id);
            console.log('Test event cleaned up.');
        }
    } catch (e) {
        console.error('Save FAILED:', e.message);
    }
}

testSave();
