FROM golang:1.23-alpine AS builder

WORKDIR /src
COPY services/catalog-service/go.mod services/catalog-service/go.sum ./
RUN go mod download
COPY services/catalog-service ./
RUN go build -o /bin/catalog-service .

FROM alpine:3.20

WORKDIR /app
COPY --from=builder /bin/catalog-service /app/catalog-service
RUN mkdir -p /app/uploads/products

ENV PORT=8000
EXPOSE 8000

CMD ["/app/catalog-service"]
