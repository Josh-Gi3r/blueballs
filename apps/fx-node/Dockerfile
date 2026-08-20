# node:24.15.0-alpine, pinned to the multi-platform OCI index.
FROM node:24.15.0-alpine@sha256:d1b3b4da11eefd5941e7f0b9cf17783fc99d9c6fc34884a665f40a06dbdfc94f

WORKDIR /app

COPY packages/fx-market ./packages/fx-market
COPY packages/fx-fiat ./packages/fx-fiat
COPY packages/fx-policy ./packages/fx-policy
COPY packages/fx-pricing ./packages/fx-pricing
COPY packages/fx-liquidity ./packages/fx-liquidity
COPY apps/fx-node ./apps/fx-node

WORKDIR /app/apps/fx-node

ENV FX_NODE_MODE=reference-sandbox
ENV FX_NODE_HOST=0.0.0.0
ENV FX_NODE_PORT=8788
ENV FX_NODE_DATA_DIR=/data

VOLUME ["/data"]
EXPOSE 8788

CMD ["node", "src/cli.js"]
