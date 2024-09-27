FROM node:20-alpine
WORKDIR /mabiki
COPY package*.json ./
RUN yarn
RUN apk add git
COPY . .
RUN yarn test

# DO NOT CHANGE ANY BELOW CODE
WORKDIR /
RUN apk update && apk add bash
COPY run_tests.sh ./
RUN chmod +x /run_tests.sh
ENTRYPOINT ["/bin/bash", "-s"]