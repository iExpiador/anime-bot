const axios = require('axios');
const fs = require('fs');
const path = require('path');

const ANIME_ID = process.env.ANIME_ID || 28171;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// AniList API - Consulta GraphQL
const ANILIST_QUERY = `
query ($idMal: Int) {
  Media(idMal: $idMal, type: ANIME) {
    id
    idMal
    title {
      romaji
      english
      native
    }
    description
    format
    status
    episodes
    duration
    source
    startDate { year month day }
    endDate { year month day }
    season
    seasonYear
    averageScore
    meanScore
    popularity
    favourites
    genres
    studios(isMain: true) {
      nodes { name }
    }
    coverImage {
      extraLarge
      large
      medium
    }
    bannerImage
  }
}
`;

async function fetchAniList(idMal, maxIntentos = 5) {
    for (let intento = 1; intento <= maxIntentos; intento++) {
        try {
            console.log(`📡 Intento ${intento}/${maxIntentos} - AniList API`);
            const respuesta = await axios.post(
                'https://graphql.anilist.co',
                {
                    query: ANILIST_QUERY,
                    variables: { idMal: parseInt(idMal) }
                },
                {
                    timeout: 20000,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                }
            );
            
            if (!respuesta.data.data || !respuesta.data.data.Media) {
                throw new Error('Anime no encontrado en AniList');
            }
            
            return respuesta.data.data.Media;
            
        } catch (error) {
            console.log(`⚠️ Falló el intento ${intento}: ${error.message}`);
            if (intento === maxIntentos) throw new Error(`Se agotaron los ${maxIntentos} intentos. Último error: ${error.message}`);
            await sleep(intento * 3000);
        }
    }
}

// Convertir score numérico a estrellas visuales
function convertirEstrellas(score) {
    if (!score) return '☆☆☆☆☆';
    const estrellas = Math.round(score / 20); // 100 -> 5 estrellas
    return '★'.repeat(estrellas) + '☆'.repeat(5 - estrellas);
}

// Formatear fecha
function formatearFecha(dateObj) {
    if (!dateObj || !dateObj.year) return 'N/A';
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const mes = dateObj.month ? meses[dateObj.month - 1] : '';
    const dia = dateObj.day ? dateObj.day : '';
    return `${mes} ${dia}, ${dateObj.year}`.trim().replace(/^,\s*/, '');
}

