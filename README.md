# SpendWise

SpendWise turns receipt photos into validated, categorized expense data.

## Run with Docker Compose

1. Copy `.env.example` to `.env`.
2. Start the services:

   ```sh
   docker compose up --build
   ```

3. Check the service health endpoints:

   - API: <http://localhost:3000/health>
   - OCR: <http://localhost:8000/health>
   - Web: <http://localhost:5173>

For a separate image build followed by background startup:

```sh
docker compose build
docker compose up -d
docker compose ps
```

The API and OCR health checks should return HTTP 200 with `{"status":"ok"}`.

The API applies the Prisma migrations when its container starts. PostgreSQL data is
stored in the `postgres_data` volume and receipt uploads are shared by the API and
OCR services through the `uploads` volume.

## Local development

See the individual `api/`, `ocr/`, and `web/` directories for their package and
environment setup. The project source of truth is [docs/SPEC.md](docs/SPEC.md).

