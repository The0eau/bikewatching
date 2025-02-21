// Set your Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1IjoidGhlYXVhIiwiYSI6ImNtN2UzZHFnajA0amMyeW44OTNkbzVzejAifQ.T1zXIa0LG5yETYDBiGSqSw';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // Map style
  center: [-71.09415, 42.36027], // [longitude, latitude] (Boston area)
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18 // Maximum allowed zoom
});

map.on('load', () => {
  // Boston Bike Lanes
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson'
  });

  // Cambridge Bike Lanes
  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson' // Replace with actual link
  });

  const bikeLaneStyle = {
    'line-width': 3,
    'line-opacity': 0.4
  };
  
  map.addLayer({
    id: 'bike-lanes-boston',
    type: 'line',
    source: 'boston_route',
    paint: { 'line-color': 'green', ...bikeLaneStyle }
  });
  
  map.addLayer({
    id: 'bike-lanes-cambridge',
    type: 'line',
    source: 'cambridge_route',
    paint: { 'line-color': 'blue', ...bikeLaneStyle }
  });

});    
// Load the nested JSON file for stations
const jsonurl = "https://dsc106.com/labs/lab07/data/bluebikes-stations.json";
d3.json(jsonurl).then(jsonData => {
    const stations = jsonData.data.stations;
    console.log('Stations Array:', stations);

    // Step 4.1: Importing and Parsing the Traffic Data
    const tripsUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv'; // Link to traffic data
    d3.csv(tripsUrl).then((trips) => {
      console.log('Loaded traffic data:', trips);

      // Step 4.2: Calculate Traffic at Each Station
      const departures = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.start_station_id
      );

      const arrivals = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.end_station_id
      );

      // Adding arrivals, departures, and total traffic to stations
      const updatedStations = stations.map((station) => {
        let id = station.short_name;

        // Add arrivals and departures
        station.arrivals = arrivals.get(id) ?? 0;
        station.departures = departures.get(id) ?? 0;

        // Calculate total traffic
        station.totalTraffic = station.arrivals + station.departures;

        return station;
      });

      console.log('Updated stations with traffic data:', updatedStations);

      // Step 4.3: Size Markers According to Traffic

      // Create a square root scale for circle radii based on total traffic
    const radiusScale = d3.scaleSqrt()
      .domain([0, d3.max(updatedStations, (d) => d.totalTraffic)])
      .range([0, 5]); // Avant : [0, 25] -> Maintenant : [0, 5]


      

      // Call function to add station markers to the map with updated traffic data
      addStationMarkers(updatedStations, radiusScale);

    }).catch((error) => {
      console.error('Error loading traffic data:', error);
    });
  }).catch(error => {
    console.error('Error loading JSON:', error);  // Handle errors if JSON loading fails
  });


const svg = d3.select('#map').select('svg');

// Step 4.4: Adding Tooltip with Exact Traffic Numbers

// Create a div element for the custom tooltip
const tooltip = d3.select('body').append('div')
  .attr('class', 'tooltip')
  .style('position', 'absolute')
  .style('visibility', 'hidden')
  .style('background-color', 'rgba(0, 0, 0, 0.7)')
  .style('color', 'white')
  .style('padding', '5px')
  .style('border-radius', '4px');

// Function to get coordinates of the station for SVG projection
function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);  // Convert lon/lat to Mapbox LngLat
  const { x, y } = map.project(point);  // Project to pixel coordinates
  return { cx: x, cy: y };  // Return as object for use in SVG attributes
}

// Function to add station markers (SVG circles) to the map
function addStationMarkers(stations, radiusScale) {
    // Append circles for each station to the SVG element
    const circles = svg.selectAll('circle')
      .data(stations)
      .enter()
      .append('circle')
      .attr('r', d => radiusScale(d.totalTraffic))  // Set radius according to traffic
      .attr('fill', 'steelblue')  // Circle fill color
      .attr('stroke', 'white')    // Circle border color
      .attr('stroke-width', 1)    // Circle border thickness
      .attr('opacity', 0.8)       // Circle opacity
      .attr('pointer-events', 'auto') // Ensure tooltips are shown on hover
      .style("--departure-ratio", d => stationFlow(d.departures / d.totalTraffic));
  
    // Add a <title> element for each circle to provide browser tooltips
    circles.each(function(d) {
      d3.select(this)
        .append('title')
        .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
    });
  
    // Function to update circle positions when the map moves, zooms, or resizes
    function updatePositions() {
      circles
        .attr('cx', d => getCoords(d).cx)  // Set the x-position using projected coordinates
        .attr('cy', d => getCoords(d).cy); // Set the y-position using projected coordinates
    }
  
    // Initial position update when map loads
    updatePositions();
  
    // Reposition markers on map interactions (move, zoom, resize)
    map.on('move', updatePositions);     // Update during map movement
    map.on('zoom', updatePositions);     // Update during zooming
    map.on('resize', updatePositions);   // Update on window resize
    map.on('moveend', updatePositions);  // Final adjustment after movement ends
}

