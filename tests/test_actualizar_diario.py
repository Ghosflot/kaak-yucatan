"""Pruebas de la tarea 18: actualización diaria (pipeline/actualizar_diario.py).

No llaman a FIRMS: la respuesta de la API es texto inventado con las mismas columnas que
devuelve de verdad, y los límites son cuadrados.
"""
import io
import json
import sys
import urllib.error
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import pytest
from shapely.geometry import box

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "pipeline"))
import actualizar_diario as ad  # noqa: E402
import cargar  # noqa: E402

CABECERA_VIIRS = ("latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,"
                  "instrument,confidence,version,bright_ti5,frp,daynight")
CABECERA_MODIS = ("latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,"
                  "instrument,confidence,version,bright_t31,frp,daynight")


def viirs(*filas: str) -> str:
    return "\n".join([CABECERA_VIIRS, *filas]) + "\n"


def fila_viirs(lat=20.1, lon=-89.5, fecha="2026-11-09", hora="0745", sat="N20", conf="n") -> str:
    return f"{lat},{lon},330.1,0.4,0.4,{fecha},{hora},{sat},VIIRS,{conf},2.0NRT,290.2,3.1,N"


# Un estado (Yucatán) de -90 a -88 y dentro un municipio (Tekax) de -90 a -89.
MUNICIPIOS = [("Tekax", "Yucatán", box(-90, 19.5, -89, 21))]
ESTADOS = [("Yucatán", box(-90, 19.5, -88, 21))]


# ---------------------------------------------------------------------------
# Descarga


def test_descarga_lee_el_csv_de_firms():
    df = ad.descargar("VIIRS_NOAA20_NRT", "clave", date(2026, 11, 8), leer=lambda url: viirs(fila_viirs()))
    assert len(df) == 1
    assert df["confidence"].iloc[0] == "n"


def test_descarga_pide_5_dias_de_la_caja_desde_una_fecha():
    # FIRMS acepta de 1 a 5 días por consulta («Invalid day range. Expects [1..5]»).
    pedidas = []
    ad.descargar("MODIS_NRT", "clave", date(2026, 11, 8),
                 leer=lambda url: pedidas.append(url) or CABECERA_MODIS)
    assert pedidas == [f"{ad.BASE}/clave/MODIS_NRT/{ad.CAJA}/5/2026-11-08"]


def test_error_de_firms_dice_el_codigo_y_el_motivo_sin_la_clave():
    def leer(url):
        cuerpo = io.BytesIO(b"Invalid MAP_KEY. Invalid day range. Expects [1..5].")
        raise urllib.error.HTTPError(url, 400, "Bad Request", None, cuerpo)
    with pytest.raises(ad.ActualizacionError) as e:
        ad.descargar("MODIS_NRT", "clave-secreta", date(2026, 11, 8), leer=leer)
    assert "400" in str(e.value)
    assert "Invalid day range" in str(e.value)
    assert "clave-secreta" not in str(e.value)


def test_tramos_cubren_desde_el_ultimo_dia_hasta_hoy():
    # Cada consulta cubre [inicio, inicio + 4]: del 7 al 11 y del 12 al 16.
    assert ad.tramos(date(2026, 11, 7), date(2026, 11, 12)) == [date(2026, 11, 7), date(2026, 11, 12)]
    assert ad.tramos(date(2026, 11, 12), date(2026, 11, 12)) == [date(2026, 11, 12)]


def test_tramos_no_van_mas_atras_del_tope():
    inicios = ad.tramos(date(2026, 1, 1), date(2026, 11, 12))
    assert inicios[0] == date(2026, 11, 12) - timedelta(days=ad.TOPE_DIAS - 1)
    assert inicios[-1] <= date(2026, 11, 12)


def test_respuesta_que_no_es_csv_detiene_todo():
    with pytest.raises(ad.ActualizacionError, match="inesperada"):
        ad.descargar("MODIS_NRT", "clave", date(2026, 11, 8), leer=lambda url: "Invalid MAP_KEY.")


def test_sin_focos_es_una_respuesta_valida():
    assert ad.descargar("MODIS_NRT", "clave", date(2026, 11, 8), leer=lambda url: CABECERA_MODIS + "\n").empty


# ---------------------------------------------------------------------------
# Normalizar y asignar territorio


