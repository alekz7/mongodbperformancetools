# MongoDB Performance Tools

This project is a web-based performance analysis tool for MongoDB, inspired by Studio 3T's profiler. It provides a user-friendly interface to analyze profiler data, manage indexes, and gain insights into your database's performance.

## About the Project

The project is a full-stack application with a React frontend and an Express backend.

*   **Frontend:** A React application built with Vite that provides a dashboard to visualize profiler data, manage indexes, and view performance analytics. It uses Chart.js for data visualization.
*   **Backend:** An Express application that connects to your MongoDB database and provides a rich API to query profiler data, manage indexes, and perform performance analysis.

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

You will need to have the following software installed on your machine:

*   [Node.js](https://nodejs.org/) (which includes npm)
*   A running MongoDB instance with the profiler enabled.

### Installation

1.  **Clone the repository:**

    ```sh
    git clone https://github.com/alekz7/mongodbperformancetools.git
    cd mongodbperformancetools
    ```

2.  **Install dependencies:**

    ```sh
    npm install
    ```

3.  **Configure your environment:**

    Create a `.env` file in the root of the project and add the following environment variables:

    ```
    MONGODB_URI=<your_mongodb_uri>
    FRONTEND_URL=http://localhost:5173
    ```

    Replace `<your_mongodb_uri>` with the connection string for your MongoDB instance.

## Usage

To run the application in development mode, use the following command:

```sh
npm run dev:full
```

This will start both the backend and frontend servers concurrently.

*   The backend server will be running on `http://localhost:3001`.
*   The frontend development server will be running on `http://localhost:5173`.

Open your browser and navigate to `http://localhost:5173` to use the application.

## API Endpoints

The backend provides the following API endpoints:

### Profiler

*   `GET /api/profiler`: Retrieve profiler data.
*   `GET /api/profiler/explain`: Get the explain plan for a specific query.
*   `GET /api/profiler/stats`: Get profiler statistics.

### Indexes

*   `GET /api/indexes`: List all indexes.
*   `POST /api/indexes`: Create a new index.
*   `DELETE /api/indexes`: Drop an index.
*   `GET /api/indexes/stats`: Get detailed index statistics.

### Analytics

*   `GET /api/analytics/performance-trends`: Get performance trends over time.
*   `GET /api/analytics/operation-breakdown`: Get a breakdown of operation types.
*   `GET /api/analytics/collection-performance`: Get per-collection performance metrics.
*   `POST /api/analytics/compare-periods`: Compare performance between two time periods.

## Technologies Used

*   [React](https://reactjs.org/)
*   [Vite](https://vitejs.dev/)
*   [TypeScript](https://www.typescriptlang.org/)
*   [Tailwind CSS](https://tailwindcss.com/)
*   [Chart.js](https://www.chartjs.org/)
*   [Express](https://expressjs.com/)
*   [MongoDB](https://www.mongodb.com/)
*   [Node.js](https://nodejs.org/)
