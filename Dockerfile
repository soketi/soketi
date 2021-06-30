ARG VERSION=lts

FROM node:$VERSION

LABEL maintainer="Renoki Co. <alex@renoki.org>"

ENV PYTHONUNBUFFERED=1

COPY . /app

RUN apk add --no-cache --update git python3 gcompat && \
    apk add --virtual build-dependencies build-base gcc wget && \
    ln -sf python3 /usr/bin/python && \
    python3 -m ensurepip && \
    pip3 install --no-cache --upgrade pip setuptools && \
    cd /app && \
    npm install && \
    npm run lint && \
    npm run build && \
    npm install modclean -g && \
    rm -rf coverage/ docs/ src/ tests/ typings/ .git/ .github/ *.md && \
    rm -rf node_modules/*/test/ node_modules/*/tests/ && \
    apk --purge del build-dependencies && \
    npm prune && \
    modclean -n default:safe --run && \
    npm uninstall -g modclean

EXPOSE 6001

WORKDIR /app

ENTRYPOINT ["node", "/app/bin/server.js", "start"]
