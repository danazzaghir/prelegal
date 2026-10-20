# Stage 1: build the frontend as static files.
FROM node:24-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: the FastAPI backend, which serves the API and the built frontend.
FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY backend/ ./
RUN uv sync --locked --no-dev
COPY --from=frontend /app/frontend/out /app/static
# The Common Paper templates the backend serves and gives to the AI.
COPY catalog.json /app/catalog.json
COPY templates/ /app/templates/

# The database lives inside the container and is recreated on every start.
ENV PATH="/app/backend/.venv/bin:$PATH" \
    DATABASE_PATH=/app/data/prelegal.db \
    STATIC_DIR=/app/static \
    HOST=0.0.0.0 \
    PORT=8000
EXPOSE 8000
CMD ["prelegal-backend"]
