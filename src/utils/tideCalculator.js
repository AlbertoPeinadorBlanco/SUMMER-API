/**
 * Fallback tide calculator using astronomical approximation
 * Returns the state of the tide (subiendo/bajando) and time until next extreme.
 */
function calculateTide(lat, lon) {
    const now = new Date();
    // Use an arbitrary epoch for M2 tidal constituent (approx 12h 25m)
    const M2_PERIOD_MS = 12 * 60 * 60 * 1000 + 25 * 60 * 1000;
    
    // Create a predictable offset based on coordinates
    const offsetMs = (Math.abs(lat) + Math.abs(lon)) * 1000000;
    
    const elapsed = now.getTime() + offsetMs;
    const phase = (elapsed % M2_PERIOD_MS) / M2_PERIOD_MS; // 0.0 to 1.0

    // High tide at phase 0.0 and 1.0
    // Low tide at phase 0.5
    const isRising = phase > 0.5;
    
    let nextState = '';
    let msUntilNext = 0;

    if (isRising) {
        nextState = 'high';
        msUntilNext = (1.0 - phase) * M2_PERIOD_MS;
    } else {
        nextState = 'low';
        msUntilNext = (0.5 - phase) * M2_PERIOD_MS;
    }

    const hours = Math.floor(msUntilNext / (1000 * 60 * 60));
    const minutes = Math.floor((msUntilNext % (1000 * 60 * 60)) / (1000 * 60));

    return {
        isRising,
        nextState,
        hours,
        minutes
    };
}

module.exports = { calculateTide };
