# Build from the repository root: docker build -f services/document-renderer/Dockerfile .
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends libreoffice-writer fonts-liberation2 fontconfig ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY services/document-renderer/package.json ./
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npm install --omit=dev && npx playwright install --with-deps chromium
COPY services/document-renderer/*.mjs ./
COPY artifacts/jak-sanggar/public/dokumen-fix/ /app/native-templates/
ENV DOCUMENT_RENDERER_HOST=0.0.0.0 DOCUMENT_RENDERER_PORT=3001 NATIVE_TEMPLATE_ROOT=/app/native-templates LIBREOFFICE_PATH=/usr/bin/libreoffice
USER node
EXPOSE 3001
CMD ["node", "server.mjs"]
