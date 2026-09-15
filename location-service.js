async function searchLocation(query) {
    if (!query || query.trim().length < 3) {
        return [];
    }

    const cleanQuery = query.trim();

    async function requestSearch(searchQuery) {
        const params = new URLSearchParams({
            format: "json",
            addressdetails: "1",
            limit: "8",
            countrycodes: "ng",
            q: searchQuery
        });

        const response = await fetch(
            "https://nominatim.openstreetmap.org/search?" +
            params.toString(),
            {
                headers: {
                    "Accept": "application/json"
                }
            }
        );

        if (!response.ok) {
            throw new Error("Location search failed");
        }

        return await response.json();
    }

    try {
        let results = await requestSearch(cleanQuery);

        if (results.length) {
            return results;
        }

        return await requestSearch(cleanQuery + ", Nigeria");
    } catch (error) {
        console.error("Location search error:", error);
        return [];
    }
}

async function reverseGeocode(latitude, longitude) {
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        lat < -90 ||
        lat > 90 ||
        lon < -180 ||
        lon > 180
    ) {
        throw new Error("Invalid GPS coordinates.");
    }

    const params = new URLSearchParams({
        format: "json",
        addressdetails: "1",
        lat: String(lat),
        lon: String(lon)
    });

    const response = await fetch(
        "https://nominatim.openstreetmap.org/reverse?" +
        params.toString(),
        {
            headers: {
                "Accept": "application/json"
            }
        }
    );

    if (!response.ok) {
        throw new Error("Reverse geocoding failed");
    }

    const result = await response.json();

    return {
        lat: lat,
        lon: lon,
        name: result.display_name || "Current Location",
        address: result.address || {},
        state: result.address?.state || "",
        country: result.address?.country || "",
        countryCode: result.address?.country_code || "",
        city:
            result.address?.city ||
            result.address?.town ||
            result.address?.municipality ||
            result.address?.village ||
            ""
    };
}

function getCurrentLocation(options = {}) {
    if (!navigator.geolocation) {
        return Promise.reject(
            new Error("Location is not supported on this device.")
        );
    }

    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            async position => {
                try {
                    const location = await reverseGeocode(
                        position.coords.latitude,
                        position.coords.longitude
                    );

                    location.source = "GPS";
                    location.accuracy =
                        Number.isFinite(position.coords.accuracy)
                            ? position.coords.accuracy
                            : null;

                    resolve(location);
                } catch (error) {
                    reject(error);
                }
            },
            error => {
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: options.timeout || 15000,
                maximumAge: options.maximumAge || 30000
            }
        );
    });
}

async function calculateRoute(pickup, destination, method) {
    if (!pickup || !destination) {
        throw new Error("Pickup and destination are required.");
    }

    const pickupLat = Number(pickup.lat);
    const pickupLon = Number(pickup.lon);
    const destinationLat = Number(destination.lat);
    const destinationLon = Number(destination.lon);

    if (
        !Number.isFinite(pickupLat) ||
        !Number.isFinite(pickupLon) ||
        !Number.isFinite(destinationLat) ||
        !Number.isFinite(destinationLon)
    ) {
        throw new Error("Invalid pickup or destination coordinates.");
    }

    const normalizedMethod =
        String(method || "DRIVER").toUpperCase();

    /*
        CANONICAL DISTANCE

        All delivery methods use the same OSRM
        driving route for distance.

        This keeps pricing and displayed distance
        consistent across Walker, Rider and Driver.
    */

    const osrmUrl =
        "https://router.project-osrm.org/route/v1/driving/" +
        pickupLon + "," + pickupLat + ";" +
        destinationLon + "," + destinationLat +
        "?overview=false";

    const osrmResponse = await fetch(osrmUrl);

    if (!osrmResponse.ok) {
        throw new Error("Route calculation failed.");
    }

    const osrmData = await osrmResponse.json();

    if (
        !osrmData.routes ||
        !osrmData.routes.length
    ) {
        throw new Error("Route unavailable.");
    }

    const drivingRoute = osrmData.routes[0];

    const distanceKm =
        drivingRoute.distance / 1000;

    /*
        METHOD-SPECIFIC ETA

        Walker and Rider use Valhalla because
        their travel speeds/routes differ.

        Driver uses the OSRM driving duration.
    */

    let durationMinutes =
        drivingRoute.duration / 60;

    if (
        normalizedMethod === "WALKER" ||
        normalizedMethod === "BICYCLIST" ||
        normalizedMethod === "RIDER"
    ) {
        const costing =
            normalizedMethod === "WALKER"
                ? "pedestrian"
                : normalizedMethod === "BICYCLIST"
                    ? "bicycle"
                    : "motorcycle";

        const valhallaResponse = await fetch(
            "https://valhalla1.openstreetmap.de/route",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    locations: [
                        {
                            lat: pickupLat,
                            lon: pickupLon
                        },
                        {
                            lat: destinationLat,
                            lon: destinationLon
                        }
                    ],
                    costing,
                    units: "kilometers"
                })
            }
        );

        if (!valhallaResponse.ok) {
            throw new Error(
                "Method-specific ETA calculation failed."
            );
        }

        const valhallaData =
            await valhallaResponse.json();

        const summary =
            valhallaData?.trip?.summary;

        if (
            !summary ||
            !Number.isFinite(
                Number(summary.time)
            )
        ) {
            throw new Error(
                "Method-specific ETA unavailable."
            );
        }

        durationMinutes =
            Number(summary.time) / 60;
    }

    return {
        distanceKm,
        durationMinutes
    };
}

window.DreypellaLocation = {
    searchLocation,
    reverseGeocode,
    getCurrentLocation,
    calculateRoute
};
