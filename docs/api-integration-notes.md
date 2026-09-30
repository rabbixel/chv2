# Creative Hatti API Integration Notes

## Backend

WordPress + Easy Digital Downloads.

Custom REST API:

/wp-json/ch/v1/

## Base URL

Configured through:

CH_API_URL

in `.env.local`.

## Available endpoints

GET /products
GET /products/{id}
GET /products/slug/{slug}
GET /categories
GET /categories/{slug}

## Important

The WordPress backend and API plugin are already working.

Do not modify WordPress.

Do not connect directly to the WordPress database.

Do not expose S3 download URLs.

Do not implement authentication, checkout, Razorpay or downloads yet.

## Source of truth

The JSON files in this directory are real responses from the current API.

creative-hatti-backend-audit.md contains the backend architecture audit.

If the live API response differs from a saved JSON sample, the live API is authoritative.

## Current task

Replace Arena/mock catalogue data with the real Creative Hatti API while preserving the existing frontend design.