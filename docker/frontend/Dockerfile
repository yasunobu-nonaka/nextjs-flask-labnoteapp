FROM node:22-alpine

WORKDIR /app

COPY frontend/package*.json ./
RUN npm install

COPY frontend .

# node:22-alpine には非rootの "node" ユーザーが標準で用意されている
RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["npx", "next", "dev", "--webpack"]
