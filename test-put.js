const http = require('http');

const payload = JSON.stringify({
    "instructor_id": 1,
    "class_type_id": 1,
    "sport_type": "surf",
    "title": "Test Class",
    "title_es": "Clase de Prueba",
    "description": "Test Description",
    "description_es": "Descripción de prueba",
    "price": 25,
    "capacity": 5,
    "duration_minutes": 60,
    "starts_at": "2026-06-01T10:00:00.000Z",
    "ends_at": "2026-06-01T11:00:00.000Z",
    "location": "Beach",
    "is_online": 0,
    "difficulty_level": 1
});

// We need an auth token to bypass authMiddleware
// Let's modify the script to first login as an instructor to get a token, then PUT.

const reqLogin = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const token = JSON.parse(data).token;
        if (!token) {
            console.log("Login failed", data);
            return;
        }

        const reqPut = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/classes/1', // assuming class 1 exists
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        }, (resPut) => {
            let dataPut = '';
            resPut.on('data', chunk => dataPut += chunk);
            resPut.on('end', () => {
                console.log("PUT Response status:", resPut.statusCode);
                console.log("PUT Response body:", dataPut);
            });
        });

        reqPut.write(payload);
        reqPut.end();
    });
});

// Usually user 1 is an instructor, let's try a common test login or we can just fetch an instructor from DB and mint a token manually.
reqLogin.write(JSON.stringify({ email: "instructor@example.com", password: "password123" }));
reqLogin.end();