def normalizado(*filas: str, sensor="NOAA-20") -> pd.DataFrame:
    return ad.normalizar(ad.descargar("x", "clave", date(2026, 11, 8), leer=lambda url: viirs(*filas)), sensor)


def test_quedan_las_columnas_y_tipos_del_historial():
    df = normalizado(fila_viirs())
    assert {c: str(t) for c, t in df.dtypes.items()} == {c: str(pd.Series(dtype=t).dtype) for c, t in ad.TIPOS.items()}


def test_nrt_sin_type_ni_producto_se_completa():
    df = normalizado(fila_viirs())
    assert df["producto"].iloc[0] == "NRT"
    assert df["sensor"].iloc[0] == "NOAA-20"
    assert pd.isna(df["type"].iloc[0])  # vacío cuenta como vegetación


def test_hora_sin_ceros_y_fecha_como_fecha():
    df = normalizado(fila_viirs(hora="45"))
    assert df["acq_time"].iloc[0] == 45
    assert df["acq_date"].iloc[0] == pd.Timestamp("2026-11-09")


def test_focos_fuera_de_la_caja_no_entran():
    assert normalizado(fila_viirs(lat=25.0)).empty


def test_foco_en_municipio_toma_municipio_y_estado():
    df = ad.asignar_territorio(normalizado(fila_viirs(lon=-89.5)), MUNICIPIOS, ESTADOS)
    assert df[["municipio", "estado"]].iloc[0].tolist() == ["Tekax", "Yucatán"]


def test_foco_sin_municipio_toma_el_estado_del_mapa():
    df = ad.asignar_territorio(normalizado(fila_viirs(lon=-88.5)), MUNICIPIOS, ESTADOS)
    assert pd.isna(df["municipio"].iloc[0])
    assert df["estado"].iloc[0] == "Yucatán"


def test_foco_fuera_de_los_estados_no_entra():
    assert ad.asignar_territorio(normalizado(fila_viirs(lon=-87.5)), MUNICIPIOS, ESTADOS).empty


# ---------------------------------------------------------------------------
# Unir sin repetir


def test_no_repite_lo_que_ya_estaba_en_recientes():
    a = normalizado(fila_viirs(hora="0745"))
    b = normalizado(fila_viirs(hora="0745"), fila_viirs(hora="1900"))
    assert len(ad.unir(b, a, ad.vacio())) == 2


def test_no_repite_lo_que_ya_esta_en_el_historial():
    historial = normalizado(fila_viirs(fecha="2026-11-07"))
    nuevos = normalizado(fila_viirs(fecha="2026-11-07"), fila_viirs(fecha="2026-11-08"))
    juntos = ad.unir(nuevos, ad.vacio(), historial)
    assert juntos["acq_date"].tolist() == [pd.Timestamp("2026-11-08")]


def test_el_mismo_lugar_en_dos_satelites_no_es_repetido():
    n20 = normalizado(fila_viirs(sat="N20"), sensor="NOAA-20")
    n21 = normalizado(fila_viirs(sat="N21"), sensor="NOAA-21")
    assert len(ad.unir(n21, n20, ad.vacio())) == 2


def test_datos_hasta_es_el_ultimo_dia_de_todos():
    historial = normalizado(fila_viirs(fecha="2026-11-07"))
    recientes = normalizado(fila_viirs(fecha="2026-11-09"))
    hasta = ad.fechas_hasta(historial, recientes)
    assert hasta == {"datos_hasta": "2026-11-09", "por_sensor": {"NOAA-20": "2026-11-09"}}


# ---------------------------------------------------------------------------
# Todo junto, con archivos


