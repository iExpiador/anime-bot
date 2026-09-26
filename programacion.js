const axios = require('axios');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// GÉNEROS A EXCLUIR DEL JSON
// Solo Hentai. Ecchi se mantiene.
// ==========================================
const GENEROS_EXCLUIDOS = ["Hentai"];

// Consulta GraphQL de AniList
const ANILIST_QUERY = `
query ($page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage currentPage }
    media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC) {
      id
      idMal
      title { romaji english native }
      episodes
      duration
      status
      format
      averageScore
      popularity
      genres
      coverImage { large extraLarge }
      studios(isMain: true) { nodes { name } }
      nextAiringEpisode {
        episode
        airingAt
        timeUntilAiring
      }
    }
  }
}
`;

async function fetchPage(page, maxIntentos = 3) {
    for (let intento = 1; intento <= maxIntentos; intento++) {
        try {
            console.log(`📡 Página ${page} - Intento ${intento}/${maxIntentos}`);
            const respuesta = await axios.post(
                'https://graphql.anilist.co',
                { query: ANILIST_QUERY, variables: { page } },
                { timeout: 25000, headers: { 'Content-Type': 'application/json' } }
            );
            return respuesta.data.data.Page;
        } catch (error) {
            console.log(`⚠️ Falló: ${error.message}`);
            if (intento === maxIntentos) throw error;
            await sleep(intento * 3000);
        }
    }
}

// Convertir timestamp UTC a día y hora de Japón (JST)
function getJapanDayAndTime(airingAt) {
    const fecha = new Date(airingAt * 1000);
    
    // Día de la semana en Japón
    const diaJapones = fecha.toLocaleString('en-US', {
        timeZone: 'Asia/Tokyo',
        weekday: 'long'
    }).toLowerCase();
    
    // Hora en Japón
    const horaJaponesa = fecha.toLocaleString('en-US', {
        timeZone: 'Asia/Tokyo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    
    return {
        dia: diaJapones,
        hora: horaJaponesa
    };
}

async function main() {
    try {
        console.log('🔍 Obteniendo animes en emisión desde AniList...');

        let todasLasPaginas = [];
        let pagina = 1;
        let hayMas = true;

        while (hayMas && pagina <= 6) {
            const resultado = await fetchPage(pagina);
            todasLasPaginas = todasLasPaginas.concat(resultado.media);
            hayMas = resultado.pageInfo.hasNextPage;
            pagina++;
            await sleep(1000);
        }

        console.log(`✅ ${todasLasPaginas.length} animes obtenidos`);

        // Agrupar por día
        const programacion = {
            actualizado: new Date().toISOString(),
            total: 0,
            dias: {
                monday: [],
                tuesday: [],
                wednesday: [],
                thursday: [],
                friday: [],
                saturday: [],
                sunday: []
            }
        };

        let contador = 0;
        let excluidos = 0;

        todasLasPaginas.forEach(anime => {
            const next = anime.nextAiringEpisode;
            if (!next || !next.airingAt) return;

            // ==========================================
            // FILTRAR GÉNEROS EXCLUIDOS (solo Hentai)
            // ==========================================
            if (anime.genres && anime.genres.some(g => GENEROS_EXCLUIDOS.includes(g))) {
                console.log(`🚫 Excluido: ${anime.title.romaji} (${anime.genres.join(', ')})`);
                excluidos++;
                return;
            }

            const { dia, hora } = getJapanDayAndTime(next.airingAt);
            
            if (!programacion.dias[dia]) {
                console.log(`⚠️ Día desconocido: ${dia}`);
                return;
            }

            programacion.dias[dia].push({
                mal_id: anime.idMal,
                anilist_id: anime.id,
                titulo: anime.title.romaji || anime.title.english || anime.title.native,
                titulo_ingles: anime.title.english,
                imagen: anime.coverImage.large || anime.coverImage.extraLarge,
                episodio_actual: next.episode,
                total_episodios: anime.episodes,
                hora_jst: hora,
                airing_at: next.airingAt,
                score: anime.averageScore ? (anime.averageScore / 10).toFixed(2) : null,
                formato: anime.format,
                generos: anime.genres,
                estudio: anime.studios.nodes.map(s => s.name).join(', ')
            });

            contador++;
        });

        programacion.total = contador;

        // Ordenar cada día por hora
        Object.keys(programacion.dias).forEach(dia => {
            programacion.dias[dia].sort((a, b) =>
                a.hora_jst.localeCompare(b.hora_jst)
            );
        });

        // Guardar
        const carpetaFichas = path.join(__dirname, 'fichas');
        if (!fs.existsSync(carpetaFichas)) fs.mkdirSync(carpetaFichas, { recursive: true });

        const rutaArchivo = path.join(carpetaFichas, 'programacion.json');
        fs.writeFileSync(rutaArchivo, JSON.stringify(programacion, null, 2), 'utf8');

        console.log(`✅ Guardado en fichas/programacion.json`);
        console.log(`📊 Total: ${contador} animes agrupados`);
        console.log(`🚫 Excluidos: ${excluidos} animes (Hentai)`);
        console.log(`📊 Resumen por día:`);
        Object.entries(programacion.dias).forEach(([dia, lista]) => {
            console.log(`   ${dia}: ${lista.length} animes`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
