const mapElement = document.getElementById("campusMap");
const status = document.getElementById("mapStatus");
const searchForm = document.getElementById("mapSearchForm");
const searchInput = document.getElementById("mapSearchInput");
const locateButton = document.getElementById("locateMeButton");

if (mapElement && status && searchForm && searchInput && locateButton) {
    if (!window.L) {
        status.textContent = "The map library could not be loaded. Check your internet connection and reload this page.";
    } else {
        const map = L.map(mapElement, { zoomControl: true }).setView([20, 0], 2);
        let selectedMarker;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        const setStatus = (message) => {
            status.textContent = message;
        };

        const showPoint = (latitude, longitude, label, zoom = 15) => {
            const point = L.latLng(latitude, longitude);
            map.setView(point, zoom);
            selectedMarker?.remove();
            const popup = document.createElement("div");
            const title = document.createElement("strong");
            title.textContent = label;
            const coordinates = document.createElement("div");
            coordinates.textContent = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
            popup.append(title, coordinates);
            selectedMarker = L.marker(point).addTo(map).bindPopup(popup).openPopup();
        };

        map.on("click", (event) => {
            const { lat, lng } = event.latlng;
            showPoint(lat, lng, "Selected map location", map.getZoom());
            setStatus(`Selected location: ${lat.toFixed(5)}, ${lng.toFixed(5)}.`);
        });

        searchForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const query = searchInput.value.trim();
            if (!query) {
                searchInput.focus();
                setStatus("Enter a place or address to search.");
                return;
            }

            const searchButton = searchForm.querySelector("button[type=submit]");
            searchButton.disabled = true;
            setStatus("Searching OpenStreetMap...");
            const params = new URLSearchParams({ q: query, format: "jsonv2", limit: "1" });
            const controller = new AbortController();
            const timeout = window.setTimeout(() => controller.abort(), 10000);
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
                    headers: { Accept: "application/json" },
                    signal: controller.signal
                });
                if (!response.ok) throw new Error("Search service unavailable");
                const results = await response.json();
                if (!results.length) {
                    setStatus("No matching place found. Try a nearby city or a more specific address.");
                    return;
                }
                const result = results[0];
                showPoint(Number(result.lat), Number(result.lon), result.display_name, 16);
                setStatus(`Showing ${result.display_name}.`);
            } catch (error) {
                console.error("Map search error:", error);
                setStatus(error.name === "AbortError"
                    ? "Search timed out. Please try again."
                    : "Place search is unavailable right now. You can still pan and zoom the map.");
            } finally {
                window.clearTimeout(timeout);
                searchButton.disabled = false;
            }
        });

        locateButton.addEventListener("click", () => {
            if (!navigator.geolocation) {
                setStatus("This browser does not support location access. Search for a place instead.");
                return;
            }

            locateButton.disabled = true;
            setStatus("Requesting your location...");
            navigator.geolocation.getCurrentPosition((position) => {
                const { latitude, longitude } = position.coords;
                showPoint(latitude, longitude, "Your current location", 16);
                setStatus("Map centered on your current location.");
                locateButton.disabled = false;
            }, (error) => {
                const message = error.code === error.PERMISSION_DENIED
                    ? "Location permission was denied. Search for a place to move the map."
                    : "Your location could not be determined. Search for a place instead.";
                setStatus(message);
                locateButton.disabled = false;
            }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
        });

        window.setTimeout(() => map.invalidateSize(), 0);
    }
}