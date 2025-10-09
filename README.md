# Tajik Trails Backend API

A TypeScript Express backend API for Tajik Trails tour agency with Prisma ORM, SQLite database, and multilingual tour/category management.

## Features

- **Node.js/Express** server with TypeScript
- **Prisma ORM** with SQLite database
- **Multilingual support** for English and Russian content
- **CORS middleware** for React frontend compatibility
- **RESTful API** design with clean architecture
- **Database migrations** and seeding
- **Type-safe** development with TypeScript
- **Error handling** and validation

## Technology Stack

- **Backend**: Node.js with Express.js framework
- **Language**: TypeScript for type safety
- **Database**: SQLite with Prisma ORM
- **Middleware**: CORS, JSON parsing, error handling

## Project Structure

```
├── prisma/
│   ├── schema.prisma       # Database schema with Category and Tour models
│   ├── seed.ts             # Database seeding script with sample data
│   └── migrations/         # Database migration files (auto-generated)
├── src/
│   ├── config/
│   │   └── database.ts     # Prisma client configuration
│   ├── controllers/
│   │   └── tourController.ts # Business logic for tours and categories
│   ├── middleware/
│   │   └── errorHandler.ts # Global error handling middleware
│   ├── models/
│   │   └── index.ts        # Database models with methods
│   ├── routes/
│   │   ├── index.ts        # Main router with health check
│   │   └── tourRoutes.ts   # Tour and category route definitions
│   ├── types/
│   │   └── index.ts        # TypeScript interfaces and types
│   ├── app.ts              # Express app configuration
│   └── server.ts           # Server startup and configuration
├── .env                    # Environment variables (DATABASE_URL)
├── tsconfig.json           # TypeScript configuration
└── README.md               # This file
```

## API Endpoints

### Health Check
- **GET** `/api/health` - Check API status

### Tours
- **GET** `/api/tours` - Get all tours with categories
- **GET** `/api/tours/:id` - Get specific tour by ID
- **POST** `/api/tours` - Create a new tour

### Categories  
- **GET** `/api/categories` - Get all categories with tour count

## Database Setup and Migration

1. **Initial Setup**: The database is automatically configured with SQLite
2. **Run Migrations**: 
   ```bash
   npx prisma migrate dev --name init
   ```
3. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```
4. **Seed Database**:
   ```bash
   npx ts-node prisma/seed.ts
   ```

## Running the Application

The application runs automatically with the Backend Server workflow. The server starts on port 5000 and includes:

- Database connection verification
- Automatic Prisma client generation
- Database migration execution  
- Sample data seeding
- Express server startup

**Server URL**: `http://localhost:5000`
**Health Check**: `http://localhost:5000/api/health`

## Sample API Responses

### GET /api/tours
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": {
        "en": "Pamir Mountains Trek",
        "ru": "Треккинг в горах Памир"
      },
      "description": {
        "en": "Experience the breathtaking beauty of the Pamir Mountains...",
        "ru": "Испытайте захватывающую красоту Памирских гор..."
      },
      "duration": "7 days",
      "price": "$1,200",
      "categoryId": 1,
      "category": {
        "id": 1,
        "name": {
          "en": "Trekking",
          "ru": "Треккинг"
        }
      }
    }
  ],
  "message": "Tours retrieved successfully"
}
```

### POST /api/tours
Send JSON data with the following structure:
```json
{
  "title": {
    "en": "Tour Title in English",
    "ru": "Название тура на русском"
  },
  "description": {
    "en": "Description in English",
    "ru": "Описание на русском"
  },
  "duration": "5 days",
  "price": "$500",
  "categoryId": 1
}
```

## Complete API Documentation

### Tour Management
- **GET** `/api/tours` - Get all tours with categories
- **GET** `/api/tours/:id` - Get specific tour by ID
- **POST** `/api/tours` - Create a new tour
- **PUT** `/api/tours/:id` - Update tour details
- **DELETE** `/api/tours/:id` - Delete a tour

### Category Management  
- **GET** `/api/categories` - Get all categories with tour count
- **GET** `/api/categories/:id` - Get specific category with tours
- **POST** `/api/categories` - Create a new category
- **PUT** `/api/categories/:id` - Update category details
- **DELETE** `/api/categories/:id` - Delete a category

### Booking Requests
- **POST** `/api/booking-requests` - Create booking request (Public)
- **GET** `/api/booking-requests` - Get all booking requests (Admin)

### Reviews
- **POST** `/api/reviews` - Submit a review (Public)
- **GET** `/api/reviews` - Get all reviews (Admin)
- **PUT** `/api/reviews/:id` - Update review moderation status (Admin)

### Sample POST Requests

#### Create Booking Request
```json
{
  "customerName": "John Doe",
  "customerEmail": "john.doe@example.com",
  "preferredDate": "2025-09-15",
  "numberOfPeople": 2,
  "tourId": 1
}
```

#### Create Review
```json
{
  "authorName": "Alice Smith",
  "rating": 5,
  "text": "Amazing experience!",
  "tourId": 1
}
```

#### Update Review Moderation
```json
{
  "isModerated": true
}
```

## Database Schema

The application now includes four main models:

1. **Category**: Multilingual tour categories
2. **Tour**: Detailed tour information with category relations
3. **BookingRequest**: Customer booking inquiries
4. **Review**: Tour reviews with moderation system

All models include proper relationships and validation for data integrity.

