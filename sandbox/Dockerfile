FROM alpine:3.19

RUN apk add --no-cache \
    git \
    bash \
    coreutils \
    && git config --global user.email "kata@git.local" \
    && git config --global user.name "Kata User" \
    && git config --global init.defaultBranch main

WORKDIR /workspace

CMD ["sleep", "infinity"]
