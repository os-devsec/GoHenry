#!/usr/bin/env bash

set -Eeuo pipefail

cd "$(dirname "$0")"

export COMPOSE_PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-1}"
export DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-1}"
MIN_DOCKER_FREE_GB="${MIN_DOCKER_FREE_GB:-8}"

services=(
  auth-service
  users-service
  restaurant-service
  catalog-service
  cart-service
  orders-service
  payments-service
  delivery-service
  api-gateway
)

on_error() {
  echo
  echo "El despliegue fallo. Estado actual:"
  docker compose ps --all || true
}
trap on_error ERR

if [[ ! -f .env ]]; then
  echo "Falta el archivo .env. Copia .env.example y configura los valores reales."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker no esta disponible para este usuario."
  echo "Ejecuta el script con sudo o agrega el usuario al grupo docker."
  exit 1
fi

docker compose config --quiet

if ! [[ "$MIN_DOCKER_FREE_GB" =~ ^[0-9]+$ ]]; then
  echo "MIN_DOCKER_FREE_GB debe ser un numero entero."
  exit 1
fi

docker_root="$(docker info --format '{{.DockerRootDir}}')"
if [[ -d "$docker_root" ]]; then
  available_kb="$(df -Pk "$docker_root" | awk 'NR == 2 {print $4}')"
  required_kb=$((MIN_DOCKER_FREE_GB * 1024 * 1024))

  if (( available_kb < required_kb )); then
    available_gb=$((available_kb / 1024 / 1024))
    echo "ESPACIO INSUFICIENTE: Docker tiene ${available_gb} GB libres en $docker_root."
    echo "Este despliegue requiere al menos ${MIN_DOCKER_FREE_GB} GB libres para compilar."
    echo
    echo "Diagnostico:"
    echo "  df -hT / $docker_root"
    echo "  docker system df"
    echo
    echo "Limpieza de caches e imagenes sin usar (no elimina volumenes):"
    echo "  docker builder prune -af"
    echo "  docker image prune -af"
    echo
    echo "Si el volumen EBS fue ampliado, extiende tambien la particion y el filesystem."
    echo "Consulta la seccion EC2 del README."
    exit 1
  fi
fi

if [[ -r /proc/meminfo ]]; then
  memory_kb="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)"
  swap_kb="$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo)"
  if (( memory_kb < 1900000 && swap_kb < 1000000 )); then
    echo "ADVERTENCIA: la instancia tiene menos de 2 GB de RAM y menos de 1 GB de swap."
    echo "El build puede volver a ser terminado por el kernel. Revisa la seccion EC2 del README."
    echo
  fi
fi

echo "Construyendo servicios secuencialmente (COMPOSE_PARALLEL_LIMIT=$COMPOSE_PARALLEL_LIMIT)..."
for service in "${services[@]}"; do
  echo
  echo "==> Construyendo $service"
  docker compose build "$service"
done

echo
echo "Iniciando contenedores..."
docker compose up -d --no-build

echo
docker compose ps --all
