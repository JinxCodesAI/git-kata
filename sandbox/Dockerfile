FROM alpine:3.19

RUN apk add --no-cache \
    git \
    bash \
    coreutils

# Create non-root user for sandbox
RUN adduser -D -u 1000 kata

# Configure git as the kata user
USER kata
RUN git config --global user.email "kata@git.local" \
    && git config --global user.name "Kata User" \
    && git config --global init.defaultBranch main

WORKDIR /workspace

CMD ["sleep", "infinity"]
