ARG VERSION=lts

FROM node:$VERSION

LABEL maintainer="Renoki Co. <alex@renoki.org>"

COPY . /app

RUN cd /app && \
    mkdir stats && \
    npm install && \
    npm run lint && \
    npm run build && \
    npm install modclean -g && \
    rm -rf coverage/ docs/ src/ tests/ typings/ .git/ .github/ *.md && \
    rm -rf node_modules/*/test/ node_modules/*/tests/ && \
    npm prune && \
    modclean -n default:safe --run && \
    npm uninstall -g modclean

EXPOSE 6001

WORKDIR /app

ENTRYPOINT ["node", "/app/bin/server.js", "start"]
