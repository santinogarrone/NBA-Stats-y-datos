# NBA Stats

Estadísticas de la NBA con datos reales de **ESPN** (API no oficial) y **BALLDONTLIE**. Next.js 16 (App Router) + TypeScript + Tailwind 4. Todas las páginas se renderizan en el servidor; las claves nunca llegan al navegador.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local     # añade BALLDONTLIE_API_KEY si tienes
npm run dev                    # http://localhost:3000
npm test                       # tests de la lógica y de los adaptadores
npm run build
```

Funciona **sin clave**: usa ESPN para todo. La clave de BALLDONTLIE solo añade una vía más rápida (consultas agrupadas) y un respaldo.

## Páginas

| Ruta | Contenido |
|---|---|
| `/` | Partidos del día (en vivo, por jugar, resultados), próximos, MVP día/semana/mes, mejores de la temporada, clasificación |
| `/equipos`, `/equipos/[abbr]` | 30 equipos por conferencia y división; detalle con récord, estadísticas colectivas, plantilla y promedios, resultados y calendario |
| `/jugadores`, `/jugadores/[id]` | Listado con promedios; perfil con promedios, totales, evolución, mejor actuación, posición en rankings, comparación e historial ordenable |
| `/rankings` | 11 categorías con temporada, periodo, tipo, tamaño, mínimo de partidos, equipo y conferencia |
| `/mvp` | MVP diario, semanal (lun–dom) y mensual (mes calendario) con desglose, desempates y evolución |
| `/clasificacion` | Este y Oeste |

## De dónde sale cada dato

| Dato | Fuente principal | Respaldo | Endpoint |
|---|---|---|---|
| Partidos de un día | ESPN | BALLDONTLIE (gratis) | `scoreboard?dates=YYYYMMDD` · `/v1/games` |
| Box score por partido | ESPN | — | `summary?event=ID` |
| Estadísticas de jugadores por rango | **BALLDONTLIE** si el plan lo permite | ESPN | `/v1/stats` (ALL-STAR+) |
| Clasificación | ESPN | BALLDONTLIE (GOAT) | `apis/v2/.../standings` · `/v1/standings` |
| Plantilla (edad, altura, foto) | ESPN | BALLDONTLIE (sin fotos) | `teams/{id}/roster` · `/v1/players` |
| Logotipos | ESPN | iniciales del equipo | `teams` |
| Calendario de equipo | ESPN | — | `teams/{id}/schedule` |
| Conferencia y división | Tabla estática (`src/config/nba-structure.ts`) | — | — |

**Depende del plan de BALLDONTLIE:** `/v1/stats` (ALL-STAR o superior) y `/v1/standings` (GOAT). La aplicación comprueba una vez el acceso (caché de 6 h) y, si no hay permiso, usa ESPN sin mostrar error. No se usa `season_averages`: todos los promedios se calculan a partir de datos por partido.

**Límites de ESPN:** API no oficial, puede cambiar sin aviso. No hay endpoint de estadísticas por rango, así que cada partido finalizado requiere una solicitud de box score. No tiene consulta por rango de fechas (se pide un día por solicitud). No hay fotos para jugadores de BALLDONTLIE. Los ids de ESPN y BALLDONTLIE no coinciden: una misma consulta usa **una sola fuente** y los jugadores se identifican como `espn:123` o `bdl:456`.

## Carga incremental (importante con ESPN)

Una temporada completa son ~1.230 box scores. Cada carga de página hace como máximo `NBA_FETCH_BUDGET` solicitudes nuevas (80 por defecto); lo ya descargado se guarda **en disco sin caducidad** (los partidos finalizados no cambian) y no se vuelve a pedir. Las primeras visitas muestran «Cobertura parcial» y la cifra «Box scores: X de Y»; recargar o pulsar «Actualizar datos» avanza hasta completar. Con ALL-STAR o superior la carga es agrupada y mucho más rápida.

### Precarga de la caché

Con `SYNC_TOKEN` definido, `/api/sync` descarga box scores sin esperar visitas (hasta `n` solicitudes por llamada, máximo 1000):

```bash
curl -H "Authorization: Bearer $SYNC_TOKEN" "https://tu-dominio/api/sync?desde=2026-10-01&n=300"
```

Repítela (por ejemplo con un cron) hasta que la respuesta traiga `"complete": true`. Sin `SYNC_TOKEN` la ruta devuelve 404. Si despliegas en un entorno sin disco persistente (serverless), la caché en disco no sobrevive entre ejecuciones: usa un servidor con disco o apunta `NBA_CACHE_DIR` a un volumen.

## Valoración propia (no oficial)

`puntos + 1,2·rebotes + 1,5·asistencias + 3·robos + 3·bloqueos − 0,5·TC fallados − 0,5·TL fallados − pérdidas`

Se edita en `src/lib/rating.ts` (`RATING_WEIGHTS`). Si falta cualquier dato necesario o es incoherente (aciertos > intentos), la valoración queda **incompleta** y el partido se excluye de rankings y MVP; nunca se rellena con ceros. En pantalla siempre se rotula como no oficial y se muestra el desglose.

## Reglas de cálculo

- **Promedios** = total ÷ partidos con dato. **Porcentajes** de tiro = aciertos totales ÷ intentos totales.
- **Rankings**: mínimo de partidos (70 % del máximo de la muestra, o el que fijes) e intentos mínimos para porcentajes; el criterio aplicado se muestra encima de la tabla. Empates exactos comparten puesto.
- **MVP diario**: partidos finalizados de la fecha **local** (zona horaria elegida en la cabecera). Desempate: puntos → rebotes+asistencias → menos minutos → alfabético. Los empates se anuncian.
- **MVP semanal/mensual**: **suma** de valoraciones partido a partido (no promedio). Semana lunes–domingo, mes calendario. Desempate: más partidos → mayor media → más puntos → alfabético.
- **Traspasos**: cada partido se cuenta una vez; el perfil desglosa por equipo.
- **Clasificación**: se respeta el puesto de la fuente cuando es único (desempates oficiales ya aplicados). Si no, se calcula por % de victorias, victorias y diferencia de puntos, y se avisa de que no aplica todos los desempates. La «zona» de playoffs/play-in sale de la posición actual, no de una clasificación matemática.

## Estructura

```
src/config/     endpoints, ajustes, estructura de la liga
src/services/   espn.ts · espn-adapters.ts · balldontlie.ts · data.ts (orquestación, fuente principal/respaldo)
src/lib/        rating · averages · rankings · mvp · standings · dates · cache · http (lógica pura y utilidades)
src/components/ interfaz reutilizable
src/app/        rutas
tests/          lógica (vitest)
scripts/        mock-espn.mjs (servidor simulado para pruebas locales)
```

## Pendiente de verificar con datos en vivo

Esta versión se probó con un servidor ESPN simulado que replica las estructuras reales leídas de la API, no contra ESPN en directo desde el entorno de desarrollo (sin acceso de red). La ruta de BALLDONTLIE se escribió según su documentación pero **no se ejecutó con una clave real**: conviene probarla con tu plan.
