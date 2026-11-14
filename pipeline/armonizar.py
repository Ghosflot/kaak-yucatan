"""Factores para pasar cada satélite a la escala de S-NPP (tareas 3, 4 y 5, docs/02).

Uso: python pipeline/armonizar.py

Calcula los factores NOAA-20→S-NPP (tarea 4) y Aqua→S-NPP y Terra→S-NPP (tarea 3), todos
con factores_por_epoca(), y escribe salidas/factores.csv. La tarea 5 arma la serie.

Qué es un factor: el número por el que se multiplican los cuadritos-día de un satélite para
expresarlos en cuadritos-día de S-NPP (la tabla de periodos de docs/02 dice «× su factor»):

    factor = cuadritos-día de S-NPP / cuadritos-día del otro satélite

Se cuentan los dos en los mismos días y en la misma época del año, y se suman todos los días
antes de dividir (no es el promedio de los cocientes de cada día, que se dispara en los días
con poco fuego).

Reglas:
- NOAA-20, solo días comunes: un día entra si los dos satélites tienen al menos un
  cuadrito-día en la zona. Así se quitan los días en que uno de los dos no mandó datos. Ejemplo real: del
  30 may al 3 jun de 2024 NOAA-20 vio entre 380 y 900 cuadritos por día y S-NPP cero; contar
  esos días bajaría el factor sin que S-NPP vea menos fuego. Costo: también se van los días
  con muy poco fuego en que uno vio algo y el otro nada (en NOAA-20 2018–2026, menos del 1 %
  de los cuadritos-día).
- MODIS, todos los días menos los días hueco: la regla de días comunes no sirve con MODIS.
  En días con poco fuego es normal que VIIRS vea algo y MODIS nada (por eso existe el
  factor); quitar esos días quitaba el 11 % de S-NPP y bajaba el factor de Aqua de 3.64 a
  3.25. Solo se quitan los días en que, en toda la península, un satélite tiene 0 y el
  otro 50 o más (parece que no mandó datos): en 2013–2020 son 14 días de Aqua y 24 de
  Terra.
- MODIS, zonas: las 4 de Yucatán, Campeche y Quintana Roo (analisis/municipios_zona.csv).
  Los focos sin municipio no entran en ninguna zona.
- Épocas: «temporada» es marzo a mayo (mes del día solar local) y «resto» lo demás.
- Margen: se recalcula dejando fuera un año a la vez; el menor y el mayor son factor_min y
  factor_max.
- Débil: si el factor se apoya en menos de 100 cuadritos-día del satélite que se convierte.
  En MODIS, un débil se reemplaza por el de la misma época con todas las zonas juntas.

NOAA-20 (tarea 4): toda la península junta, del 1 abr 2018 (primer día de NOAA-20 en FIRMS)
al 1 nov 2026. El 2 nov no entra: S-NPP dejó de mandar datos ese día a las 13:00 UTC, así
que es un día a medias.

Todo lo que hay en salidas/ lo escribe el código: no se edita a mano.
"""
from __future__ import annotations

from datetime import date
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
SALIDA_FACTORES = RAIZ / "salidas" / "factores.csv"

REFERENCIA = "S-NPP"
SATELITES = {"Terra", "Aqua", "S-NPP", "NOAA-20", "NOAA-21"}

MESES_TEMPORADA = {3, 4, 5}
EPOCAS = ["temporada", "resto"]
MINIMO_CUADRITOS = 100
ZONA_PENINSULA = "Península"

# Periodo en que se comparan NOAA-20 y S-NPP, en día solar local (ambos extremos entran).
PERIODO_NOAA20 = (date(2018, 4, 1), date(2026, 11, 1))
# Lo que se espera del factor NOAA-20 (docs/01: NOAA-20 / S-NPP entre 0.95 y 1.06 por año).
RANGO_ESPERADO_NOAA20 = (0.95, 1.06)

# MODIS (tarea 3): se calibra con 2013–2020, los dos satélites funcionando y antes de la
# deriva de órbita de MODIS (docs/02, «Método»).
MODIS = ["Aqua", "Terra"]
PERIODO_MODIS = (date(2013, 1, 1), date(2020, 12, 31))
ZONAS = ["Yucatán 1", "Yucatán 2", "Yucatán 3", "Yucatán 4", "Campeche", "Quintana Roo"]
# Un día es hueco (un satélite sin datos) si en toda la península uno tiene 0 cuadritos-día
# y el otro al menos esto.
UMBRAL_HUECO = 50

