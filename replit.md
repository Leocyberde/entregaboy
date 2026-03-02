# Motoboy Delivery Platform

A full-stack motorcycle courier management platform with role-based dashboards, real-time tracking, and automated route calculation.

## Features
- **Three User Roles**: Admin, Cliente (Client), and Motoboy (Driver).
- **Real-time Tracking**: GPS location updates via WebSockets.
- **Route Calculation**: Integration with OSRM and Nominatim for distance, duration, and pricing.
- **Order Management**: 4-digit order numbers and pickup codes for security.
- **Admin Dashboard**: Manage users, pricing, and monitor all rides.
- **Client Dashboard**: Request new rides, track active deliveries, and view history.
- **Motoboy Dashboard**: Accept nearby rides, update status, and track earnings.

## Technical Stack
- **Frontend**: React, Tailwind CSS, Shadcn UI, TanStack Query, Wouter.
- **Backend**: Node.js, Express, TRPC, WebSockets (Socket.io).
- **Database**: PostgreSQL with Drizzle ORM.
- **Maps**: Leaflet for map rendering and routing visualization.

## Development
1. Install dependencies: `npm install`
2. Sync database: `npm run db:push`
3. Start application: `npm run dev`

## Recent Changes
- Updated route distance multiplier to 0.95.
- Hidden motoboy earnings from the client panel (privacy).
- Added 4-digit `orderNumber` and `pickupCode` to all rides.
- Simplified address formatting from Nominatim geocoding.
