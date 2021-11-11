ARG VERSION=lts

FROM node:$VERSION

LABEL maintainer="Renoki Co. <alex@renoki.org>"

ENV PYTHONUNBUFFERED=1

COPY . /tmp/build

RUN apk add --no-cache --update git python3 gcompat && \
    apk add --virtual build-dependencies build-base gcc wget && \
    ln -sf python3 /usr/bin/python && \
    python3 -m ensurepip && \
    pip3 install --no-cache --upgrade pip setuptools

WORKDIR /tmp/build

# Install the app in temporary build folder.
RUN npm install && \
    npm run lint && \
    npm run build && \
    # Copy just the necessary files to the /app folder.
    mkdir -p /app && \
    cp -r bin/ dist/ LICENSE package.json README.md /app && \
    rm -rf /tmp/build && \
    # Delete the node_modules folder and install just the
    # packages required for production.
    cd /app && \
    npm install --only=prod --ignore-scripts

WORKDIR /app

# Cleanup the image.
RUN npm install modclean -g && \
    rm -rf node_modules/*/test/ node_modules/*/tests/ && \
    apk --purge del build-dependencies && \
    npm prune && \
    npm cache clean --force && \
    modclean -n default:safe --run && \
    npm uninstall -g modclean

EXPOSE 6001

ENTRYPOINT ["node", "/app/bin/server.js", "start"]
