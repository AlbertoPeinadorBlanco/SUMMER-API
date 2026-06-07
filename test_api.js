const http = require('http');

async function testApi() {
    try {
        // 1. Login to get token
        const loginData = JSON.stringify({ email: 'instructor@example.com', password: 'password123' }); // Adjust if needed
        const reqOpts = {
            hostname: 'localhost',
            port: 5000,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': loginData.length
            }
        };

        const loginRes = await new Promise((resolve, reject) => {
            const req = http.request(reqOpts, res => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
            });
            req.on('error', reject);
            req.write(loginData);
            req.end();
        });

        const setCookieHeader = loginRes.headers['set-cookie'];
        if (!setCookieHeader) {
            console.log('Login failed or no cookie:', loginRes.body);
            return;
        }
        
        const cookie = setCookieHeader.map(c => c.split(';')[0]).join('; ');

        // 2. Post to classes
        const payload = JSON.stringify({
            class_type_id: 1,
            sport_type: 'surf',
            title: 'Test Class via API',
            title_es: '',
            description: 'Some description',
            description_es: '',
            price: 50,
            capacity: 5,
            duration_minutes: 120,
            starts_at: null,
            ends_at: null,
            location: 'Beach',
            is_online: 0,
            difficulty_level: 1
        });

        const postOpts = {
            hostname: 'localhost',
            port: 5000,
            path: '/api/classes',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': payload.length,
                'Cookie': cookie
            }
        };

        const postRes = await new Promise((resolve, reject) => {
            const req = http.request(postOpts, res => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve({ statusCode: res.statusCode, body }));
            });
            req.on('error', reject);
            req.write(payload);
            req.end();
        });

        console.log('Post Status:', postRes.statusCode);
        console.log('Post Body:', postRes.body);

    } catch (e) {
        console.error('Error:', e);
    }
}

testApi();
