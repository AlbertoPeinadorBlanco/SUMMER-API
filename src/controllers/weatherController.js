const { calculateTide } = require('../utils/tideCalculator');

exports.getLiveConditions = async (req, res) => {
    const { lat, lon, aemet_id } = req.query;

    if (!lat || !lon) {
        return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    try {
        const [weatherRes, marineRes] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,visibility&daily=sunrise,sunset,uv_index_max&timezone=auto`),
            fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wave_period&hourly=wave_height,wave_period&timezone=auto`)
        ]);

        if (!weatherRes.ok || !marineRes.ok) {
            throw new Error('Failed to fetch from Open-Meteo API');
        }

        const weatherData = await weatherRes.json();
        const marineJson = await marineRes.json();

        let marineData = null;
        if (marineJson.current) {
            marineData = marineJson.current;
        }

        if (marineData) {
            marineData.tide = calculateTide(lat, lon);
            
            // Try to fetch AEMET water temperature if API key and ID are present
            let aemetTemp = null;
            if (aemet_id && process.env.AEMET_API_KEY) {
                try {
                    const aemetInitialRes = await fetch(`https://opendata.aemet.es/opendata/api/prediccion/especifica/playa/${aemet_id}/?api_key=${process.env.AEMET_API_KEY}`);
                    if (aemetInitialRes.ok) {
                        const aemetInitialData = await aemetInitialRes.json();
                        if (aemetInitialData.estado === 200 && aemetInitialData.datos) {
                            const aemetDataRes = await fetch(aemetInitialData.datos);
                            if (aemetDataRes.ok) {
                                const beachData = await aemetDataRes.json();
                                if (beachData && beachData[0] && beachData[0].prediccion && beachData[0].prediccion.dia[0]) {
                                    const tAgua = beachData[0].prediccion.dia[0].tAgua;
                                    if (tAgua) {
                                        aemetTemp = tAgua.valor1 || tAgua;
                                    }
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('AEMET fetch failed', err);
                }
            }

            if (aemetTemp !== null && !isNaN(parseFloat(aemetTemp))) {
                marineData.water_temperature = parseFloat(aemetTemp).toFixed(1);
            } else if (marineData.ocean_temperature !== undefined && marineData.ocean_temperature !== null) {
                marineData.water_temperature = marineData.ocean_temperature.toFixed(1);
            } else {
                // Fallback simulation if both AEMET and Open-Meteo fail
                const seed = Math.abs(parseFloat(lat) + parseFloat(lon));
                marineData.water_temperature = (15 + (seed % 6)).toFixed(1); 
            }
        }

        res.set('Cache-Control', 'no-store'); 
        res.json({
            weather: weatherData,
            marine: marineData
        });
    } catch (error) {
        console.error('Weather API Error:', error);
        res.status(500).json({ message: 'Error fetching live conditions', error: error.message });
    }
};
