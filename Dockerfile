FROM node:18-alpine

WORKDIR /app

# install deps
COPY package*.json ./
RUN npm install

# copy sources
COPY . .

# prisma generate (if using prisma)
RUN npx prisma generate

# increase memory for tsc if needed
ENV NODE_OPTIONS="--max-old-space-size=2048"

# build
RUN npm run build

EXPOSE 5003
CMD ["npm","run","start"]
