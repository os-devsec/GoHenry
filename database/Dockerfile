FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir pymssql==2.3.4

COPY init_sqlserver.py schema_sqlserver.sql ./

CMD ["python", "init_sqlserver.py"]
