FROM node:24.15.0-alpine

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
