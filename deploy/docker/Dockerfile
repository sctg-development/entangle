# One image source for both magic-wormhole servers (official Python
# implementation, Twisted). Build:
#   docker build --target mailbox -t wormhole-mailbox deploy/docker
#   docker build --target relay   -t wormhole-relay   deploy/docker
# or, without --target (what the CI does, its build action only passes build args):
#   docker build --build-arg SERVER=relay -t wormhole-relay deploy/docker
ARG SERVER=mailbox

FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN useradd -r -u 10001 wormhole && mkdir /data && chown wormhole /data
WORKDIR /data

FROM base AS mailbox
RUN pip install magic-wormhole-mailbox-server
USER wormhole
EXPOSE 4000
CMD ["twist", "wormhole-mailbox", "--channel-db=/data/channel.sqlite", "--usage-db=/data/usage.sqlite"]

FROM base AS relay
RUN pip install magic-wormhole-transit-relay
USER wormhole
EXPOSE 4001
CMD ["twist", "transitrelay", "--port=tcp:4001"]

# Default stage: the one selected by --build-arg SERVER=mailbox|relay (an ARG may name a previous stage)
FROM ${SERVER} AS server
