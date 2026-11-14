FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --include=optional
RUN npm install --no-save @rollup/rollup-linux-x64-musl@4.68.3
COPY . .
RUN npm run build

EXPOSE 5173
CMD ["npm", "run", "dev"]

