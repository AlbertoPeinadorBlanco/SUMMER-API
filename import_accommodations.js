const mysql = require('mysql2/promise');
require('dotenv').config();

const data = [
    {
        "id": 1,
        "accommodation_name": "Camping Colombres",
        "location_name": "Colombres, Ribadedeva, Asturias, Spain",
        "coordinates": {
            "latitude": 43.3768,
            "longitude": -4.5424
        },
        "access_to_sea_difficulty": "Media (Requiere coche hasta la playa)",
        "brief_description": "Camping familiar de alta calidad en el extremo oriental de Asturias. Excelente base logística rodeada de naturaleza, ideal para explorar la Playa de La Franca y descender el río Deva.",
        "visitors_rating": 4.5,
        "image_url": "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 2,
        "accommodation_name": "Camping La Paz",
        "location_name": "Vidiago, Llanes, Asturias, Spain",
        "coordinates": {
            "latitude": 43.4144,
            "longitude": -4.6852
        },
        "access_to_sea_difficulty": "Muy Baja (Acceso directo a la arena)",
        "brief_description": "Uno de los campings con mejores vistas de España, escalonado sobre un acantilado verde con acceso directo a la Playa de Vidiago. Perfecto para amanecer junto a las olas con el equipo listo.",
        "visitors_rating": 4.3,
        "image_url": "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 3,
        "accommodation_name": "Hotel Las Brisas",
        "location_name": "Playa de Poo, Llanes, Asturias, Spain",
        "coordinates": {
            "latitude": 43.4251,
            "longitude": -4.7828
        },
        "access_to_sea_difficulty": "Muy Baja (A pie de playa)",
        "brief_description": "Hotel con encanto situado literalmente sobre la Playa de Poo. Su ubicación es inmejorable para usuarios de Paddle Surf (SUP) que quieran aprovechar las mareas de la piscina natural.",
        "visitors_rating": 4.4,
        "image_url": "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 4,
        "accommodation_name": "Camping Las Conchas",
        "location_name": "Playa de Poo, Llanes, Asturias, Spain",
        "coordinates": {
            "latitude": 43.4239,
            "longitude": -4.7865
        },
        "access_to_sea_difficulty": "Baja (A 200 metros del agua)",
        "brief_description": "Camping pequeño, tranquilo e independiente a escasos minutos a pie de la Playa de Poo. Ideal para mochileros y furgonetas camper orientadas al turismo activo.",
        "visitors_rating": 4.1,
        "image_url": "https://images.unsplash.com/photo-1496545672447-f699b503d270?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 5,
        "accommodation_name": "Apartamentos Toró",
        "location_name": "Llanes (Villa), Asturias, Spain",
        "coordinates": {
            "latitude": 43.4194,
            "longitude": -4.7469
        },
        "access_to_sea_difficulty": "Baja (Caminando a la Playa de Toró)",
        "brief_description": "Apartamentos totalmente equipados junto a la singular Playa de Toró. Ofrecen espacio cómodo para guardar tablas de surf, trajes y equipo deportivo a cubierto.",
        "visitors_rating": 4.6,
        "image_url": "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 6,
        "accommodation_name": "Camping Troenzo",
        "location_name": "Celorio, Llanes, Asturias, Spain",
        "coordinates": {
            "latitude": 43.4358,
            "longitude": -4.8142
        },
        "access_to_sea_difficulty": "Muy Baja (A pie de cala)",
        "brief_description": "Ubicado en la hermosa península de Celorio, rodeado de pequeñas calas resguardadas. Un punto estratégico espectacular para rutas guiadas en Kayak de mar.",
        "visitors_rating": 4.2,
        "image_url": "https://images.unsplash.com/photo-1537905569824-f89f14cceb68?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 7,
        "accommodation_name": "Camping Playa de San Antolín",
        "location_name": "Naves, Llanes, Asturias, Spain",
        "coordinates": {
            "latitude": 43.4428,
            "longitude": -4.8679
        },
        "access_to_sea_difficulty": "Muy Baja (Directo a zona de escuelas)",
        "brief_description": "Situado al pie de la inmensa playa de San Antolín, famosa por sus escuelas de surf integradas y oleaje constante. Ideal para saltar directamente de la tienda al agua.",
        "visitors_rating": 4.0,
        "image_url": "https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 8,
        "accommodation_name": "Surf House Ribadesella",
        "location_name": "Ribadesella (Casco), Asturias, Spain",
        "coordinates": {
            "latitude": 43.4595,
            "longitude": -5.0612
        },
        "access_to_sea_difficulty": "Baja (10 minutos a pie de Santa Marina)",
        "brief_description": "Albergue de ambiente joven y surfero diseñado específicamente para deportistas. Ofrece alquiler de material, espacio de limpieza de trajes y lavandería técnica.",
        "visitors_rating": 4.7,
        "image_url": "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 9,
        "accommodation_name": "Camping Los Cantiles",
        "location_name": "Luarca, Valdés, Asturias, Spain",
        "coordinates": {
            "latitude": 43.5492,
            "longitude": -6.5244
        },
        "access_to_sea_difficulty": "Media (Ubicado sobre acantilado)",
        "brief_description": "Emplazado sobre un imponente acantilado con vistas panorámicas al mar Cantábrico en el occidente asturiano. Entorno natural idílico de alta desconexión.",
        "visitors_rating": 4.4,
        "image_url": "https://images.unsplash.com/photo-1475518112798-88ae398225ed?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 10,
        "accommodation_name": "Camping Ribadesella",
        "location_name": "Sevares, Ribadesella, Asturias, Spain",
        "coordinates": {
            "latitude": 43.4542,
            "longitude": -5.0841
        },
        "access_to_sea_difficulty": "Media (Requiere transporte ligero)",
        "brief_description": "Uno de los campings tipo 'Resort' mejor equipados del norte, con piscinas cubiertas y gimnasio. Muy demandado por familias de surfistas que buscan confort.",
        "visitors_rating": 4.6,
        "image_url": "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 11,
        "accommodation_name": "Camping Arenal de Morís",
        "location_name": "Caravia Alta, Asturias, Spain",
        "coordinates": {
            "latitude": 43.4691,
            "longitude": -5.1785
        },
        "access_to_sea_difficulty": "Baja (Sendero directo a la playa)",
        "brief_description": "Camping tranquilo y muy cuidado con acceso peatonal cómodo al Arenal de Morís. Destino clave para coger olas desde primera hora de la mañana.",
        "visitors_rating": 4.4,
        "image_url": "https://images.unsplash.com/photo-1521401830884-6c03c1c87ebb?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 12,
        "accommodation_name": "Camping Costa Verde",
        "location_name": "Playa de La Espasa, Colunga, Asturias, Spain",
        "coordinates": {
            "latitude": 43.4739,
            "longitude": -5.2189
        },
        "access_to_sea_difficulty": "Muy Baja (Pegado a la arena)",
        "brief_description": "Familiar y llano, situado junto al Río Espasa y la inmensa playa homónima. Punto de encuentro fantástico para escuelas de surf, windsurf y kitesurf.",
        "visitors_rating": 4.2,
        "image_url": "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 13,
        "accommodation_name": "Hotel Villa Rosario",
        "location_name": "Playa de Santa Marina, Ribadesella, Asturias, Spain",
        "coordinates": {
            "latitude": 43.4649,
            "longitude": -5.0701
        },
        "access_to_sea_difficulty": "Muy Baja (Paseo marítimo frontal)",
        "brief_description": "Un hotel de lujo en un palacete indiano histórico totalmente reformado en primera línea de playa. Máximo confort para combinar turismo premium y deportes de mar.",
        "visitors_rating": 4.7,
        "image_url": "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 14,
        "accommodation_name": "Camping Deva",
        "location_name": "Gijón (Periferia), Asturias, Spain",
        "coordinates": {
            "latitude": 43.5186,
            "longitude": -5.6022
        },
        "access_to_sea_difficulty": "Media (Conectado por carril bici / bus)",
        "brief_description": "Enorme complejo de acampada con bungalows de madera. Muy popular para grupos organizados de surf que operan en la Playa de San Lorenzo de Gijón.",
        "visitors_rating": 4.3,
        "image_url": "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 15,
        "accommodation_name": "Camping Perlora",
        "location_name": "Candás, Carreño, Asturias, Spain",
        "coordinates": {
            "latitude": 43.5862,
            "longitude": -5.7533
        },
        "access_to_sea_difficulty": "Baja (Cerca de calas de roca)",
        "brief_description": "Ubicado junto a la Ciudad de Vacaciones de Perlora. Perfecto para actividades tranquilas, buceo con tubo, snorkel y paseos costeros familiares.",
        "visitors_rating": 4.1,
        "image_url": "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 16,
        "accommodation_name": "Camping L'Ameixora",
        "location_name": "Cudillero (Entorno), Asturias, Spain",
        "coordinates": {
            "latitude": 43.5599,
            "longitude": -6.1822
        },
        "access_to_sea_difficulty": "Media (Acceso a acantilados)",
        "brief_description": "Camping rural costero muy cercano al puerto pintoresco de Cudillero y a senderos que bajan a playas salvajes de cantos como El Silencio.",
        "visitors_rating": 4.3,
        "image_url": "https://images.unsplash.com/photo-1561501900-3701fa6a0864?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 17,
        "accommodation_name": "Hotel Playa de Aguilar",
        "location_name": "Muros de Nalón, Asturias, Spain",
        "coordinates": {
            "latitude": 43.5539,
            "longitude": -6.1264
        },
        "access_to_sea_difficulty": "Baja (A 5 minutos andando del agua)",
        "brief_description": "Alojamiento moderno y acogedor en un entorno boscoso que desciende hacia la Playa de Aguilar. Excelente punto para amantes del senderismo costero y surf.",
        "visitors_rating": 4.5,
        "image_url": "https://images.unsplash.com/photo-1495365200479-c4ed1d35e1aa?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 18,
        "accommodation_name": "Camping Vegamar",
        "location_name": "Castropol, Asturias, Spain",
        "coordinates": {
            "latitude": 43.5485,
            "longitude": -6.9742
        },
        "access_to_sea_difficulty": "Baja (Cerca de la Ría del Eo)",
        "brief_description": "Situado en el límite con Galicia. Perfecto para los amantes del windsurf, kitesurf y vela ligera gracias a las corrientes controladas y vientos de la ría.",
        "visitors_rating": 4.2,
        "image_url": "https://images.unsplash.com/photo-1568051243851-f9b136146e97?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 19,
        "accommodation_name": "Camping Playa de Otur",
        "location_name": "Otur, Valdés, Asturias, Spain",
        "coordinates": {
            "latitude": 43.5469,
            "longitude": -6.5925
        },
        "access_to_sea_difficulty": "Baja (600 metros de sendero llano)",
        "brief_description": "Camping muy verde e integrado en el paisaje rural que conduce a la Playa de Otur ( arenal con excelente oleaje para bodyboard y surf intermedio).",
        "visitors_rating": 4.3,
        "image_url": "https://images.unsplash.com/photo-1549294413-26f195afcbce?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 20,
        "accommodation_name": "Camping Amaido",
        "location_name": "San Tirso de Abres, Asturias, Spain",
        "coordinates": {
            "latitude": 43.4024,
            "longitude": -7.1352
        },
        "access_to_sea_difficulty": "Alta (Camping de Interior / Río Eo)",
        "brief_description": "Camping de turismo rural activo y granja. Aunque no está en mar abierto, es la base más famosa para el piragüismo, descenso de ríos y canoas en el tramo bajo del Eo.",
        "visitors_rating": 4.7,
        "image_url": "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&w=800&q=80"
    }
];

