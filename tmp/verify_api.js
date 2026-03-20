async function testApi() {
    try {
        const response = await fetch('http://localhost:3000/api/options/grades');
        const data = await response.json();
        console.log('API Response:', JSON.stringify(data, null, 2));
        if (data.success && data.data && data.data.length > 0) {
            console.log('Verification SUCCESS');
        } else {
            console.log('Verification FAILED: Response was not as expected');
        }
    } catch (e) {
        console.error('Verification FAILED: Error fetching API', e.message);
    }
}

testApi();
