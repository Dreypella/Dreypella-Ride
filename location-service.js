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

    const normalizedMethod = String(method || "DRIVER").toUpperCase();

    if (
        normalizedMethod === "WALKER" ||
        normalizedMethod === "RIDER"
    ) {
        const costing =
            normalizedMethod === "WALKER"
                ? "pedestrian"
                : "motorcycle";

        const response = await fetch(
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

        if (!response.ok) {
            throw new Error("Valhalla route calculation failed.");
        }

        const data = await response.json();
        const summary = data?.trip?.summary;

        if (
            !summary ||
            !Number.isFinite(Number(summary.length)) ||
            !Number.isFinite(Number(summary.time))
        ) {
            throw new Error("Valhalla route unavailable.");
        }

        return {
            distanceKm: Number(summary.length),
            durationMinutes: Number(summary.time) / 60
        };
    }

    const url =
        "https://router.project-osrm.org/route/v1/driving/" +
        pickupLon + "," + pickupLat + ";" +
        destinationLon + "," + destinationLat +
        "?overview=false";

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Route calculation failed.");
    }

    const data = await response.json();

    if (!data.routes || !data.routes.length) {
        throw new Error("Route unavailable.");
    }

    const route = data.routes[0];

    return {
        distanceKm: route.distance / 1000,
        durationMinutes: route.duration / 60
    };
}

window.DreypellaLocation = {
    searchLocation,
    reverseGeocode,
    getCurrentLocation,
    calculateRoute
};