COLUMNAS = ["zona", "epoca", "satelite", "factor", "factor_min", "factor_max",
            "cuadritos_dia_usados", "debil"]
NECESARIAS = {"satelite", "dia_local"}
NECESARIAS_ZONA = NECESARIAS | {"lat_celda", "lon_celda", "zona"}


class FactorError(ValueError):
    """No se puede calcular un factor con lo que se recibió."""


def epoca_de(mes) -> pd.Series:
    """Mes (1 a 12) → «temporada» (marzo a mayo) o «resto»."""
    mes = pd.Series(mes)
    if not mes.between(1, 12).all():
        raise FactorError("hay meses fuera de 1 a 12")
    return mes.isin(MESES_TEMPORADA).map({True: "temporada", False: "resto"})


def dias_comunes(cuadritos: pd.DataFrame, otro: str, desde: date, hasta: date) -> pd.DataFrame:
    """Cuadritos-día por día de S-NPP y del otro satélite, solo en los días en que los dos
    tienen al menos uno.

    Recibe la salida de rejilla.cuadritos_dia_peninsula() (un renglón por cuadrito-día).
    Devuelve: dia_local, anio, epoca, ref (S-NPP) y otro.
    """
    faltan = NECESARIAS - set(cuadritos.columns)
    if faltan:
        raise FactorError(f"faltan columnas: {sorted(faltan)}")
    if otro == REFERENCIA:
        raise FactorError("no se calcula el factor de S-NPP contra sí mismo")
    if otro not in SATELITES:
        raise FactorError(f"satélite desconocido: {otro!r}")
    if desde > hasta:
        raise FactorError(f"periodo al revés: {desde} > {hasta}")

    dia = pd.to_datetime(cuadritos["dia_local"])
    en_periodo = dia.between(pd.Timestamp(desde), pd.Timestamp(hasta))
    de_los_dos = cuadritos["satelite"].isin([REFERENCIA, otro])
    elegidos = cuadritos[en_periodo & de_los_dos].assign(dia_local=dia[en_periodo & de_los_dos])

    por_dia = (
        elegidos.groupby(["dia_local", "satelite"]).size()
        .unstack(fill_value=0)
        .reindex(columns=[REFERENCIA, otro], fill_value=0)
        .rename(columns={REFERENCIA: "ref", otro: "otro"})
    )
    por_dia = por_dia[(por_dia["ref"] > 0) & (por_dia["otro"] > 0)].reset_index()
    por_dia.columns.name = None
    por_dia["anio"] = por_dia["dia_local"].dt.year
    por_dia["epoca"] = epoca_de(por_dia["dia_local"].dt.month).to_numpy()
    return por_dia[["dia_local", "anio", "epoca", "ref", "otro"]]


def _cociente(dias: pd.DataFrame) -> float:
    """S-NPP / el otro. Vacío (NaN) si el otro no vio nada: no hay con qué dividir."""
    otro = dias["otro"].sum()
    return dias["ref"].sum() / otro if otro > 0 else float("nan")


def factores_por_epoca(dias: pd.DataFrame, otro: str, zona: str) -> pd.DataFrame:
    """Un factor por época, con su margen, a partir de dias_comunes().

    Se detiene si una época no tiene días comunes: un factor sin datos no existe, y
    dejarlo vacío en silencio lo convertiría en un hueco en la serie.
    """
    filas = []
    for epoca in EPOCAS:
        d = dias[dias["epoca"] == epoca]
        if d.empty:
            raise FactorError(f"{otro}, {zona}, {epoca}: no hay días con los dos satélites")
        anios = sorted(d["anio"].unique())
        if len(anios) >= 2:
            sin_un_anio = pd.Series([_cociente(d[d["anio"] != a]) for a in anios])
            fmin, fmax = sin_un_anio.min(), sin_un_anio.max()
        else:  # con un solo año no hay con qué medir el margen
            fmin = fmax = float("nan")
        usados = int(d["otro"].sum())
        filas.append({
            "zona": zona, "epoca": epoca, "satelite": otro,
            "factor": _cociente(d), "factor_min": fmin, "factor_max": fmax,
            "cuadritos_dia_usados": usados, "debil": usados < MINIMO_CUADRITOS,
        })
    return pd.DataFrame(filas, columns=COLUMNAS)


