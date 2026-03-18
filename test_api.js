async function testApi() {
  console.log('Testing API...');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  
  try {
    const res = await fetch('http://localhost:3000/api/director/lookups/project-types', { signal: controller.signal });
    const data = await res.json();
    console.log('API Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('API Test Error:', e.message);
  } finally {
    clearTimeout(timeoutId);
  }
}

testApi();
