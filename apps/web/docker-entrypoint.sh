#!/bin/sh
# Arranque del servidor estático de Mareía.
#
# Lo único que hace de más, antes de ceder el proceso a nginx, es DECIR dónde va a escuchar y qué
# día publica el HTML que sirve. Las dos cosas son las que no se pueden deducir de "el contenedor
# está running": un bind a la interfaz equivocada da 502 en Traefik con el contenedor sano, y un
# sitio SSG puede estar sirviendo perfectamente las mareas de anteayer.
#
# La dirección se LEE de la configuración en vez de repetirse aquí: un mensaje que se escribe a
# mano puede decir 0.0.0.0 mientras el servidor escucha en otro sitio, y entonces el log deja de
# ser una prueba y pasa a ser una opinión.
set -eu

CONFIG=/etc/nginx/nginx.conf
MARCA_FECHA=/etc/mareia/build-date

directiva() {
    sed -n "s/^[[:space:]]*$1[[:space:]]\{1,\}\([^;]*\);.*/\1/p" "$CONFIG" | head -n 1
}

echo "[mareia] escucha: $(directiva listen) · raíz: $(directiva root) · publica el día: $(cat "$MARCA_FECHA")"

exec nginx -g 'daemon off;'
