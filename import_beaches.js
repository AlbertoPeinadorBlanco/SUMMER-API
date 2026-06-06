const mysql = require('mysql2/promise');
require('dotenv').config();

const beaches = [
    {
        "id": 1,
        "beach_name": "Playa de La Franca",
        "location_name": "Ribadedeva, Asturias, Spain",
        "coordinates": {
            "latitude": 43.3916,
            "longitude": -4.5772
        },
        "water_activities_difficulty_level": "Baja - Moderada",
        "brief_description": "Amplia playa de arena blanca resguardada de los vientos. Con marea baja se conecta con calas escondidas y cuevas con antiguas cetáreas de langostas. Muy familiar.",
        "visitors_rating": 4.6,
        "image_url": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 2,
        "beach_name": "Playa de Cobijeru",
        "location_name": "Buelna, Llanes, Asturias, Spain",
        "coordinates": {
            "latitude": 43.4002,
            "longitude": -4.6111
        },
        "water_activities_difficulty_level": "Nula",
        "brief_description": "Un Monumento Natural único. Es una playa de interior rodeada de prados verdes, donde el agua del mar se filtra a través de las rocas subterráneas creando una piscina salada flotante.",
        "visitors_rating": 4.5,
        "image_url": "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 3,
        "beach_name": "Playa de Ballota",
        "location_name": "Cué, Llanes, Asturias, Spain",
        "coordinates": {
            "latitude": 43.4111,
            "longitude": -4.7175
        },
        "water_activities_difficulty_level": "Moderada",
        "brief_description": "Impresionante playa salvaje de herradura vigilada por el gran islote 'Castro de Ballota'. Destaca por su bufón (chimenea en la roca que expulsa chorros de agua a presión).",
        "visitors_rating": 4.7,
        "image_url": "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 4,
        "beach_name": "Playa de Poo",
        "location_name": "Poo, Llanes, Asturias, Spain",
        "coordinates": {
            "latitude": 43.4267,
            "longitude": -4.7831
        },
        "water_activities_difficulty_level": "Muy Baja",
        "brief_description": "Catalogada como una de las mejores playas de Europa para ir con niños. Al estar al fondo de un embudo de acantilados, el mar entra calmado formando una piscina natural perfecta para Paddle Surf.",
        "visitors_rating": 4.6,
        "image_url": "https://images.unsplash.com/photo-1473116763269-25541579ffbe?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 5,
        "beach_name": "Playa de Torimbia",
        "location_name": "Niembro, Llanes, Asturias, Spain",
        "coordinates": {
            "latitude": 43.4419,
            "longitude": -4.8422
        },
        "water_activities_difficulty_level": "Alta",
        "brief_description": "Un icono del naturismo y de los paisajes salvajes en España. Tiene forma de media luna perfecta con acantilados verticales de más de 50 metros de vegetacián exuberante.",
        "visitors_rating": 4.8,
        "image_url": "https://images.unsplash.com/photo-1433832597026-4b8758572271?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 6,
        "beach_name": "Playa de Gulpiyuri",
        "location_name": "Naves, Llanes, Asturias, Spain",
        "coordinates": {
            "latitude": 43.4474,
            "longitude": -4.886
        },
        "water_activities_difficulty_level": "Nula",
        "brief_description": "La playa más pequeña del mundo y una de las más famosas de Asturias. Está situada en mitad de un prado verde, alimentándose de agua a través de grietas en los acantilados.",
        "visitors_rating": 4.4,
        "image_url": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 7,
        "beach_name": "Playa de Cuevas del Mar",
        "location_name": "Nueva, Llanes, Asturias, Spain",
        "coordinates": {
            "latitude": 43.4561,
            "longitude": -4.9378
        },
        "water_activities_difficulty_level": "Baja",
        "brief_description": "Famosa por sus caprichosas formaciones geológicas de roca caliza talladas por el oleaje, que forman arcos de piedra y cuevas visibles sobre la arena.",
        "visitors_rating": 4.6,
        "image_url": "https://images.unsplash.com/photo-1468413253725-0d5181030129?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 8,
        "beach_name": "Playa de Guadamía",
        "location_name": "Llames de Pría, Llanes, Asturias, Spain",
        "coordinates": {
            "latitude": 43.4552,
            "longitude": -4.9818
        },
        "water_activities_difficulty_level": "Baja",
        "brief_description": "Funciona como un canal o canalón natural excavado en la roca donde el río Guadamía se une al mar. Justo al lado se encuentran los famosos Bufones de Pría.",
        "visitors_rating": 4.5,
        "image_url": "https://images.unsplash.com/photo-1476673160081-cf065bfd5f1a?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 9,
        "beach_name": "Playa de Santa Marina",
        "location_name": "Ribadesella, Asturias, Spain",
        "coordinates": {
            "latitude": 43.4655,
            "longitude": -5.0673
        },
        "water_activities_difficulty_level": "Moderada - Alta",
        "brief_description": "Playa urbana señorial rodeada de impresionantes palacetes de indianos de principios del siglo XX. Es un punto neurálgico para escuelas de surf.",
        "visitors_rating": 4.5,
        "image_url": "https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 10,
        "beach_name": "Playa de Vega",
        "location_name": "Vega, Ribadesella, Asturias, Spain",
        "coordinates": {
            "latitude": 43.4815,
            "longitude": -5.1345
        },
        "water_activities_difficulty_level": "Muy Alta",
        "brief_description": "Uno de los arenales más extensos y salvajes del oriente de Asturias, con un sistema de dunas protegido. Al estar abierta al Cantábrico, tiene un oleaje fuerte y constante.",
        "visitors_rating": 4.7,
        "image_url": "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 11,
        "beach_name": "Playa de Arenal de Morís",
        "location_name": "Caravia, Asturias, Spain",
        "coordinates": {
            "latitude": 43.4755,
            "longitude": -5.1818
        },
        "water_activities_difficulty_level": "Alta",
        "brief_description": "Un destino espectacular rodeado de praderas verdes que tocan la arena. Es muy conocida en el circuito regional de surf por albergar campeonatos.",
        "visitors_rating": 4.6,
        "image_url": "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 12,
        "beach_name": "Playa de La Espasa",
        "location_name": "Colunga, Asturias, Spain",
        "coordinates": {
            "latitude": 43.475,
            "longitude": -5.2152
        },
        "water_activities_difficulty_level": "Moderada",
        "brief_description": "Una playa inmensa que se une con la de La Isla en marea baja. Es excelente tanto para el aprendizaje de surf y windsurf como para el vuelo de cometas.",
        "visitors_rating": 4.6,
        "image_url": "https://images.unsplash.com/photo-1418854982207-12f710b74003?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 13,
        "beach_name": "Playa de Rodiles",
        "location_name": "Selorio, Villaviciosa, Asturias, Spain",
        "coordinates": {
            "latitude": 43.5333,
            "longitude": -5.3775
        },
        "water_activities_difficulty_level": "Muy Alta",
        "brief_description": "Una de las joyas de la corona del surf en España, ubicada en la Reserva Natural de la Ría de Villaviciosa. Su ola izquierda en la desembocadura es mundialmente famosa.",
        "visitors_rating": 4.7,
        "image_url": "https://images.unsplash.com/photo-1455717974081-0436a099796e?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 14,
        "beach_name": "Playa de San Lorenzo",
        "location_name": "Gijón, Asturias, Spain",
        "coordinates": {
            "latitude": 43.5414,
            "longitude": -5.6515
        },
        "water_activities_difficulty_level": "Baja - Moderada",
        "brief_description": "La playa urbana por excelencia de Asturias, en pleno corazón de Gijón. Cuenta con un paseo marítimo de casi 3 km. Ideal para iniciación en surf y kayak.",
        "visitors_rating": 4.6,
        "image_url": "https://images.unsplash.com/photo-1563911302283-d2bc1d982df5?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 15,
        "beach_name": "Playa de Xagó",
        "location_name": "Gozón, Asturias, Spain",
        "coordinates": {
            "latitude": 43.6081,
            "longitude": -5.9189
        },
        "water_activities_difficulty_level": "Alta",
        "brief_description": "Un arenal salvaje de casi 2 km de longitud flanqueado por un imponente sistema de dunas protegidas. Excelente consistencia de olas en verano.",
        "visitors_rating": 4.5,
        "image_url": "https://images.unsplash.com/photo-1485833364774-36bc9a147162?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 16,
        "beach_name": "Playa de Aguilar",
        "location_name": "Muros de Nalón, Asturias, Spain",
        "coordinates": {
            "latitude": 43.5552,
            "longitude": -6.1219
        },
        "water_activities_difficulty_level": "Moderada",
        "brief_description": "Rodeada de bosques y acantilados suaves, es de arena fina dorada. Su estampa más famosa la componen las enormes rocas esculpidas que emergen de la arena.",
        "visitors_rating": 4.6,
        "image_url": "https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 17,
        "beach_name": "Playa del Silencio",
        "location_name": "Castañeras, Cudillero, Asturias, Spain",
        "coordinates": {
            "latitude": 43.5658,
            "longitude": -6.2325
        },
        "water_activities_difficulty_level": "Baja",
        "brief_description": "Una bahía natural semicircular resguardada por gigantescos acantilados de roca que frenan las olas. Es de cantos rodados y destaca por sus aguas cristalinas.",
        "visitors_rating": 4.8,
        "image_url": "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 18,
        "beach_name": "Playa de Cadavedo",
        "location_name": "Cadavedo, Valdés, Asturias, Spain",
        "coordinates": {
            "latitude": 43.5539,
            "longitude": -6.3741
        },
        "water_activities_difficulty_level": "Moderada",
        "brief_description": "Hermosa playa con forma de lengua o triángulo invertido, compuesta de arena oscura y piedras en un entorno rural protegido. Ideal para buceo.",
        "visitors_rating": 4.6,
        "image_url": "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 19,
        "beach_name": "Playa de Frejulfe",
        "location_name": "Navia, Asturias, Spain",
        "coordinates": {
            "latitude": 43.5601,
            "longitude": -6.6811
        },
        "water_activities_difficulty_level": "Muy Alta",
        "brief_description": "Declarada Monumento Natural, es una playa inmensa de arena oscura orientada al norte puro. Su oleaje es muy potente y rompe con fuerza en la orilla.",
        "visitors_rating": 4.7,
        "image_url": "https://images.unsplash.com/photo-1520116468816-95b69f847357?auto=format&fit=crop&w=800&q=80"
    },
    {
        "id": 20,
        "beach_name": "Playa de Peñarronda",
        "location_name": "Castropol, Asturias, Spain",
        "coordinates": {
            "latitude": 43.5532,
            "longitude": -7.0019
        },
        "water_activities_difficulty_level": "Alta",
        "brief_description": "Playa salvaje dividida por un río, cuyo elemento característico es una enorme roca horadada en el centro. Punto estratégico para el surf occidental.",
        "visitors_rating": 4.7,
        "image_url": "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80"
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

    console.log("Connected. Inserting beaches...");
    for (const beach of beaches) {
        const map_link = `https://www.google.com/maps/search/?api=1&query=${beach.coordinates.latitude},${beach.coordinates.longitude}`;
        
        try {
            await connection.query(
                'INSERT INTO beaches (name, location, map_link, image_url, level, description_en, description_es) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    beach.beach_name, 
                    beach.location_name, 
                    map_link, 
                    beach.image_url, 
                    beach.water_activities_difficulty_level, 
                    beach.brief_description, 
                    beach.brief_description
                ]
            );
            console.log(`✅ Inserted: ${beach.beach_name}`);
        } catch (err) {
            console.error(`❌ Failed to insert ${beach.beach_name}:`, err.message);
        }
    }
    
    await connection.end();
    console.log("Seed completed!");
}

seed().catch(err => {
    console.error("Fatal error during seeding:", err);
    process.exit(1);
});
