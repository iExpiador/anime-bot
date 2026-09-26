const axios = require('axios');
const fs = require('fs');
const path = require('path');

const ANIME_ID = process.env.ANIME_ID || 28171;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchConReintentos(url, maxIntentos = 5) {
    for (let intento = 1; intento <= maxIntentos; intento++) {
        try {
            console.log(`📡 Intento ${intento}/${maxIntentos}: ${url}`);
            const respuesta = await axios.get(url, { timeout: 15000 });
            return respuesta;
        } catch (error) {
            console.log(`⚠️ Falló el intento ${intento}: ${error.message}`);
            if (intento === maxIntentos) throw new Error(`Se agotaron los ${maxIntentos} intentos. Último error: ${error.message}`);
            await sleep(intento * 2000);
        }
    }
}

// Convertir score numérico a estrellas visuales
function convertirEstrellas(score) {
    if (!score) return '☆☆☆☆☆';
    const estrellas = Math.round(score / 2); // 10 -> 5 estrellas
    return '★'.repeat(estrellas) + '☆'.repeat(5 - estrellas);
}

async function main() {
    try {
        console.log(`🔍 Buscando anime con ID: ${ANIME_ID}...`);

        const respuestaAnime = await fetchConReintentos(`https://api.jikan.moe/v4/anime/${ANIME_ID}`);
        const anime = respuestaAnime.data.data;
        console.log(`✅ Anime encontrado: ${anime.title}`);

        await sleep(3000);

        let episodios = [];
        try {
            const respuestaEpisodios = await fetchConReintentos(`https://api.jikan.moe/v4/anime/${ANIME_ID}/episodes`);
            episodios = respuestaEpisodios.data.data || [];
        } catch (err) {
            console.log(`⚠️ No se pudieron obtener los episodios: ${err.message}`);
        }

        const listaEpisodiosHTML = episodios.length > 0 
            ? episodios.map(ep => `<li><strong>${ep.mal_id.toString().padStart(2, '0')}.</strong> «${ep.title || 'Episodio ' + ep.mal_id}»</li>`).join('')
            : '<li>Lista de episodios no disponible.</li>';

        const nombreArchivo = anime.title
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        // Score a escala 5
        const scoreSobre5 = anime.score ? (anime.score / 2).toFixed(1) : 'N/A';
        const estrellas = convertirEstrellas(anime.score);

        // ============================================
        // VERSIÓN BLOGGER: Contenido limpio sin fondos
        // Estilo inspirado en OtakuDesho.net
        // ============================================
        const contenidoBlogger = `
<div style="font-family: inherit; color: inherit; line-height: 1.7;">

    <!-- BLOQUE PRINCIPAL: IMAGEN + DATOS -->
    <div style="display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 25px; align-items: flex-start;">
        
        <!-- COLUMNA IZQUIERDA: IMAGEN -->
        <div style="flex-shrink: 0; max-width: 200px;">
            <img src="${anime.images.jpg.image_url}" alt="${anime.title}" style="width: 100%; display: block; border-radius: 4px;">
        </div>
        
        <!-- COLUMNA DERECHA: DATOS -->
        <div style="flex: 1; min-width: 250px;">
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.95em; line-height: 1.9;">
                <li><strong>Rating:</strong> ${scoreSobre5}/5 <span style="color: #f5a623;">${estrellas}</span> <span style="opacity: 0.7;">(${(anime.scored_by || 0).toLocaleString('es-ES')} votos)</span></li>
                <li><strong>Score MAL:</strong> ${anime.score || 'N/A'}/10 ⭐ (${(anime.scored_by || 0).toLocaleString('es-ES')} votos)</li>
                <li><strong>Estudio:</strong> ${anime.studios.map(s => s.name).join(', ') || 'N/A'}</li>
                <li><strong>Director:</strong> ${anime.directors && anime.directors.length ? anime.directors.map(d => d.name).join(', ') : 'N/A'}</li>
                <li><strong>Música:</strong> ${anime.music && anime.music.length ? anime.music.map(m => m.name).join(', ') : 'N/A'}</li>
                <li><strong>Tipo:</strong> ${anime.type || 'N/A'}</li>
                <li><strong>Episodios:</strong> ${anime.episodes || '?'}</li>
                <li><strong>Duración:</strong> ${anime.duration || 'N/A'}</li>
                <li><strong>Emisión:</strong> ${anime.aired.string || 'N/A'}</li>
                <li><strong>Estado:</strong> ${anime.status || 'N/A'}</li>
                <li><strong>Fuente:</strong> ${anime.source || 'N/A'}</li>
                <li><strong>Géneros:</strong> ${anime.genres.map(g => g.name).join(', ') || 'N/A'}</li>
            </ul>
        </div>
    </div>

    <!-- SINOPSIS CON BLOCKQUOTE -->
    <div style="border-left: 4px solid #cccccc; padding: 8px 0 8px 20px; margin: 25px 0; font-style: italic; opacity: 0.9;">
        <p style="margin: 0; text-align: justify;">${anime.synopsis || 'Sin sinopsis disponible.'}</p>
    </div>

    <hr style="margin: 30px 0; border: none; border-top: 1px solid rgba(128,128,128,0.3);">
    <p style="font-size: 0.8em; opacity: 0.7; text-align: center;">
        Datos obtenidos de <a href="https://myanimelist.net/anime/${ANIME_ID}" target="_blank" rel="noopener" style="color: inherit; text-decoration: underline;">MyAnimeList</a> vía Jikan API.
    </p>

</div>
        `.trim();

        // ============================================
        // VERSIÓN WEB: Página completa para GitHub Pages
        // ============================================
        const paginaHTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${anime.title} - Ficha Anime</title>
    <link rel="stylesheet" href="../style.css">
</head>
<body>
    <header>
        <a href="index.html" class="back">← Volver al catálogo</a>
    </header>
    <main class="ficha">
        <h1>${anime.title}</h1>
        ${anime.title_english && anime.title_english !== anime.title ? `<h2 class="subtitle">${anime.title_english}</h2>` : ''}
        
        <div class="info-grid">
            <div class="poster">
                <img src="${anime.images.jpg.image_url}" alt="${anime.title}">
            </div>
            <div class="datos">
                <ul>
                    <li><strong>Rating:</strong> ${scoreSobre5}/5 <span style="color: #f5a623;">${estrellas}</span></li>
                    <li><strong>Score MAL:</strong> ${anime.score || 'N/A'}/10 ⭐</li>
                    <li><strong>Estudio:</strong> ${anime.studios.map(s => s.name).join(', ') || 'N/A'}</li>
                    <li><strong>Director:</strong> ${anime.directors && anime.directors.length ? anime.directors.map(d => d.name).join(', ') : 'N/A'}</li>
                    <li><strong>Música:</strong> ${anime.music && anime.music.length ? anime.music.map(m => m.name).join(', ') : 'N/A'}</li>
                    <li><strong>Tipo:</strong> ${anime.type || 'N/A'}</li>
                    <li><strong>Episodios:</strong> ${anime.episodes || '?'}</li>
                    <li><strong>Duración:</strong> ${anime.duration || 'N/A'}</li>
                    <li><strong>Emisión:</strong> ${anime.aired.string || 'N/A'}</li>
                    <li><strong>Estado:</strong> ${anime.status || 'N/A'}</li>
                    <li><strong>Fuente:</strong> ${anime.source || 'N/A'}</li>
                </ul>
            </div>
        </div>

        <blockquote class="sinopsis">${anime.synopsis || 'Sin sinopsis disponible.'}</blockquote>

        <section>
            <h3>🏷️ Géneros</h3>
            <p>${anime.genres.map(g => `<span class="genero">${g.name}</span>`).join(' ') || 'N/A'}</p>
        </section>

        <section>
            <h3>📋 Lista de Episodios</h3>
            <ol class="episodios">${listaEpisodiosHTML}</ol>
        </section>
    </main>
    <footer>
        <p>Datos obtenidos de <a href="https://myanimelist.net/anime/${ANIME_ID}" target="_blank">MyAnimeList</a> vía Jikan API.</p>
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
            titulo: anime.title,
            imagen: anime.images.jpg.image_url,
            score: anime.score,
            tipo: anime.type,
            episodios: anime.episodes,
            año: anime.year || anime.aired.prop.from?.year || 'N/A',
            archivo: `${nombreArchivo}.html`
        });
        fs.writeFileSync(metaArchivo, JSON.stringify(metadatos, null, 2), 'utf8');

        console.log(`✅ Fichas guardadas:`);
        console.log(`   - fichas/${nombreArchivo}.html (web)`);
        console.log(`   - fichas/${nombreArchivo}-blogger.txt (para Blogger)`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
