
const url = 'http://localhost:3000/api/student/evaluation?action=topics&type=teaching&year=2567&semester=1';

async function check() {
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers.get('content-type'));
    console.log('Body start:', text.substring(0, 100));
    try {
      JSON.parse(text);
      console.log('Is valid JSON: YES');
    } catch (e) {
      console.log('Is valid JSON: NO');
    }
  } catch (e) {
    console.error('Fetch failed:', e.message);
  }
}

check();
