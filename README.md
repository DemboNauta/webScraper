# WebScraper — Extracción de contactos de negocios

Scraper polivalente para extraer teléfonos, emails, direcciones y redes sociales de webs de negocios (restaurantes, tiendas, servicios, etc.).

## Instalación

```bash
npm install
# Instalar Chrome para Puppeteer (modo browser):
npm run install-browser
```

## Modos de uso

### 1. Scrape directo de URLs

```bash
node src/index.js urls https://restaurante-ejemplo.com https://otro-restaurante.es
```

### 2. Búsqueda automática + scrape

```bash
# Busca restaurantes italianos en Madrid y extrae contactos
node src/index.js search "restaurante italiano" "Madrid" --limit 15

# Con motor de búsqueda Google:
node src/index.js search "bar de tapas" "Sevilla" --engine google
```

### 3. Scrape desde fichero de URLs

```bash
# urls.txt: una URL por línea
node src/index.js file urls.txt --format csv
```

## Opciones comunes

| Flag | Descripción | Por defecto |
|---|---|---|
| `-b, --browser` | Usar navegador headless (páginas con JS) | false |
| `-f, --format` | Formato salida: `csv`, `json`, `both` | both |
| `-o, --output` | Directorio de resultados | `./results` |
| `-c, --concurrency` | Peticiones en paralelo | 3 |
| `-l, --limit` | Máx. resultados al buscar | 10 |
| `-n, --name` | Nombre base del fichero exportado | scrape |

## Ejemplos prácticos

```bash
# Restaurantes sin reserva online en Barcelona — modo rápido (estático)
node src/index.js search "restaurante sin reservas" "Barcelona" -l 20

# Misma búsqueda con JS habilitado (webs modernas)
node src/index.js search "restaurante" "Valencia" --browser -l 10

# Lista manual de URLs
node src/index.js urls \
  https://casapaco.es \
  https://bodegaelrincon.com \
  --format csv --name restaurantes_madrid
```

## Datos extraídos

- **Teléfono(s)**
- **Email(s)**
- **Dirección**
- **Redes sociales** (Instagram, Facebook, TripAdvisor, TikTok…)
- **Descripción** (meta description)
- **Web**

Los resultados se guardan en `results/` como `.csv` y `.json`.

## Estructura del proyecto

```
src/
├── index.js          CLI principal
├── scraper.js        Orquestador
├── extractors/
│   └── contacts.js   Extracción de teléfonos, emails, direcciones, redes
├── sources/
│   ├── direct.js     Scraping estático (axios + cheerio)
│   ├── browser.js    Scraping dinámico (puppeteer)
│   └── search.js     Búsqueda en Google / DuckDuckGo
└── exporters/
    ├── csv.js
    └── json.js
config/
└── default.js        Configuración global (timeouts, patrones, delays)
```
