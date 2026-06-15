import os
from pathlib import Path

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse


SERVICE_ROUTES = [
    ("/api/v1/auth", os.getenv("AUTH_SERVICE_URL", "http://auth-service:8000")),
    ("/api/v1/admin-plataforma", os.getenv("USERS_SERVICE_URL", "http://users-service:8000")),
    ("/api/v1/usuarios", os.getenv("USERS_SERVICE_URL", "http://users-service:8000")),
    ("/api/v1/tiendas", os.getenv("RESTAURANT_SERVICE_URL", "http://restaurant-service:8000")),
    ("/api/v1/productos", os.getenv("CATALOG_SERVICE_URL", "http://catalog-service:8000")),
    ("/api/v1/categorias", os.getenv("CATALOG_SERVICE_URL", "http://catalog-service:8000")),
    ("/api/v1/carritos", os.getenv("CART_SERVICE_URL", "http://cart-service:8000")),
    ("/api/v1/pedidos", os.getenv("ORDERS_SERVICE_URL", "http://orders-service:8000")),
    ("/api/v1/estados-pedido", os.getenv("ORDERS_SERVICE_URL", "http://orders-service:8000")),
    ("/api/v1/ubicaciones", os.getenv("ORDERS_SERVICE_URL", "http://orders-service:8000")),
    ("/api/v1/pagos", os.getenv("PAYMENTS_SERVICE_URL", "http://payments-service:8000")),
    ("/api/v1/metodos-pago", os.getenv("PAYMENTS_SERVICE_URL", "http://payments-service:8000")),
    ("/api/v1/comisiones", os.getenv("PAYMENTS_SERVICE_URL", "http://payments-service:8000")),
    ("/api/v1/repartidores", os.getenv("DELIVERY_SERVICE_URL", "http://delivery-service:8000")),
    ("/api/v1/asignaciones-repartidor", os.getenv("DELIVERY_SERVICE_URL", "http://delivery-service:8000")),
]
FRONTEND_DIR = Path(__file__).resolve().parent / "frontend"


app = FastAPI(title="API Gateway")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "api-gateway"}


def target_for(path: str) -> str | None:
    if path.startswith("/api/v1/tiendas/") and path.endswith("/productos"):
        return os.getenv("CATALOG_SERVICE_URL", "http://catalog-service:8000")
    if path.startswith("/api/v1/pedidos/") and path.endswith("/pago"):
        return os.getenv("PAYMENTS_SERVICE_URL", "http://payments-service:8000")
    for prefix, url in SERVICE_ROUTES:
        if path.startswith(prefix):
            return url
    return None


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def proxy(path: str, request: Request) -> Response:
    full_path = "/" + path
    target = target_for(full_path)
    if target is None:
        if request.method == "GET" and FRONTEND_DIR.exists():
            requested_file = (FRONTEND_DIR / path).resolve()
            if FRONTEND_DIR in requested_file.parents and requested_file.is_file():
                return FileResponse(requested_file)
            return FileResponse(FRONTEND_DIR / "index.html")
        return Response(content='{"detail":"Ruta no registrada en gateway"}', status_code=404, media_type="application/json")

    body = await request.body()
    url = httpx.URL(target + full_path).copy_with(query=request.url.query.encode("utf-8"))
    headers = dict(request.headers)
    headers.pop("host", None)

    async with httpx.AsyncClient(timeout=30.0) as client:
        upstream = await client.request(
            request.method,
            url,
            content=body,
            headers=headers,
        )

    excluded = {"content-encoding", "content-length", "transfer-encoding"}
    response_headers = {key: value for key, value in upstream.headers.items() if key.lower() not in excluded}
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
        media_type=upstream.headers.get("content-type"),
    )
