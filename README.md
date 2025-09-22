# Roof Estimator (Express + Google Solar API)

Estimate roof square footage and a rough project cost from a street address.
This service geocodes the address, looks up Google’s Solar API building insights for the nearest roof, converts area to square feet, and multiplies by your provided costPerSqFt.

## Features

Single endpoint: POST /api/estimate
Real roof area from Google Solar API (building insights)
Currency-formatted total cost
Clear error messages for common failure cases
Works locally or in production with environment variables

## How it works

Geocode the address via Google Maps Geocoding API → latitude/longitude + place_id.
Query Google Solar API buildingInsights:findClosest with the lat/lng.
Extract wholeRoofStats.areaMeters2 and (optionally) per-segment areas.
Convert m² → ft² (× 10.7639) and compute total cost: roofArea \* costPerSqFt.

## Requirements

- Node.js 18+ (for native fetch)
- A Google Cloud project:
  - Geocoding API enabled
  - Solar API enabled

Note: The Solar API may not be availbale in all regions (tested for USA and Canada) and if not, will return "Solar data not available for this location" for unsupported areas.

## Getting started

1. Clone & install

```
git clone https://github.com/smoondev/roofestimate.git
cd roofestimate
npm install
```

2. Configure environment
   Create a .env file in the project root:

```
GOOGLE_MAPS_KEY=YOUR_GOOGLE_API_KEY
PORT=3000
```

3. Run

```
node index.js
```

## API Reference

POST /api/estimate
| Field | Type |
| ------------- | ------------- |
| address | String |
| costPerSqFt | Number |

Example request:

```
curl -X POST http://localhost:3000/api/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "address":"1000 Fifth Avenue, Manhattan, New York City",
    "costPerSqFt": 6.5
  }'
```

Example response:

```
{
    "address": "1000 Fifth Avenue, Manhattan, New York City",
    "roofArea": 4017, // square feet (rounded)
    "roofAreaMeters": 373.22104, // square meters (from API)
    "roofSegments": [
        141.95361,
        37.80786,
        30.231598,
        29.240475,
        28.979893,
        28.421349,
        15.575739,
        13.123587,
        12.337029,
        22.069643,
        7.402987,
        6.077273
    ], // per-segment areas (m²), if available
    "coordinates": {
        "lat": 40.7790613,
        "lng": -73.9627407
    },
    "placeId": "ChIJXZba3JZYwokROceijrH6vFs",
    "costPerSqFt": 6.5,
    "totalCost": "$26,110.50", // formatted as USD
    "timestamp": "2025-09-22T19:05:50.661Z"
}
```

## API Docs

[Google Maps Geocoding API](https://developers.google.com/maps/documentation/geocoding)

[Google Solar API – Building Insights](https://developers.google.com/maps/documentation/solar/building-insights)
