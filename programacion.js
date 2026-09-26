const axios = require('axios');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Consulta GraphQL de AniList: animes en emisión con día y hora
const ANILIST_QUERY = `
query ($page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage currentPage }
    media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC) {
      id
      idMal
      title { romaji english native }
      description
      episodes
      duration
      status
      format
      averageScore
      popularity
      genres
      coverImage { large extraLarge }
      studios(isMain: true) { nodes { name } }
      airingSchedule(notYetAired: false, perPage: 1) {
        nodes {
          episode
          airingAt
          timeUntilAiring
        }
      }
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

// Convertir timestamp UTC a hora de Japón (JST)
function getJapanTime(airingAt) {
    const fecha = new Date(airingAt * 1000);
    const jstString = fecha.toLocaleString('en-US', {
        timeZone: 'Asia/Tokyo',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    // Ejemplo: "Monday, 19:30"
    const partes = jstString.split(', ');
    return {
        dia: partes[0].toLowerCase(),
        hora: partes[1]
    };
}

async function main() {
    try {
        console.log('🔍 Obteniendo animes en emisión desde AniList...');

        let todasLasPaginas = [];
        let pagina = 1;
        let hayMas = true;

        while (hayMas && pagina <= 6) { // Máximo 6 páginas = 300 animes
            const resultado = await fetchPage(pagina);
            todasLasPaginas = todasLasPaginas.concat(resultado.media);
            hayMas = resultado.pageInfo.hasNextPage;
            pagina++;
            await sleep(1000); // Respetar rate limit
        }

        console.log(`✅ ${todasLasPaginas.length} animes obtenidos`);

        // Agrupar por día
        const programacion = {
            actualizado: new Date().toISOString(),
            total: todasLasPaginas.length,
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

        todasLasPaginas.forEach(anime => {
            const next = anime.nextAiringEpisode;
            if (!next || !next.airingAt) return;

            const { dia, hora } = getJapanTime(next.airingAt);
            if (!programacion.dias[dia]) return;

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
        });

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
