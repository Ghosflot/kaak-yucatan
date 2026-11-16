# Explicado fácil

Versión corta de [docs/04](04-campo-y-fuego.md) para quien no conoce el proyecto. Cada cifra
sale de docs/04 y [docs/01](01-hechos-verificados.md).

## ¿Cuál es el problema?

En Yucatán se quema el monte para sembrar. Cada presidente municipal tiene que dar los permisos
de quema y, al terminar la temporada, entregar a SEDER un informe de cómo le fue (así lo pide la
ley). Pero no tiene datos. No sabe en qué partes de su municipio se quema ni en qué semanas.

Lo que se registra no se parece a lo que pasa: en 2023 hubo 187 permisos de quema y el satélite
vio 8,757 focos, un permiso por cada 47 focos. Y en las zonas donde se quema cada año, solo 1 de
cada 4 fuegos cae en la ventana oficial de su zona. La ventana dice cuándo está permitido
quemar, no cuándo se quema; por eso no sirve para saber cuándo vigilar.

## ¿Por qué importa?

Cuando no sabes dónde ni cuándo se quema, no puedes prevenir: mandas a tu gente a ciegas. Y
cuando el fuego se escapa, pierde la misma gente del campo. En Oxkutzcab, una quema de maleza que
se salió de control acabó con 15 hectáreas de limón persa. En 2024 se quemaron más de 20 mil
hectáreas en Yucatán. Es gente sin colchón: 8 de cada 10 hectáreas dependen de la lluvia y solo
2 de cada 100 unidades de producción obtuvieron crédito.

## ¿Cómo lo resolvemos?

Usamos las detecciones de fuego de los sensores MODIS y VIIRS, que van en satélites de la NASA y
de la NOAA, y las pusimos en un solo mapa por municipio. Eliges tu municipio y ves:

1. **Si tu temporada va peor o mejor que lo normal**, día a día y año contra año. Para esto
   juntamos 25 años de MODIS y VIIRS en una sola serie comparable (los dos sensores ven entre 3
   y 5 veces distinta cantidad de fuego, y sin calibrarlos no hay historia larga).
2. **Dónde se quema casi cada año:** los cuadritos de 1 km que tuvieron fuego en 5 o más de las
   14 temporadas de 2012 a 2025, cada uno con su enlace a Google Maps. Ahí vas antes de la
   temporada a hablar con los dueños, revisar guardarrayas y dar permisos.
3. **Cuándo se quema, contra la fecha oficial:** la semana con más fuego de un año normal en tu
   municipio y, en cada zona de quema de Yucatán, cuántos de cada 10 focos cayeron fuera de la
   ventana de SEDER cada año. Ahí sabes cuándo vigilar.

El punto 2 usa solo los 14 años de VIIRS (2012–2025), porque MODIS no ve los fuegos chicos.

Cada municipio tiene además su ficha, lista para mandar por WhatsApp, y sus tablas en CSV.

**Lo que sigue (todavía no está en la página):**

- **Las 4 semanas más fuertes de cada zona.** Ya está medido: en las zonas donde se quema cada
  año, esas 4 semanas atrapan el 49 % del fuego del año siguiente, y la ventana oficial, el
  23 %. Es el doble. El resultado general ya está en la página (Fechas de quema); falta llevar las 4
  semanas de cada lugar. El cálculo está en `analisis/campo_y_fuego.py`.
- **Dónde el fuego ya se ha salido de control antes** (fuegos de 5 días o más), para saber
  dónde poner la vigilancia fuerte.
- **La hoja de cierre para el informe que pide la ley**, armada a partir de la ficha.

**Lo que no hace:** no predice incendios, no avisa en tiempo real (llega horas después de que
pasa el satélite) y no identifica parcelas ni personas.

## ¿Por qué ayuda?

Porque al municipio la ley ya le pide prevenir y reportar, y hoy lo hace sin datos. No le
pedimos que haga nada nuevo: le damos los datos para lo que ya tiene que hacer.

## El proyecto en una línea

K'áak' le dice a cada municipio de Yucatán dónde y en qué semanas se quema su territorio, con
datos de satélite de la NASA, para que prevenga incendios en el lugar y el momento correctos.

## Lo que el jurado espera oír (4 líneas)

> En Yucatán, cada municipio autoriza las quemas agrícolas y debe evaluar su temporada, pero lo
> hace sin datos: en 2023 hubo un permiso por cada 47 focos vistos por satélite. K'áak' une 25
> años de detecciones de MODIS y VIIRS de la NASA en una sola serie comparable, para que cada
> municipio sepa si su temporada va peor o mejor que lo normal. Con 14 años de VIIRS le muestra
> dónde se quema año tras año y, en cada zona, cuánto fuego cae fuera de la ventana oficial. No
> predice incendios: convierte el pasado de cada municipio en un plan de prevención.
