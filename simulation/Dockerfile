# Build stage
FROM gcc:12-bookworm AS builder
WORKDIR /build

COPY Makefile main.cpp ./
RUN make

# Runtime stage (minimal image for running)
FROM debian:bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/sim /app/sim

ENTRYPOINT ["/app/sim"]
