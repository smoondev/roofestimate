require("dotenv").config();
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

// Get API key from environment variables or hardcoded for development
const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_KEY;

async function getRoofAreaFromGoogleSolar(address) {
  if (!GOOGLE_MAPS_KEY) {
    throw new Error("Google Maps API key not configured");
  }

  try {
    // Geocode the address to get lat/lng
    const geocodeUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    geocodeUrl.searchParams.set("address", address);
    geocodeUrl.searchParams.set("key", GOOGLE_MAPS_KEY);

    const geoResponse = await fetch(geocodeUrl);
    if (!geoResponse.ok) {
      throw new Error("Geocoding API request failed");
    }

    const geo = await geoResponse.json();

    if (!geo.results || geo.results.length === 0 || geo.results[0].partial_match) {
      throw new Error("Address not found");
    }

    const { lat, lng } = geo.results[0].geometry.location;
    const place_id = geo.results[0].place_id;

    // Ask Solar API for the closest building's insights
    const solarUrl = new URL("https://solar.googleapis.com/v1/buildingInsights:findClosest");
    solarUrl.searchParams.set("location.latitude", String(lat));
    solarUrl.searchParams.set("location.longitude", String(lng));
    solarUrl.searchParams.set("requiredQuality", "HIGH");
    solarUrl.searchParams.set("key", GOOGLE_MAPS_KEY);

    const solarResponse = await fetch(solarUrl);
    if (!solarResponse.ok) {
      throw new Error("Solar API request failed");
    }

    const bi = await solarResponse.json();

    if (!bi.solarPotential || !bi.solarPotential.wholeRoofStats) {
      throw new Error("Solar data not available for this location");
    }

    // Pull areas (total roof and per segment)
    const total_m2 = bi.solarPotential.wholeRoofStats.areaMeters2;
    const perSegments_m2 = (bi.solarPotential.roofSegmentStats ?? []).map((s) => s.stats.areaMeters2);

    // Convert to square feet
    const total_ft2 = Math.round(total_m2 * 10.7639);

    return {
      roofArea: total_ft2,
      roofAreaMeters: total_m2,
      roofSegments: perSegments_m2,
      placeId: place_id,
      coordinates: { lat, lng },
    };
  } catch (error) {
    console.error("Error fetching roof data:", error);
    throw error;
  }
}

// POST endpoint for roof estimate
app.post("/api/estimate", async (req, res) => {
  try {
    const { address, costPerSqFt } = req.body;

    // Validate input
    if (!address || !costPerSqFt) {
      return res.status(400).json({ error: "Address and cost per square foot are required" });
    }

    if (costPerSqFt <= 0) {
      return res.status(400).json({ error: "Cost per square foot must be greater than 0" });
    }

    // Get real roof area using Google Solar API
    const roofData = await getRoofAreaFromGoogleSolar(address);

    // Calculate total cost
    const totalCost = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(roofData.roofArea * costPerSqFt);

    // Return the estimate with additional data
    res.json({
      address,
      roofArea: roofData.roofArea,
      roofAreaMeters: roofData.roofAreaMeters,
      roofSegments: roofData.roofSegments,
      coordinates: roofData.coordinates,
      placeId: roofData.placeId,
      costPerSqFt,
      totalCost,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error processing estimate request:", error);

    // Return specific error messages for different failure types
    if (error.message === "Google Maps API key not configured") {
      return res.status(500).json({ error: "API configuration error. Please verify that the key is valid and accessible." });
    } else if (error.message === "Address not found") {
      return res.status(400).json({ error: "Address could not be found. Please verify and try again." });
    } else if (error.message === "Solar data not available for this location") {
      return res.status(400).json({ error: "Solar roof data is not available for this location. Please try a different address." });
    }

    res.status(500).json({ error: "Unable to calculate roof estimate. Please try again." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 roof-estimator listening on http://localhost:${PORT}`);
});
