import request from 'supertest';
import express from 'express';
import profilerRoutes from '../routes/profiler.js';

const app = express();
app.use(express.json());
app.use('/api/profiler', profilerRoutes);

// Mock the database connection
jest.mock('../../models/database.js', () => ({
  getDatabase: () => ({
    collection: () => ({
      find: () => ({
        sort: () => ({
          limit: () => ({
            toArray: () => Promise.resolve([]),
          }),
        }),
      }),
      findOne: () => Promise.resolve(null),
      aggregate: () => ({
        toArray: () => Promise.resolve([]),
      }),
    }),
  }),
}));

describe('Profiler API', () => {
  describe('GET /api/profiler', () => {
    it('should return 400 if from or to are not provided', async () => {
      const res = await request(app).get('/api/profiler');
      expect(res.statusCode).toEqual(400);
    });

    it('should return 200 with profiler data', async () => {
      const res = await request(app).get('/api/profiler?from=2025-01-01&to=2025-01-02');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  describe('GET /api/profiler/explain', () => {
    it('should return 400 if queryId is not provided', async () => {
      const res = await request(app).get('/api/profiler/explain');
      expect(res.statusCode).toEqual(400);
    });
  });

  describe('GET /api/profiler/stats', () => {
    it('should return 200 with profiler stats', async () => {
      const res = await request(app).get('/api/profiler/stats');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('data');
    });
  });
});
