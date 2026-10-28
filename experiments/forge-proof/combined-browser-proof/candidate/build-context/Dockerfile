# HOST-001 packaging candidate only. Build context comes from prepare_context.py.
# SPDX-License-Identifier: GPL-3.0-or-later
# Pin both official base-image tags to reviewed sha256 digests before release.
ARG BUILD_IMAGE
ARG RUNTIME_IMAGE
FROM ${BUILD_IMAGE} AS build
ENV MAVEN_OPTS="-Xmx2g -XX:MaxMetaspaceSize=384m -XX:ActiveProcessorCount=2"
WORKDIR /opt/forge-proof
RUN apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*
RUN git init -q forge \
 && git -C forge -c credential.helper= fetch -q --depth=1 https://github.com/Card-Forge/forge.git e5a0f8156da70ffc7866f923bed371c0111707cd \
 && git -C forge checkout -q --detach FETCH_HEAD \
 && test "$(git -C forge rev-parse HEAD)" = e5a0f8156da70ffc7866f923bed371c0111707cd
COPY native/adapter/src/ adapter/src/
COPY native/decks/ decks/
COPY native/rules-data/current/ rules-data/current/
COPY native/cpu/combined-native-ai.patch native/cpu/runtime-sha256.json cpu/
COPY native/build-ai-overlay.sh build-ai-overlay.sh
COPY native/human/ human/
COPY native/build-human-overlay.sh build-human-overlay.sh
COPY native/LICENSE native/PROVENANCE.md native/CONTRACT.md notices/
COPY hosting/assemble.sh /tmp/assemble.sh
RUN test "$(sha256sum adapter/src/cardstashy/forge/ForgeHttpBridge.java | cut -d' ' -f1)" = "1213d8acfa1d65f39d8184365ebca2815b9b41776e8f8847abf1517bf5464e84" \
 && bash /tmp/assemble.sh

FROM ${RUNTIME_IMAGE} AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 fontconfig libfreetype6 ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --gid 10001 forgehost \
 && useradd --uid 10001 --gid 10001 --no-create-home --home-dir /run/cardstashy/home forgehost \
 && mkdir -p /run/cardstashy \
 && chown 10001:10001 /run/cardstashy
COPY --from=build /opt/forge-proof /opt/forge-proof
COPY --from=build /opt/m2 /opt/m2
COPY hosting/gateway.py /opt/host001/gateway.py
COPY hosting/bootstrap.py /opt/host-service/bootstrap.py
COPY hosting/checkpoint-files.json /opt/host001/checkpoint-files.json
COPY hosting/assemble.sh /opt/host001/assemble.sh
COPY Dockerfile /opt/host001/Dockerfile
LABEL org.opencontainers.image.title="CardStashy Forge HOST-001 candidate" \
      org.opencontainers.image.revision="1213d8acfa1d65f39d8184365ebca2815b9b41776e8f8847abf1517bf5464e84"
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 USE_SENTRY=false
USER 10001:10001
WORKDIR /run/cardstashy
EXPOSE 8080
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=15s --timeout=3s --start-period=120s --retries=3 \
 CMD ["python3", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/ready', timeout=2).read()"]
ENTRYPOINT ["python3", "/opt/host-service/bootstrap.py"]

LABEL org.cardstashy.native-manifest-sha256="c542dc0870c00f4f8ce43e2df785cfab84f1a5df1d4f3edd0128a14d6afc013d"

LABEL org.cardstashy.native-ai-modified="true" \
      org.cardstashy.native-ai-class-set-sha256="e39ea6388050f31319b121c0605fde23069d35e7133a203fd19f0a6c72528f80"
