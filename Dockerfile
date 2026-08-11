FROM node:22-bookworm-slim AS web-build

WORKDIR /workspace/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.lock ./
RUN pip install --no-cache-dir -r requirements.lock
COPY app/ ./app/
COPY --from=web-build /workspace/web/dist ./web/dist

CMD ["python", "-m", "app.bot"]
