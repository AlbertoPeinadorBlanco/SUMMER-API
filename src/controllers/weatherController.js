exports.getLiveConditions = async (req, res) => {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
        return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    try {
        const [weatherRes, marineRes] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,visibility&daily=sunrise,sunset,uv_index_max&timezone=auto`),
            fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wave_period`)
        ]);

        if (!weatherRes.ok || !marineRes.ok) {
            throw new Error('Failed to fetch from Open-Meteo API');
        }

        const weatherData = await weatherRes.json();
        const marineJson = await marineRes.json();

        let marineData = null;
        if (marineJson.current) {
            marineData = marineJson.current;
        } else if (marineJson.hourly) {
            marineData = {
                wave_height: marineJson.hourly.wave_height[0],
                wave_period: marineJson.hourly.wave_period[0]
            };
        }

        res.set('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
        res.json({
            weather: weatherData,
            marine: marineData
        });
    } catch (error) {
        console.error('Weather API Error:', error);
        res.status(500).json({ message: 'Error fetching live conditions', error: error.message });
    }
};
