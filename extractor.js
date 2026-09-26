const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ==========================================
// CONFIGURACIÓN: Aquí pones el ID del anime
// que quieres extraer de MyAnimeList
// ==========================================
// Ejemplo: 28171 (Shokugeki no Souma), 5114 (Fullmetal Alchemist), 21 (One Piece)
const ANIME_ID = 28171; 

// Función para esperar entre peticiones (evita bloqueos de la API)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    try {
        console.log(`🔍 Buscando anime con ID: ${ANIME_ID}...`);

        // 1. Obtener datos generales del anime
        const respuestaAnime = await axios.get(`https://api.jikan.moe/v4/anime/${ANIME_ID}`);
        const anime = respuestaAnime.data.data;

        // 2. Esperar un poco antes de la siguiente petición
        await sleep(1500);

        // 3. Obtener lista de episodios
        const respuestaEpisodios = await axios.get(`https://api.jikan.moe/v4/anime/${ANIME_ID}/episodes`);
        const episodios = respuestaEpisodios.data.data || [];

        console.log(`✅ Datos obtenidos: ${anime.title}`);

        // 4. Generar la lista de episodios en HTML
        const listaEpisodiosHTML = episodios.length > 0 
            ? episodios.map(ep => `
                <li>
                    <strong>${ep.mal_id.toString().padStart(2, '0')}.</strong> 
                    ${ep.title || 'Episodio ' + ep.mal_id}
                    ${ep.aired ? `<em>(${new Date(ep.aired).toLocaleDateString('es-ES')})</em>` : ''}
                </li>
            `).join('')
            : '<li>Lista de episodios no disponible.</li>';

        // 5. Crear el HTML de la ficha (con estilos inline para copiar y pegar fácil)
        const fichaHTML = `
<!-- ============================================ -->
<!-- FICHA DE: ${anime.title} -->
<!-- Generada automáticamente desde Jikan API -->
<!-- ============================================ -->

<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 8px; border: 1px solid #ddd;">

    <h1 style="color: #2c3e50; border-bottom: 3px solid #e74c3c; padding-bottom: 10px;">
        ${anime.title}
    </h1>
    
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
                <li><strong>🎥 Director:</strong> ${anime.directors ? anime.directors.map(d => d.name).join(', ') : 'N/A'}</li>
                <li><strong>📖 Fuente:</strong> ${anime.source || 'N/A'}</li>
                <li><strong>⭐ Puntuación:</strong> ${anime.score || 'N/A'}/10 (${(anime.scored_by || 0).toLocaleString('es-ES')} votos)</li>
                <li><strong>🏆 Ranking:</strong> #${anime.rank || 'N/A'}</li>
            </ul>
        </div>
    </div>

    <h3 style="color: #2c3e50;">📝 Sinopsis</h3>
    <p style="line-height: 1.6; text-align: justify;">${anime.synopsis || 'Sin sinopsis disponible.'}</p>

    <h3 style="color: #2c3e50;">🏷️ Géneros</h3>
    <p>${anime.genres.map(g => `<span style="background: #3498db; color: white; padding: 3px 10px; border-radius: 15px; margin-right: 5px; font-size: 0.85em;">${g.name}</span>`).join(' ') || 'N/A'}</p>

    <h3 style="color: #2c3e50;">📋 Lista de Episodios</h3>
    <ol style="line-height: 1.8;">
        ${listaEpisodiosHTML}
    </ol>

    <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
    <p style="font-size: 0.8em; color: #95a5a6; text-align: center;">
        Datos obtenidos de <a href="https://myanimelist.net/anime/${ANIME_ID}" target="_blank">MyAnimeList</a> vía Jikan API.
    </p>

</div>
        `.trim();

        // 6. Guardar el archivo en la carpeta 'fichas/'
        const carpetaFichas = path.join(__dirname, 'fichas');
        
        // Crear la carpeta si no existe
        if (!fs.existsSync(carpetaFichas)) {
            fs.mkdirSync(carpetaFichas, { recursive: true });
        }

        // Crear un nombre de archivo seguro (sin caracteres raros)
        const nombreArchivo = anime.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        
        const rutaArchivo = path.join(carpetaFichas, `${nombreArchivo}.html`);
        
        // Escribir el archivo
        fs.writeFileSync(rutaArchivo, fichaHTML, 'utf8');

        console.log(`✅ ¡Ficha guardada en: fichas/${nombreArchivo}.html`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
