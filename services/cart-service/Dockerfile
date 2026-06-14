FROM golang:1.23-alpine AS builder

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . ./
RUN go build -o /bin/cart-service .

FROM alpine:3.20

RUN apk add --no-cache ca-certificates \
    && wget -q -O /etc/ssl/certs/aws-rds-global-bundle.pem \
        https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
    && cat /etc/ssl/certs/aws-rds-global-bundle.pem >> /etc/ssl/certs/ca-certificates.crt

WORKDIR /app
COPY --from=builder /bin/cart-service /app/cart-service

ENV PORT=8000
EXPOSE 8000

CMD ["/app/cart-service"]
