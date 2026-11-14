# Copyright (c) 2026 Luca Martinetti (MIT License)
# Modifications and additions (c) 2026 SCTG Development - Ronan Le Meillat (MIT License)
.PHONY: build server wasm web run test clean

WASM_CRATE = crates/wormhole-wasm
WASM_OUT = public/wasm

# Everything: Rust server, WebAssembly client, React UI (dist/)
build: server wasm web

server:
	cargo build --release -p wormhole-page-server

wasm:
	cd $(WASM_CRATE) && wasm-pack build --target web --release
	mkdir -p $(WASM_OUT)
	cp $(WASM_CRATE)/pkg/wormhole_wasm_bg.wasm $(WASM_OUT)/
	cp $(WASM_CRATE)/pkg/wormhole_wasm.js $(WASM_OUT)/

web:
	npm ci
	npm run build

run: build
	./target/release/wormhole-page-server --static-dir dist/

test:
	npx playwright test

clean:
	cargo clean
	rm -rf $(WASM_OUT) dist node_modules
