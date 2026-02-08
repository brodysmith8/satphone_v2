# Satphone simulation (C++)

## Local build (requires Make + g++)

```bash
make
./sim
```

## Docker build and run

Build and run in one step:

```bash
docker build -t satphone-sim .
docker run --rm satphone-sim
```

Or with docker-compose:

```bash
docker compose build
docker compose run --rm sim
```

The image uses a multi-stage Dockerfile: it compiles with GCC in a build stage, then copies the `sim` binary into a slim Debian runtime image.
