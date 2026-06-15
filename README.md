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

## Ejecucion local

```powershell
docker compose up --build -d

cd frontend
npm ci
$env:VITE_API_URL="http://localhost:8000"
npm run dev -- --host 0.0.0.0
```

La configuracion se toma de `.env`; usa `.env.example` como referencia. El perfil
`init` es destructivo y crea tambien el administrador inicial configurado en
`INITIAL_ADMIN_EMAIL` y `INITIAL_ADMIN_PASSWORD`.

Solo cuando sea necesario borrar y recrear todo el esquema de RDS:

```powershell
docker compose --profile init run --rm database-init
```

Todos los microservicios usan exclusivamente SQL Server en RDS mediante
`RDS_HOST`, `RDS_PORT`, `RDS_DB`, `RDS_USER` y `RDS_PASSWORD`. No se admite
SQLite ni una URL de base de datos alternativa.

El Security Group de RDS debe permitir trafico TCP al puerto `1433` desde el
equipo o la infraestructura donde se ejecuten los contenedores.

Frontend: `http://localhost:5173`

Gateway: `http://localhost:8000`

La imagen del API Gateway puede compilar y servir el frontend desde el mismo
origen. El despliegue publico actual usa S3 para la SPA y el ELB para la API.

| Recurso | URL |
| --- | --- |
| Frontend publico | `http://go-henry-go.s3-website-us-east-1.amazonaws.com/` |
| API publica | `http://ELB-GoHenry-680921418.us-east-1.elb.amazonaws.com` |
| Instancia directa | `http://100.30.192.129:8000` |

Las imagenes de tiendas y productos se guardan como enlaces `http/https` en la
base de datos. El despliegue no requiere EFS ni volumenes compartidos para
archivos.

## Documentacion tecnica

- [Indice y arquitectura](docs/DOCUMENTACION_SERVICIOS.md)
- [Frontend](docs/FRONTEND.md)
- [Backend](docs/BACKEND.md)
