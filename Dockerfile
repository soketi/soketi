ARG VERSION=lts

FROM node:$VERSION-alpine

LABEL maintainer="Renoki Co. <alex@renoki.org>"

ENV PYTHONUNBUFFERED=1

COPY . /tmp/build

WORKDIR /tmp/build

RUN apk add --no-cache --update git python3 gcompat && \
    apk add --virtual build-dependencies build-base gcc wget && \
    ln -sf python3 /usr/bin/python && \
    python3 -m ensurepip && \
    pip3 install --no-cache --upgrade pip setuptools && \
    ash ./build-minimal-production && \
    mkdir -p /app && \
    cd /tmp/build && \
    mv production-app/* /app/ && \
    rm -rf /tmp/* /var/cache/* /usr/lib/python* && \
    apk --purge del build-dependencies build-base gcc

WORKDIR /app

EXPOSE 6001

ENTRYPOINT ["node", "/app/bin/server.js", "start"]