async function main() {
    try {
        console.log(`🔍 Buscando anime con ID MAL: ${ANIME_ID}...`);

        const anime = await fetchAniList(ANIME_ID);
        console.log(`✅ Anime encontrado: ${anime.title.romaji}`);

        await sleep(2000);

        // Preparar datos
        const titulo = anime.title.romaji || anime.title.english || anime.title.native || 'Sin título';
        const tituloIngles = anime.title.english || '';
        const tituloNativo = anime.title.native || '';
        const sinopsis = (anime.description || 'Sin sinopsis disponible.').replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'");
        const estudio = anime.studios.nodes.map(s => s.name).join(', ') || 'N/A';
        const generos = anime.genres || [];
        const score10 = anime.averageScore ? (anime.averageScore / 10).toFixed(2) : 'N/A';
        const score5 = anime.averageScore ? (anime.averageScore / 20).toFixed(1) : 'N/A';
        const estrellas = convertirEstrellas(anime.averageScore);
        const fechaInicio = formatearFecha(anime.startDate);
        const fechaFin = formatearFecha(anime.endDate);
        const emision = fechaFin === 'N/A' ? `Desde ${fechaInicio}` : `${fechaInicio} - ${fechaFin}`;
        
        const nombreArchivo = titulo
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        // ============================================
        // VERSIÓN BLOGGER
        // ============================================
        const contenidoBlogger = `
<div style="font-family: inherit; color: inherit; line-height: 1.7;">

    <div style="display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 25px; align-items: flex-start;">
        
        <div style="flex-shrink: 0; max-width: 200px;">
            <img src="${anime.coverImage.extraLarge || anime.coverImage.large}" alt="${titulo}" style="width: 100%; display: block; border-radius: 4px;">
        </div>
        
        <div style="flex: 1; min-width: 250px;">
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.95em; line-height: 1.9;">
                <li><strong>Rating:</strong> ${score5}/5 <span style="color: #f5a623;">${estrellas}</span> <span style="opacity: 0.7;">(${(anime.popularity || 0).toLocaleString('es-ES')} usuarios)</span></li>
                <li><strong>Score MAL:</strong> ${score10}/10 ⭐</li>
                <li><strong>Estudio:</strong> ${estudio}</li>
                <li><strong>Formato:</strong> ${anime.format || 'N/A'}</li>
                <li><strong>Episodios:</strong> ${anime.episodes || '?'}</li>
                <li><strong>Duración:</strong> ${anime.duration ? anime.duration + ' min por ep' : 'N/A'}</li>
                <li><strong>Emisión:</strong> ${emision}</li>
                <li><strong>Estado:</strong> ${anime.status || 'N/A'}</li>
                <li><strong>Temporada:</strong> ${anime.season ? anime.season + ' ' + anime.seasonYear : 'N/A'}</li>
                <li><strong>Fuente:</strong> ${anime.source || 'N/A'}</li>
                <li><strong>Géneros:</strong> ${generos.join(', ') || 'N/A'}</li>
            </ul>
        </div>
    </div>

    <div style="border-left: 4px solid #cccccc; padding: 8px 0 8px 20px; margin: 25px 0; font-style: italic; opacity: 0.9;">
        <p style="margin: 0; text-align: justify;">${sinopsis}</p>
    </div>

    <hr style="margin: 30px 0; border: none; border-top: 1px solid rgba(128,128,128,0.3);">
    <p style="font-size: 0.8em; opacity: 0.7; text-align: center;">
        Datos obtenidos de <a href="https://anilist.co/anime/${anime.id}" target="_blank" rel="noopener" style="color: inherit; text-decoration: underline;">AniList</a>.
    </p>

</div>
        `.trim();

        // ============================================
        // VERSIÓN WEB
        // ============================================
        const paginaHTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${titulo} - Ficha Anime</title>
    <link rel="stylesheet" href="../style.css">
</head>
<body>
    <header>
        <a href="index.html" class="back">← Volver al catálogo</a>
    </header>
    <main class="ficha">
        <h1>${titulo}</h1>
        ${tituloIngles && tituloIngles !== titulo ? `<h2 class="subtitle">${tituloIngles}</h2>` : ''}
        
        <div class="info-grid">
            <div class="poster">
                <img src="${anime.coverImage.extraLarge || anime.coverImage.large}" alt="${titulo}">
            </div>
            <div class="datos">
                <ul>
                    <li><strong>Rating:</strong> ${score5}/5 <span style="color: #f5a623;">${estrellas}</span></li>
                    <li><strong>Score:</strong> ${score10}/10 ⭐</li>
                    <li><strong>Estudio:</strong> ${estudio}</li>
                    <li><strong>Formato:</strong> ${anime.format || 'N/A'}</li>
                    <li><strong>Episodios:</strong> ${anime.episodes || '?'}</li>
                    <li><strong>Duración:</strong> ${anime.duration ? anime.duration + ' min' : 'N/A'}</li>
                    <li><strong>Emisión:</strong> ${emision}</li>
                    <li><strong>Estado:</strong> ${anime.status || 'N/A'}</li>
                    <li><strong>Temporada:</strong> ${anime.season ? anime.season + ' ' + anime.seasonYear : 'N/A'}</li>
                    <li><strong>Fuente:</strong> ${anime.source || 'N/A'}</li>
                </ul>
            </div>
        </div>

        <blockquote class="sinopsis">${sinopsis}</blockquote>

        <section>
            <h3>🏷️ Géneros</h3>
            <p>${generos.map(g => `<span class="genero">${g}</span>`).join(' ') || 'N/A'}</p>
        </section>
    </main>
    <footer>
        <p>Datos obtenidos de <a href="https://anilist.co/anime/${anime.id}" target="_blank">AniList</a>.</p>
    </footer>
</body>
</html>`;

        // Guardar archivos
        const carpetaFichas = path.join(__dirname, 'fichas');
        if (!fs.existsSync(carpetaFichas)) fs.mkdirSync(carpetaFichas, { recursive: true });

        fs.writeFileSync(path.join(carpetaFichas, `${nombreArchivo}.html`), paginaHTML, 'utf8');
        fs.writeFileSync(path.join(carpetaFichas, `${nombreArchivo}-blogger.txt`), contenidoBlogger, 'utf8');

        // Actualizar metadatos
        const metaArchivo = path.join(carpetaFichas, 'metadatos.json');
        let metadatos = [];
        if (fs.existsSync(metaArchivo)) {
            metadatos = JSON.parse(fs.readFileSync(metaArchivo, 'utf8'));
        }
        metadatos = metadatos.filter(m => m.id !== ANIME_ID);
        metadatos.push({
            id: ANIME_ID,
            titulo: titulo,
            imagen: anime.coverImage.large || anime.coverImage.medium,
            score: score10,
            tipo: anime.format,
            episodios: anime.episodes,
            año: anime.seasonYear || 'N/A',
            archivo: `${nombreArchivo}.html`
        });
        fs.writeFileSync(metaArchivo, JSON.stringify(metadatos, null, 2), 'utf8');

        console.log(`✅ Fichas guardadas:`);
        console.log(`   - fichas/${nombreArchivo}.html`);
        console.log(`   - fichas/${nombreArchivo}-blogger.txt`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
