import request from 'supertest';
import express from 'express';
import analyticsRoutes from '../routes/analytics.js';

const app = express();
app.use(express.json());
app.use('/api/analytics', analyticsRoutes);

// Mock the database connection
jest.mock('../../models/database.js', () => ({
  getDatabase: () => ({
    collection: () => ({
      aggregate: () => ({
        toArray: () => Promise.resolve([]),
      }),
    }),
  }),
}));

describe('Analytics API', () => {
  describe('GET /api/analytics/performance-trends', () => {
    it('should return 400 if from or to are not provided', async () => {
      const res = await request(app).get('/api/analytics/performance-trends');
      expect(res.statusCode).toEqual(400);
    });

    it('should return 200 with performance trends data', async () => {
      const res = await request(app).get('/api/analytics/performance-trends?from=2025-01-01&to=2025-01-02');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  describe('GET /api/analytics/operation-breakdown', () => {
    it('should return 400 if from or to are not provided', async () => {
      const res = await request(app).get('/api/analytics/operation-breakdown');
      expect(res.statusCode).toEqual(400);
    });

    it('should return 200 with operation breakdown data', async () => {
      const res = await request(app).get('/api/analytics/operation-breakdown?from=2025-01-01&to=2025-01-02');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  describe('GET /api/analytics/collection-performance', () => {
    it('should return 400 if from or to are not provided', async () => {
      const res = await request(app).get('/api/analytics/collection-performance');
      expect(res.statusCode).toEqual(400);
    });

    it('should return 200 with collection performance data', async () => {
      const res = await request(app).get('/api/analytics/collection-performance?from=2025-01-01&to=2025-01-02');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  describe('POST /api/analytics/compare-periods', () => {
    it('should return 400 if the request body is invalid', async () => {
      const res = await request(app).post('/api/analytics/compare-periods').send({});
      expect(res.statusCode).toEqual(400);
    });

    it('should return 200 with comparison data', async () => {
      const res = await request(app).post('/api/analytics/compare-periods').send({
        beforePeriod: { from: '2025-01-01', to: '2025-01-02' },
        afterPeriod: { from: '2025-01-03', to: '2025-01-04' },
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('data');
    });
  });
});
