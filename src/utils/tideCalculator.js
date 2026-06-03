// Simple harmonic tide calculator for the Cantabrian Sea (Asturias)
// Tides in this region are semi-diurnal (two high and two low tides roughly every 24 hours 50 minutes)

exports.calculateTide = (lat, lon) => {
    // The tidal cycle is approximately 12 hours and 25.2 minutes (M2 constituent)
    const M2_PERIOD_MS = 12.4206012 * 60 * 60 * 1000;
    
    // Arbitrary recent high tide epoch for Asturias (UTC) - e.g., 2026-06-01T02:00:00Z
    // This allows the math to generate realistic cyclical values relative to a fixed point in time.
    const epochHighTide = new Date('2026-06-01T02:00:00Z').getTime();
    
    const now = Date.now();
    const elapsed = now - epochHighTide;
    
    // Calculate phase (0 to 2*PI). A phase of 0 means high tide, PI means low tide.
    const phase = (elapsed % M2_PERIOD_MS) / M2_PERIOD_MS * 2 * Math.PI;
    
    // Mean sea level offset and amplitude for Cantabrian sea (approximate in meters)
    const amplitude = 1.6; 
    const meanLevel = 2.0;
    
    // Cosine wave: Peak at phase=0, trough at phase=PI
    const tideHeight = meanLevel + amplitude * Math.cos(phase);
    
    // Add a slight phase shift based on longitude to account for east-west differences
    // (Asturias is around -6 lon)
    const lonShift = (parseFloat(lon) + 6) * 0.1; 
    
    return (tideHeight + lonShift).toFixed(2);
};
