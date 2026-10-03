FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

RUN useradd --uid 10001 --no-create-home meridian
USER 10001
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.asgi:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --proxy-headers --forwarded-allow-ips='*' --no-server-header --no-access-log"]
