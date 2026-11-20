FROM golang:1.23-alpine AS builder

WORKDIR /app
COPY go.mod ./
# Download dependencies if network available or vendor
RUN go mod download || true

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /collector main.go

FROM alpine:3.20
WORKDIR /root/
COPY --from=builder /collector .
EXPOSE 5141 5140
CMD ["./collector"]
