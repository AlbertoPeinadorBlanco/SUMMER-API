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
    

    
    // Add a slight phase shift based on longitude to account for east-west differences
    // (Asturias is around -6 lon). 1 degree lon is roughly 4 mins shift.
    const lonShiftMs = (parseFloat(lon) + 6) * 4 * 60 * 1000;
    
    // Adjust elapsed time
    const adjustedElapsed = elapsed + lonShiftMs;
    
    // Calculate phase (0 to 2*PI). A phase of 0 means high tide, PI means low tide.
    const phase = (adjustedElapsed % M2_PERIOD_MS) / M2_PERIOD_MS * 2 * Math.PI;
    
    // Determine state
    // Phase 0 to PI: dropping (bajando), towards low tide.
    // Phase PI to 2*PI: rising (subiendo), towards high tide.
    const isRising = phase >= Math.PI;
    
    // Time until next state
    let msUntilNext;
    let nextState;
    
    if (isRising) {
        nextState = 'high';
        // Next high tide is at 2*PI
        const msCurrentPhase = (phase / (2 * Math.PI)) * M2_PERIOD_MS;
        msUntilNext = M2_PERIOD_MS - msCurrentPhase;
    } else {
        nextState = 'low';
        // Next low tide is at PI
        const msCurrentPhase = (phase / (2 * Math.PI)) * M2_PERIOD_MS;
        const msAtPi = M2_PERIOD_MS / 2;
        msUntilNext = msAtPi - msCurrentPhase;
    }
    
    const totalMinutes = Math.floor(msUntilNext / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return {
        isRising,
        nextState,
        hours,
        minutes
    };
};
