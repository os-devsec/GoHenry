from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import STORE_LOGO_DIR
from .routes import router


app = FastAPI(title="Restaurant Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
STORE_LOGO_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/v1/tiendas/logos", StaticFiles(directory=STORE_LOGO_DIR), name="store-logos")
app.include_router(router)
