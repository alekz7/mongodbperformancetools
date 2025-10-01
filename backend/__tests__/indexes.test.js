import request from 'supertest';
import express from 'express';
import indexesRoutes from '../routes/indexes.js';

const app = express();
app.use(express.json());
app.use('/api/indexes', indexesRoutes);

// Mock the database connection
jest.mock('../../models/database.js', () => ({
  getDatabase: () => ({
    collection: () => ({
      indexes: () => Promise.resolve([]),
      createIndex: () => Promise.resolve('test_index'),
      dropIndex: () => Promise.resolve(),
    }),
    listCollections: () => ({
      toArray: () => Promise.resolve([]),
    }),
  }),
}));

describe('Indexes API', () => {
  describe('GET /api/indexes', () => {
    it('should return 200 with a list of indexes', async () => {
      const res = await request(app).get('/api/indexes');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  describe('POST /api/indexes', () => {
    it('should return 400 if collection or indexSpec are not provided', async () => {
      const res = await request(app).post('/api/indexes').send({});
      expect(res.statusCode).toEqual(400);
    });
  });

  describe('DELETE /api/indexes', () => {
    it('should return 400 if collection or indexName are not provided', async () => {
      const res = await request(app).delete('/api/indexes');
      expect(res.statusCode).toEqual(400);
    });
  });

  describe('GET /api/indexes/stats', () => {
    it('should return 200 with index stats', async () => {
      const res = await request(app).get('/api/indexes/stats');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('data');
    });
  });
});
