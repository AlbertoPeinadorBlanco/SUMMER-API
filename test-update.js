const classesController = require('./src/controllers/classesController');
const pool = require('./src/config/db');

async function test() {
    const req = {
        params: { id: 1 },
        body: {
            instructor_id: 1,
            class_type_id: 1,
            sport_type: "surf",
            title: "Test Class",
            title_es: "Clase",
            description: "Test Description",
            description_es: "Desc",
            price: 25,
            capacity: 5,
            duration_minutes: 60,
            starts_at: "2026-06-01T10:00:00.000Z",
            ends_at: "2026-06-01T11:00:00.000Z",
            location: "Beach",
            is_online: 0,
            difficulty_level: 1
        },
        user: { id: 1 },
        ip: '127.0.0.1',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
    };

    const res = {
        status: function(code) {
            console.log("Status called with:", code);
            return this;
        },
        json: function(data) {
            console.log("JSON called with:", data);
        }
    };

    try {
        await classesController.updateClass(req, res);
    } catch (e) {
        console.error("Exception:", e);
    }
    process.exit(0);
}

test();
