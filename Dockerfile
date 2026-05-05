FROM node:18
WORKDIR /learnhub-app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 4000
CMD ["node", "learnhub.js"]
