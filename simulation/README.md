# Satphone simulation (C++)

Drogon-based API server with one GET endpoint.

## API

- **GET `/{id}`** — Returns JSON `{"value": "<id>"}` where `<id>` is the path segment (e.g. `GET /abc123` → `{"value": "abc123"}`).

## Local build (requires CMake + Drogon)

Install [Drogon](https://github.com/drogonframework/drogon) and its dependencies, then:

```bash
make
./build/sim
```

Server listens on `http://0.0.0.0:8848` by default. Override with `PORT` (e.g. `PORT=3000 ./build/sim`).

## Docker build and run

```bash
docker build -t satphone-sim .
docker run --rm -p 8848:8848 satphone-sim
```

Or with docker-compose:

```bash
docker compose up --build
```

Then: `curl http://localhost:8848/your-id` → `{"value":"your-id"}`.

The image uses the official [drogonframework/drogon](https://hub.docker.com/r/drogonframework/drogon) image for both build and runtime.
