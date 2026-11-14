{{/* Base name: the release name unless fullnameOverride is set (kept short: suffixes are appended) */}}
{{- define "wormhole.fullname" -}}
{{- default .Release.Name .Values.fullnameOverride | trunc 40 | trimSuffix "-" -}}
{{- end -}}

{{/* Selector labels (immutable once deployed). Context: dict "root" . "component" "mailbox" */}}
{{- define "wormhole.selectorLabels" -}}
app.kubernetes.io/name: wormhole-server
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{/* Common labels. Context: dict "root" . "component" "mailbox" */}}
{{- define "wormhole.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .root.Chart.Name .root.Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{ include "wormhole.selectorLabels" . }}
app.kubernetes.io/version: {{ .root.Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
{{- with .root.Values.commonLabels }}
{{ toYaml . }}
{{- end }}
{{- end -}}

{{/* Image reference. Context: dict "root" . "image" <image map>. A digest wins over the tag. */}}
{{- define "wormhole.image" -}}
{{- if .image.digest -}}
{{ .image.repository }}{{ if .image.tag }}:{{ .image.tag }}{{ end }}@{{ .image.digest }}
{{- else -}}
{{ .image.repository }}:{{ default .root.Chart.AppVersion .image.tag }}
{{- end -}}
{{- end -}}

{{/* Pull policy: explicit value, else Always for the floating "latest" tag, IfNotPresent otherwise */}}
{{- define "wormhole.pullPolicy" -}}
{{- if .image.pullPolicy -}}
{{ .image.pullPolicy }}
{{- else if and (not .image.digest) (eq (default .root.Chart.AppVersion .image.tag) "latest") -}}
Always
{{- else -}}
IfNotPresent
{{- end -}}
{{- end -}}

{{/* Scheduling block shared by the pods. Context: the component values map */}}
{{- define "wormhole.scheduling" -}}
{{- with .nodeSelector }}
nodeSelector: {{- toYaml . | nindent 2 }}
{{- end }}
{{- with .affinity }}
affinity: {{- toYaml . | nindent 2 }}
{{- end }}
{{- with .tolerations }}
tolerations: {{- toYaml . | nindent 2 }}
{{- end }}
{{- with .priorityClassName }}
priorityClassName: {{ . }}
{{- end }}
{{- end -}}

{{/* Render a value that may be a string (templated) or a structure (YAML, then templated). Context: dict "value" x "context" $ */}}
{{- define "wormhole.tplvalue" -}}
{{- if typeIs "string" .value -}}
{{ tpl .value .context }}
{{- else -}}
{{ tpl (toYaml .value) .context }}
{{- end -}}
{{- end -}}
