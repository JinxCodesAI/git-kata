FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    git \
    openssh-server \
    && rm -rf /var/lib/apt/lists/*

# Create git user
RUN useradd -m -u 1000 git

# Create repos directory
RUN mkdir -p /repos && chown git:git /repos

USER git
WORKDIR /repos

# Start git daemon
CMD ["git", "daemon", "--reuseaddr", "--verbose", "--base-path=/repos", "--export-all", "--enable=receive-pack", "--port=9418", "/repos"]
