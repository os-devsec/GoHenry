FROM golang:1.23-alpine AS builder

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . ./
RUN go build -o /bin/cart-service .

FROM alpine:3.20

WORKDIR /app
COPY --from=builder /bin/cart-service /app/cart-service

ENV PORT=8000
EXPOSE 8000

CMD ["/app/cart-service"]
