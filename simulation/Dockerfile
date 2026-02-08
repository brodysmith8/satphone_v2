# Build stage: official Drogon image has framework and deps installed
FROM drogonframework/drogon:latest AS builder
WORKDIR /build

COPY . .
RUN mkdir -p build && cd build && \
    cmake .. && cmake --build .

# Run stage: same image so shared libs (drogon, trantor) are available
FROM drogonframework/drogon:latest
WORKDIR /app

COPY --from=builder /build/build/sim /app/sim

EXPOSE 8848
ENV PORT=8848
ENTRYPOINT ["/app/sim"]