async function seed() {
    console.log("Connecting to the database...");
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_surf'
    });

    console.log("Connected. Inserting accommodations...");
    for (const item of data) {
        const link = `https://www.google.com/maps/search/?api=1&query=${item.coordinates.latitude},${item.coordinates.longitude}`;
        
        let type = 'camping';
        const nameLower = item.accommodation_name.toLowerCase();
        if (nameLower.includes('hotel')) type = 'hotel';
        if (nameLower.includes('apartamento')) type = 'apartment';
        if (nameLower.includes('surf house')) type = 'surfhouse';

        const desc = item.brief_description;
        const fullDesc = `${desc}\\n\\nAccess to Sea Difficulty: ${item.access_to_sea_difficulty}`;

        try {
            await connection.query(
                'INSERT INTO accommodations (name, type, location, image_url, description_en, description_es, link) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    item.accommodation_name, 
                    type,
                    item.location_name, 
                    item.image_url, 
                    fullDesc, 
                    fullDesc,
                    link
                ]
            );
            console.log(`✅ Inserted: ${item.accommodation_name}`);
        } catch (err) {
            console.error(`❌ Failed to insert ${item.accommodation_name}:`, err.message);
        }
    }
    
    await connection.end();
    console.log("Accommodations Seed completed!");
}

seed().catch(err => {
    console.error("Fatal error during seeding:", err);
    process.exit(1);
});
