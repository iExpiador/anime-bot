const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ID del anime (viene desde el workflow o usa 28171 por defecto)
const ANIME_ID = process.env.ANIME_ID || 28171;

// Función para esperar
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// FUNCIÓN CON REINTENTOS AUTOMÁTICOS
// Si falla, espera y vuelve a intentar (hasta 5 veces)
// ==========================================
async function fetchConReintentos(url, maxIntentos = 5) {
    for (let intento = 1; intento <= maxIntentos; intento++) {
        try {
            console.log(`📡 Intento ${intento}/${maxIntentos}: ${url}`);
            const respuesta = await axios.get(url, { timeout: 15000 });
            return respuesta;
        } catch (error) {
            console.log(`⚠️ Falló el intento ${intento}: ${error.message}`);
            
            if (intento === maxIntentos) {
                throw new Error(`Se agotaron los ${maxIntentos} intentos. Último error: ${error.message}`);
            }
            
            // Esperar antes de reintentar (2s, 4s, 6s, 8s...)
            const espera = intento * 2000;
            console.log(`⏳ Esperando ${espera/1000} segundos antes de reintentar...`);
            await sleep(espera);
        }
    }
}

async function main() {
    try {
        console.log(`🔍 Buscando anime con ID: ${ANIME_ID}...`);

        // 1. Obtener datos generales del anime (con reintentos)
        const respuestaAnime = await fetchConReintentos(`https://api.jikan.moe/v4/anime/${ANIME_ID}`);
        const anime = respuestaAnime.data.data;

        console.log(`✅ Anime encontrado: ${anime.title}`);

        // 2. Esperar antes de la siguiente petición (respetar rate limit)
        await sleep(3000);

        // 3. Obtener episodios (con reintentos)
        let episodios = [];
        try {
            const respuestaEpisodios = await fetchConReintentos(`https://api.jikan.moe/v4/anime/${ANIME_ID}/episodes`);
            episodios = respuestaEpisodios.data.data || [];
        } catch (err) {
            console.log(`⚠️ No se pudieron obtener los episodios: ${err.message}`);
        }

        // 4. Generar lista de episodios en HTML
        const listaEpisodiosHTML = episodios.length > 0 
            ? episodios.map(ep => `
                <li>
                    <strong>${ep.mal_id.toString().padStart(2, '0')}.</strong> 
                    ${ep.title || 'Episodio ' + ep.mal_id}
                </li>
            `).join('')
            : '<li>Lista de episodios no disponible por el momento.</li>';

        // 5. Crear la ficha HTML
        const fichaHTML = `
<!-- FICHA DE: ${anime.title} -->
<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 8px; border: 1px solid #ddd;">
    <h1 style="color: #2c3e50; border-bottom: 3px solid #e74c3c; padding-bottom: 10px;">${anime.title}</h1>
    ${anime.title_english ? `<h2 style="color: #7f8c8d; font-size: 1.1em; margin-top: -10px;">${anime.title_english}</h2>` : ''}
    
    <div style="display: flex; gap: 20px; flex-wrap: wrap; margin: 20px 0;">
        <div style="flex: 1; min-width: 200px;">
            <img src="${anime.images.jpg.image_url}" alt="${anime.title}" style="width: 100%; max-width: 225px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
        </div>
        <div style="flex: 2; min-width: 300px;">
            <ul style="list-style: none; padding: 0; font-size: 0.95em; line-height: 1.8;">
                <li><strong>📺 Tipo:</strong> ${anime.type || 'N/A'}</li>
                <li><strong>🎬 Episodios:</strong> ${anime.episodes || '?'}</li>
                <li><strong>⏱️ Duración:</strong> ${anime.duration || 'N/A'}</li>
                <li><strong>📅 Emisión:</strong> ${anime.aired.string || 'N/A'}</li>
                <li><strong>🏢 Estudio:</strong> ${anime.studios.map(s => s.name).join(', ') || 'N/A'}</li>
                <li><strong>📖 Fuente:</strong> ${anime.source || 'N/A'}</li>
                <li><strong>⭐ Puntuación:</strong> ${anime.score || 'N/A'}/10 (${(anime.scored_by || 0).toLocaleString('es-ES')} votos)</li>
            </ul>
        </div>
    </div>

    <h3 style="color: #2c3e50;">📝 Sinopsis</h3>
    <p style="line-height: 1.6; text-align: justify;">${anime.synopsis || 'Sin sinopsis disponible.'}</p>

    <h3 style="color: #2c3e50;">🏷️ Géneros</h3>
    <p>${anime.genres.map(g => `<span style="background: #3498db; color: white; padding: 3px 10px; border-radius: 15px; margin-right: 5px; font-size: 0.85em;">${g.name}</span>`).join(' ') || 'N/A'}</p>

    <h3 style="color: #2c3e50;">📋 Lista de Episodios</h3>
    <ol style="line-height: 1.8;">${listaEpisodiosHTML}</ol>

    <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
    <p style="font-size: 0.8em; color: #95a5a6; text-align: center;">
        Datos obtenidos de <a href="https://myanimelist.net/anime/${ANIME_ID}" target="_blank">MyAnimeList</a> vía Jikan API.
    </p>
</div>
        `.trim();

        // 6. Guardar el archivo
        const carpetaFichas = path.join(__dirname, 'fichas');
        if (!fs.existsSync(carpetaFichas)) {
            fs.mkdirSync(carpetaFichas, { recursive: true });
        }

        const nombreArchivo = anime.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        
        const rutaArchivo = path.join(carpetaFichas, `${nombreArchivo}.html`);
        fs.writeFileSync(rutaArchivo, fichaHTML, 'utf8');

        console.log(`✅ ¡Ficha guardada en: fichas/${nombreArchivo}.html`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
