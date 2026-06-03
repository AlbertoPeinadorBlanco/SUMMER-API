const pool = require('./src/config/db');

async function cleanPricings() {
    try {
        await pool.query("INSERT IGNORE INTO platform_pricings (item_key, description, price, currency) VALUES ('buy_advert_slot', 'Lifetime extra advert slot', 10.00, 'EUR')");
        console.log('Added buy_advert_slot');
    } catch(e) { console.log(e.message); }
    process.exit(0);
}

cleanPricings();