def factores_noaa20(cuadritos_peninsula: pd.DataFrame) -> pd.DataFrame:
    """Tarea 4: NOAA-20→S-NPP por época, toda la península."""
    dias = dias_comunes(cuadritos_peninsula, "NOAA-20", *PERIODO_NOAA20)
    return factores_por_epoca(dias, "NOAA-20", ZONA_PENINSULA)


def dias_hueco(cuadritos_peninsula: pd.DataFrame, otro: str, desde: date,
               hasta: date) -> pd.DatetimeIndex:
    """Días en que uno de los dos satélites parece no haber mandado datos.

    Un día es hueco si, en toda la península, un satélite tiene 0 cuadritos-día y el otro
    UMBRAL_HUECO o más. Se mira la península entera y no cada zona porque en una zona es
    normal que VIIRS vea fuego chico y MODIS nada: eso es justo lo que mide el factor.
    """
    faltan = NECESARIAS - set(cuadritos_peninsula.columns)
    if faltan:
        raise FactorError(f"faltan columnas: {sorted(faltan)}")
    dia = pd.to_datetime(cuadritos_peninsula["dia_local"])
    elegidos = cuadritos_peninsula.assign(dia_local=dia)
    elegidos = elegidos[elegidos["satelite"].isin([REFERENCIA, otro])]
    por_dia = (
        elegidos.groupby(["dia_local", "satelite"]).size().unstack(fill_value=0)
        .reindex(index=pd.date_range(desde, hasta, name="dia_local"),
                 columns=[REFERENCIA, otro], fill_value=0)
    )
    ref, otr = por_dia[REFERENCIA], por_dia[otro]
    hueco = ((ref == 0) & (otr >= UMBRAL_HUECO)) | ((otr == 0) & (ref >= UMBRAL_HUECO))
    return por_dia.index[hueco]


def dias_por_zona(cuadritos_zona: pd.DataFrame, otro: str, zona: str | None,
                  huecos: pd.DatetimeIndex,
                  periodo: tuple[date, date] = PERIODO_MODIS) -> pd.DataFrame:
    """Cuadritos-día por día de S-NPP y del otro en una zona (None = todas juntas).

    Recibe la salida de rejilla.cuadritos_dia() (por municipio, con zona). Un cuadrito
    partido por dos municipios de la misma zona cuenta una vez. Entran todos los días de
    `periodo` (ambos extremos) en que alguno de los dos vio fuego, menos los días hueco.
    Por defecto el periodo es el de calibración (PERIODO_MODIS, 2013–2020); la tarea 7 lo
    cambia para revisar los factores en años que no se usaron para calcularlos.
    Devuelve lo mismo que dias_comunes(): dia_local, anio, epoca, ref y otro.

    `huecos` tiene que salir de dias_hueco() con el mismo periodo. Se detiene si algún
    hueco cae fuera del periodo (señal de que se calcularon para otros años). No puede
    detectar que falten: una lista vacía es válida, porque hay periodos sin huecos.
    """
    faltan = NECESARIAS_ZONA - set(cuadritos_zona.columns)
    if faltan:
        raise FactorError(f"faltan columnas: {sorted(faltan)}")
    desconocidas = set(cuadritos_zona["zona"].dropna()) - set(ZONAS)
    if cuadritos_zona["zona"].isna().any() or desconocidas:
        raise FactorError(f"zonas desconocidas o vacías: {sorted(desconocidas)}")
    if zona is not None and zona not in ZONAS:
        raise FactorError(f"zona desconocida: {zona!r}")

    desde, hasta = periodo
    if desde > hasta:
        raise FactorError(f"periodo al revés: {desde} > {hasta}")
    huecos = pd.DatetimeIndex(huecos)
    fuera = huecos[(huecos < pd.Timestamp(desde)) | (huecos > pd.Timestamp(hasta))]
    if len(fuera):
        raise FactorError(
            f"{len(fuera)} días hueco fuera del periodo {desde} a {hasta} (el primero: "
            f"{fuera[0].date()}): calcula los huecos con dias_hueco() del mismo periodo")

    dia = pd.to_datetime(cuadritos_zona["dia_local"])
    elegidos = cuadritos_zona.assign(dia_local=dia)
    elegidos = elegidos[
        dia.between(pd.Timestamp(desde), pd.Timestamp(hasta)).to_numpy()
        & elegidos["satelite"].isin([REFERENCIA, otro]).to_numpy()
        & ~dia.isin(huecos).to_numpy()
    ]
    if zona is not None:
        elegidos = elegidos[elegidos["zona"] == zona]
    elegidos = elegidos.drop_duplicates(["satelite", "dia_local", "lat_celda", "lon_celda"])

    por_dia = (
        elegidos.groupby(["dia_local", "satelite"]).size()
        .unstack(fill_value=0)
        .reindex(columns=[REFERENCIA, otro], fill_value=0)
        .rename(columns={REFERENCIA: "ref", otro: "otro"})
        .reset_index()
    )
    por_dia.columns.name = None
    por_dia["anio"] = por_dia["dia_local"].dt.year
    por_dia["epoca"] = epoca_de(por_dia["dia_local"].dt.month).to_numpy()
    return por_dia[["dia_local", "anio", "epoca", "ref", "otro"]]


