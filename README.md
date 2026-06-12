# GoHenryGo

Plataforma de pedidos, pagos y delivery para restaurantes del campus UIDE, construida con React y microservicios en Go, Java y Python.

## Funciones principales

- Catalogo de tiendas y productos con categorias.
- Productos extra asociados por categoria.
- Descuentos diarios recurrentes mediante `descuento_inicio` y `descuento_fin`.
- Seccion publica de ofertas activas de varios restaurantes.
- Pedidos con entrega o retiro en tienda.
- Tarifas de envio por zona.
- Paneles para plataforma, restaurantes y repartidores.

## Ejecucion

```powershell
# Solo cuando se necesite borrar y recrear todo el esquema de RDS:
docker compose --profile init run --rm database-init

docker compose up --build -d
cd frontend
npm run dev -- --host 0.0.0.0
```

La configuracion se toma de `.env`; usa `.env.example` como referencia. El perfil
`init` es destructivo y crea tambien el administrador inicial configurado en
`INITIAL_ADMIN_EMAIL` y `INITIAL_ADMIN_PASSWORD`.

El Security Group de RDS debe permitir trafico TCP al puerto `1433` desde el
equipo o la infraestructura donde se ejecuten los contenedores.

Frontend: `http://localhost:5173`

Gateway: `http://localhost:8000`

La documentacion tecnica completa se encuentra en [`docs/DOCUMENTACION_SERVICIOS.md`](docs/DOCUMENTACION_SERVICIOS.md).
