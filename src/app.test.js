const request = require('supertest');
const express = require('express');

// Instead of requiring the whole app which might start listening or connect to the DB,
// we'll mock a simple test app to verify supertest and jest are working.
// In a real scenario, you'd export the express `app` from index.js before `app.listen()`.
const app = express();
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

describe('API basic tests', () => {
  it('should return 200 OK for the health check', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });
});