def factores_modis(cuadritos_zona: pd.DataFrame, cuadritos_peninsula: pd.DataFrame,
                   otro: str) -> pd.DataFrame:
    """Tarea 3: Aqua o Terra → S-NPP, por zona y época, calibrado en 2013–2020.

    12 filas (6 zonas × 2 épocas). Un factor débil (menos de 100 cuadritos-día del satélite
    MODIS) se reemplaza por el de la misma época con todas las zonas juntas; se queda con
    debil=True y con sus propios cuadritos_dia_usados, para que se vea por qué.
    """
    if otro not in MODIS:
        raise FactorError(f"la tarea 3 es solo para MODIS (Aqua o Terra), no {otro!r}")
    huecos = dias_hueco(cuadritos_peninsula, otro, *PERIODO_MODIS)

    juntas = factores_por_epoca(dias_por_zona(cuadritos_zona, otro, None, huecos),
                                otro, ZONA_PENINSULA).set_index("epoca")
    if juntas["debil"].any():
        raise FactorError(f"{otro}: el factor con todas las zonas juntas es débil; "
                          "no hay con qué reemplazar los débiles")

    filas = []
    for zona in ZONAS:
        f = factores_por_epoca(dias_por_zona(cuadritos_zona, otro, zona, huecos), otro, zona)
        for col in ["factor", "factor_min", "factor_max"]:
            reemplazo = f["epoca"].map(juntas[col]).astype(float)
            f[col] = f[col].astype(float).where(~f["debil"], reemplazo)
        filas.append(f)
    return pd.concat(filas, ignore_index=True)


def guardar_factores(factores: pd.DataFrame, ruta: Path = SALIDA_FACTORES) -> None:
    if list(factores.columns) != COLUMNAS:
        raise FactorError(f"columnas distintas al contrato de docs/02: {list(factores.columns)}")
    if factores["factor"].isna().any():
        raise FactorError("hay factores vacíos")
    if factores.duplicated(["zona", "epoca", "satelite"]).any():
        raise FactorError("hay filas repetidas de zona × época × satélite")
    ruta.parent.mkdir(parents=True, exist_ok=True)
    factores.round({"factor": 4, "factor_min": 4, "factor_max": 4}).to_csv(ruta, index=False)


def main() -> None:
    from cargar import cargar_focos
    from rejilla import cuadritos_dia, cuadritos_dia_peninsula

    focos = cargar_focos()
    peninsula = cuadritos_dia_peninsula(focos)
    por_zona = cuadritos_dia(focos)
    noaa20 = factores_noaa20(peninsula)
    modis = [factores_modis(por_zona, peninsula, s) for s in MODIS]
    factores = pd.concat([noaa20, *modis], ignore_index=True)
    guardar_factores(factores)

    print(factores.to_string(index=False))
    bajo, alto = RANGO_ESPERADO_NOAA20
    fuera = noaa20[(noaa20["factor"] < bajo) | (noaa20["factor"] > alto)]
    if fuera.empty:
        print(f"NOAA-20: todos los factores entre {bajo} y {alto}, como en docs/01.")
    else:
        print(f"AVISO: factores de NOAA-20 fuera de {bajo}–{alto}; el PR debe explicar por qué.")
    for s in MODIS:
        huecos = dias_hueco(peninsula, s, *PERIODO_MODIS)
        print(f"{s}: {len(huecos)} días hueco quitados en {PERIODO_MODIS[0].year}–"
              f"{PERIODO_MODIS[1].year}")
    print(f"Escrito {SALIDA_FACTORES.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
