{{- define "wormhole.labels" -}}
app.kubernetes.io/name: wormhole-server
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