let timeFilter = -1; // Default: No filtering
const timeSlider = document.getElementById('time-slider');
const selectedTime = document.getElementById('selected-time');
const anyTimeLabel = document.getElementById('any-time');
function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes); // Create date with hours & minutes
    return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
  }




function updateTimeDisplay() {
    timeFilter = Number(timeSlider.value); // Get current slider value
  
    if (timeFilter === -1) {
      selectedTime.textContent = ''; // Clear displayed time
      anyTimeLabel.style.display = 'block'; // Show "(any time)"
    } else {
      selectedTime.textContent = formatTime(timeFilter); // Show formatted time
      anyTimeLabel.style.display = 'none'; // Hide "(any time)"
    }

}




function updateMapMarkers(filteredStations, newRadiusScale) {
    // Remove old circles
    svg.selectAll('circle').remove();
    console.log("fil")
    // Re-add filtered station markers with updated sizes
    addStationMarkers(filteredStations, newRadiusScale);
}



 d3.json(jsonurl).then(jsonData => {
   const stations = jsonData.data.stations;
   console.log('Stations Array:', stations);  // Assume trips is loaded via d3.csv(TRIP_DATA_URL)
        d3.csv('https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv').then(trips => {
        // Convert time strings to Date objects (do this once)
        // Declare filteredTrips and related data structures as top-level variables:
        let filteredTrips = [];
        let filteredArrivals = new Map();
        let filteredDepartures = new Map();
        let filteredStations = [];
        const parseTime = d3.timeParse('%Y-%m-%d %H:%M:%S');
        for (let trip of trips) {
            trip.started_at = new Date(trip.started_at);
            trip.ended_at = new Date(trip.ended_at);
            
        // do the same for end
    }
        // Helper function: convert a Date object to minutes since midnight
        function minutesSinceMidnight(date) {
        return date.getHours() * 60 + date.getMinutes();
        }
    
        
    
        // Function that filters trips based on the slider value (timeFilter)
        function filterTripsByTime() {
        // If no filtering is applied, use all trips; otherwise, filter by ±60 minutes.
        filteredTrips = timeFilter === -1 
            ? trips 
            : trips.filter(trip => {
                const startedMinutes = minutesSinceMidnight(trip.started_at);
                const endedMinutes = minutesSinceMidnight(trip.ended_at);
                return (
                Math.abs(startedMinutes - timeFilter) <= 60 ||
                Math.abs(endedMinutes - timeFilter) <= 60
                );
            });
            
        // Now update the arrivals and departures for the filtered trips
        filteredDepartures = d3.rollup(
            filteredTrips,
            v => v.length,
            d => d.start_station_id
        );
    
        filteredArrivals = d3.rollup(
            filteredTrips,
            v => v.length,
            d => d.end_station_id
        );
        // Update filteredStations based on the original stations array.
        // We clone each station object before updating to avoid mutating the original.
        // Create filteredStations by cloning stations and updating with filtered data
    filteredStations = stations.map(station => {
        let clonedStation = { ...station }; // Clone to avoid mutating the original station
        let id = clonedStation.short_name;

        clonedStation.arrivals = filteredArrivals.get(id) ?? 0;
        
        clonedStation.departures = filteredDepartures.get(id) ?? 0;
        clonedStation.totalTraffic = clonedStation.arrivals + clonedStation.departures;

        return clonedStation;
        });

        
    
    let newRadiusScale = d3.scaleSqrt()
      .domain([0, d3.max(filteredStations, d => d.totalTraffic)])
      .range(timeFilter === -1 ? [0, 5] : [0.6, 10]); // Avant : [0, 25] / [3, 50]


        // Now update the map markers with the new filtered station data and new radius scale.

        updateMapMarkers(filteredStations, newRadiusScale);
        }
        // Appel initial de la fonction de filtrage
    filterTripsByTime(); // Appliquer le filtrage dès le départ
    updateTimeDisplay();
    timeSlider.addEventListener('input', () => {
        updateTimeDisplay();  // Mettre à jour l'affichage du temps
        filterTripsByTime();  // Appliquer le filtrage
    });
    });
});
  
let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);


 
  