FROM python:3.12-slim

WORKDIR /app

COPY services/users-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/users-service/app ./app

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
