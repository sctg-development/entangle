# wormhole-server Helm chart

Self-hosted [magic-wormhole](https://magic-wormhole.readthedocs.io/) servers for entangle:

| Component | Image | Port | Role |
|-----------|-------|------|------|
| mailbox | `docker.io/sctg/wormhole-mailbox` | 4000 (HTTP, WebSocket `/v1`) | rendezvous: exchanges the PAKE handshake; SQLite state |
| relay | `docker.io/sctg/wormhole-relay` | 4001 (raw TCP) | transit relay when peers cannot connect directly |
| page (optional) | `docker.io/sctg/wormhole-page` | 8080 (HTTP) | browser client + `/transit` WebSocket-to-TCP bridge to the relay |

All images are multi-arch (amd64, arm64).

```bash
helm install wormhole deploy/helm/wormhole-server -n wormhole --create-namespace \
  --set ingress.enabled=true --set ingress.host=wormhole.example.org --set ingress.className=nginx \
  --set relay.service.type=LoadBalancer
```

`helm status wormhole` prints the settings entangle needs (`ENTANGLE_RENDEZVOUS`, `ENTANGLE_RELAY`) and warns about
common misconfigurations (nothing exposed, relay only reachable inside the cluster, floating image tags).

## What the chart does by default

- **Hardened pods**: non-root (uid 10001), read-only root filesystem, all capabilities dropped, `RuntimeDefault` seccomp,
  no service account token. The mailbox gets a 1 Gi volume (`fsGroup 10001`); scratch space is an `emptyDir` on `/tmp`.
  (The published page image has no `USER`; it also runs as uid 10001, the files are world-readable. Checked with 0.8.1.)
- **Mailbox**: exactly one replica, `Recreate` strategy (SQLite on a ReadWriteOnce volume). It only holds in-flight
  rendezvous, so losing the volume loses no user data.
- **Relay**: 2 stateless replicas spread over nodes (soft constraint).
- **Probes**: HTTP on the mailbox (`/`) and the page (`/health`), TCP on the relay.
- **Ingress** (opt-in): one host. With the page enabled, `/v1` goes to the mailbox and `/` to the page; without it, `/` goes to the mailbox.
- **Page image tag** defaults to the chart `appVersion` (the entangle release the page is built from).

## Exposing the relay

The relay speaks raw TCP, which an Ingress cannot carry. Choose one:

| Cluster | How |
|---------|-----|
| cloud with load balancers | `relay.service.type=LoadBalancer` (+ `loadBalancerIP`, `externalTrafficPolicy`, `annotations`) |
| bare metal / NAT | `relay.service.type=NodePort` + `relay.service.nodePort` (30000-32767), then forward a public port to it |
| Gateway API / TCP-capable controller | keep `ClusterIP` and add the route through `extraObjects` (below) |

`extraObjects` takes strings or maps; both are rendered with `tpl`, so you can use `{{ include "wormhole.fullname" . }}`.
Example, Gateway API (the haproxytech kubernetes-ingress controller with `TCPRoute`):

```yaml
extraObjects:
  - apiVersion: gateway.networking.k8s.io/v1beta1
    kind: Gateway
    metadata: {name: '{{ include "wormhole.fullname" . }}'}
    spec:
      gatewayClassName: haproxy
      listeners: [{name: transit, protocol: TCP, port: 4001, allowedRoutes: {kinds: [{kind: TCPRoute}]}}]
  - apiVersion: gateway.networking.k8s.io/v1alpha2
    kind: TCPRoute
    metadata: {name: '{{ include "wormhole.fullname" . }}-relay'}
    spec:
      parentRefs: [{name: '{{ include "wormhole.fullname" . }}', sectionName: transit}]
      rules: [{backendRefs: [{name: '{{ include "wormhole.fullname" . }}-relay', port: 4001}]}]
```

## WebSocket timeouts

The mailbox WebSocket and the page's `/transit` bridge are long-lived connections: raise the idle timeout on your controller
through `ingress.annotations` (ingress-nginx: `nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"`; haproxytech:
`haproxy.org/timeout-tunnel: "1h"`).

## Pinning images

Only the floating `latest` tag is published for the mailbox and relay images (the page has release tags). For reproducible
deployments pin the digest: `mailbox.image.digest=sha256:...`, `relay.image.digest=sha256:...`
(`docker buildx imagetools inspect docker.io/sctg/wormhole-mailbox:latest` prints it). A digest wins over the tag; the pull
policy defaults to `Always` for a `latest` tag and `IfNotPresent` otherwise.

## Values

Every component (`mailbox`, `relay`, `page`) accepts `image`, `resources`, `podLabels`, `podAnnotations`, `nodeSelector`,
`affinity`, `tolerations`, `priorityClassName`, `podSecurityContext`, `securityContext`, `livenessProbe`, `readinessProbe`.
Values are validated by `values.schema.json` (service type, ports, sizes, digests, URLs...).

| Key | Default | Meaning |
|-----|---------|---------|
| `fullnameOverride` | release name | prefix of the resource names (`<prefix>-mailbox`, `-relay`, `-page`) |
| `commonLabels` | `{}` | extra labels on every object |
| `imagePullSecrets` | `[]` | pull secrets for the pods |
| `mailbox.persistence.enabled` | `true` | `false` = `emptyDir` (state lost at each restart: harmless) |
| `mailbox.persistence.existingClaim` | `""` | use your own PVC |
| `mailbox.persistence.size` / `storageClassName` / `accessModes` | `1Gi` / cluster default / `[ReadWriteOnce]` | |
| `relay.replicas` | `2` | |
| `relay.spread.*` / `relay.topologySpreadConstraints` | soft spread over hostnames / `[]` | the latter replaces the former (templated) |
| `relay.podDisruptionBudget.enabled` / `minAvailable` | `false` / `1` | only rendered with more than one replica |
| `relay.service.type` / `nodePort` / `loadBalancerIP` / `externalTrafficPolicy` / `annotations` | `ClusterIP` ... | see above |
| `page.enabled` | `true` | browser page and `/transit` bridge |
| `page.replicas` | `1` | |
| `page.config.appId` | `github.com/sctg-development/entangle` | wormhole AppID; peers meet only when identical (entangle >= 0.8.1) |
| `page.config.entangleUrl` | latest release | target of the "Get entangle" link |
| `page.config.profile` | `""` | `self-hosted` (default) or `official` |
| `page.config.mailboxUrl` | `""` | WebSocket URL given to browsers (`""` = `/v1` on the page's host) |
| `page.config.transitHint` | `""` | `tcp://host:port` advertised to CLI peers (`""` = `tcp://<page host>:4001`) |
| `page.config.cspConnectSrc` | `""` | CSP `connect-src` override |
| `page.extraEnv` | `[]` | extra container environment |
| `ingress.enabled` / `className` / `host` / `pathType` / `annotations` | `false` / `""` / `wormhole.example.org` / `Prefix` / `{}` | |
| `ingress.tls.enabled` / `secretName` | `true` / `wormhole-tls` | |
| `extraObjects` | `[]` | extra manifests (templated) |

## Upgrading from 0.1.0

0.1.0 was never deployed. 0.2.0 renames the pod labels (`app` became the `app.kubernetes.io/*` set) and moves
`mailbox.image` / `relay.image` / `page.image` from a string to a map (`repository`, `tag`, `digest`, `pullPolicy`).
Update your values accordingly.
