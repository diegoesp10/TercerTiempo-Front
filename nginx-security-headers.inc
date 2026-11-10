# Cabeceras de los ficheros que sirve Nginx. Las respuestas de la API conservan las suyas.
# CSP: todo sale de la propia web salvo la tipografía (Google Fonts). 'wasm-unsafe-eval' es para el recorte de la foto
# del jugador (MediaPipe, WebAssembly) y blob: para sus workers y para los vídeos. Los pagos de Stripe son una
# navegación a su página, no un recurso de esta, así que no aparecen aquí.
add_header X-Content-Type-Options nosniff always;
add_header X-Frame-Options DENY always;
add_header Referrer-Policy strict-origin-when-cross-origin always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;
