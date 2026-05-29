# Build stage: official Drogon image has framework and deps installed
FROM drogonframework/drogon:latest AS builder
WORKDIR /build

COPY . .
RUN mkdir -p build && cd build && \
    cmake .. && cmake --build .

# Run stage: same image so shared libs (drogon, trantor) are available
FROM drogonframework/drogon:latest
WORKDIR /app

RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/build/sim /app/sim
COPY nginx.conf /etc/nginx/conf.d/satphone.conf
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Drogon listens internally on 8849; nginx serves the external port 8848 and
# proxies /api/ (REST) and /ws/ (WebSocket) to Drogon.
EXPOSE 8848
ENV PORT=8849

# WebSocket position broadcast cadence in Hz (clamped to [1, 144]).
ENV STREAM_HZ=144

# Log verbosity: TRACE, DEBUG, INFO, WARN, or ERROR. Set to DEBUG to see orbit updates.
ENV SIM_LOG_LEVEL=INFO

ENTRYPOINT ["/app/docker-entrypoint.sh"]