@pytest.fixture
def datos(tmp_path, monkeypatch):
    """datos_peninsula/ y salidas/ inventados en una carpeta temporal."""
    historial = ad.asignar_territorio(normalizado(fila_viirs(fecha="2026-11-07")), MUNICIPIOS, ESTADOS)
    historial.to_parquet(tmp_path / "focos_peninsula.parquet", index=False)
    geo = lambda feats: {"type": "FeatureCollection", "features": feats}  # noqa: E731
    (tmp_path / "municipios.geojson").write_text(json.dumps(geo([
        {"type": "Feature", "properties": {"municipio": m, "estado": e}, "geometry": g.__geo_interface__}
        for m, e, g in MUNICIPIOS
    ])))
    (tmp_path / "estados.geojson").write_text(json.dumps(geo([
        {"type": "Feature", "properties": {"estado": e}, "geometry": g.__geo_interface__} for e, g in ESTADOS
    ])))
    monkeypatch.setattr(ad, "HISTORICOS", tmp_path / "focos_peninsula.parquet")
    monkeypatch.setattr(ad, "RECIENTES", tmp_path / "focos_recientes.parquet")
    monkeypatch.setattr(ad, "MUNICIPIOS", tmp_path / "municipios.geojson")
    monkeypatch.setattr(ad, "ESTADOS", tmp_path / "estados.geojson")
    monkeypatch.setattr(ad, "ACTUALIZACION", tmp_path / "salidas" / "actualizacion.json")
    monkeypatch.setattr(ad, "leer_limites", lambda: (MUNICIPIOS, ESTADOS))
    return tmp_path


def api(dias: dict[str, list[str]], pedidas: list | None = None):
    """Una API falsa: para cada fuente, las filas que devuelve. Anota en `pedidas` lo pedido."""
    def leer(url: str) -> str:
        *_, fuente, _caja, _dias, inicio = url.split("/")
        if pedidas is not None:
            pedidas.append((fuente, inicio))
        if fuente == "MODIS_NRT":
            return CABECERA_MODIS + "\n"
        return viirs(*dias.get(fuente, []))
    return leer


def test_dos_dias_seguidos_acumulan_sin_repetir(datos):
    ad.actualizar("clave", leer=api({"VIIRS_NOAA20_NRT": [fila_viirs(fecha="2026-11-07"), fila_viirs(fecha="2026-11-08")]}),
                  hoy=date(2026, 11, 8))
    resumen = ad.actualizar("clave", leer=api({"VIIRS_NOAA20_NRT": [fila_viirs(fecha="2026-11-08"), fila_viirs(fecha="2026-11-09")]}),
                            hoy=date(2026, 11, 9))
    recientes = pd.read_parquet(datos / "focos_recientes.parquet")
    assert recientes["acq_date"].dt.strftime("%Y-%m-%d").tolist() == ["2026-11-08", "2026-11-09"]
    assert resumen["focos_agregados_hoy"] == 1
    escrito = json.loads((datos / "salidas" / "actualizacion.json").read_text())
    assert escrito["datos_hasta"] == "2026-11-09"


def test_cargar_focos_acepta_los_recientes(datos):
    ad.actualizar("clave", leer=api({"VIIRS_NOAA21_NRT": [fila_viirs(sat="N21", fecha="2026-11-09")]}),
                  hoy=date(2026, 11, 9))
    catalogo = datos / "municipios_zona.csv"
    pd.DataFrame({"municipio": ["Tekax"], "estado": ["Yucatán"], "zona": ["Yucatán 3"],
                  "ventana_inicio": ["03-10"], "ventana_fin": ["04-03"]}).to_csv(catalogo, index=False)
    focos = cargar.cargar_focos(datos / "focos_peninsula.parquet", datos / "focos_recientes.parquet", catalogo)
    assert sorted(focos["satelite"]) == ["NOAA-20", "NOAA-21"]


def test_cada_satelite_se_pide_desde_su_ultimo_dia(datos):
    # El historial inventado tiene NOAA-20 hasta el 7 nov; los otros dos no tienen nada.
    pedidas = []
    ad.actualizar("clave", leer=api({}, pedidas), hoy=date(2026, 11, 12))
    assert ("VIIRS_NOAA20_NRT", "2026-11-07") in pedidas
    assert ("VIIRS_NOAA20_NRT", "2026-11-12") in pedidas
    assert ("VIIRS_NOAA21_NRT", "2026-11-08") in pedidas  # sin datos: los últimos 5 días
    assert all(inicio <= "2026-11-12" for _, inicio in pedidas)


def test_lo_ya_bajado_adelanta_el_inicio(datos):
    ad.actualizar("clave", leer=api({"VIIRS_NOAA20_NRT": [fila_viirs(fecha="2026-11-10")]}), hoy=date(2026, 11, 10))
    pedidas = []
    ad.actualizar("clave", leer=api({}, pedidas), hoy=date(2026, 11, 12))
    assert [i for f, i in pedidas if f == "VIIRS_NOAA20_NRT"] == ["2026-11-10"]
