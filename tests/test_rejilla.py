"""Pruebas de la tarea 2: cargar los focos (pipeline/cargar.py) y contarlos en cuadritos de
1 km por día (pipeline/rejilla.py).

Casi todas usan focos inventados, para que se vea exactamente qué entra y qué sale. Las de
la sección «Con los datos reales» leen datos_peninsula/ y se saltan si no está.
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "pipeline"))
import cargar  # noqa: E402
import rejilla  # noqa: E402


def foco(**cambios) -> dict:
    """Un foco válido de S-NPP en Tekax; cada prueba cambia solo lo que necesita."""
    base = {
        "acq_date": pd.Timestamp("2024-04-10"),
        "acq_time": 1900,
        "latitude": 20.123,
        "longitude": -89.456,
        "satellite": "N",
        "sensor": "S-NPP",
        "producto": "SP",
        "confidence": "n",
        "type": 0.0,
        "municipio": "Tekax",
        "estado": "Yucatán",
    }
    base.update(cambios)
    return base


def terra(**cambios) -> dict:
    """Un foco válido de MODIS Terra en Tekax."""
    return foco(**{"satellite": "Terra", "sensor": "MODIS", "confidence": "80", **cambios})


CATALOGO = pd.DataFrame(
    {
        "municipio": ["Tekax", "Tizimín", "Calakmul"],
        "estado": ["Yucatán", "Yucatán", "Campeche"],
        "zona": ["Yucatán 3", "Yucatán 1", "Campeche"],
        "ventana_inicio": ["03-10", "03-10", None],
        "ventana_fin": ["04-03", "04-03", None],
    }
)


@pytest.fixture
def archivos(tmp_path):
    """Escribe focos inventados en parquet, como los de datos_peninsula/, y los carga."""

    def _escribir(historicos, recientes=None):
        h = tmp_path / "focos_peninsula.parquet"
        r = tmp_path / "focos_recientes.parquet"
        m = tmp_path / "municipios_zona.csv"
        pd.DataFrame(historicos).to_parquet(h)
        if recientes is not None:
            pd.DataFrame(recientes).to_parquet(r)
        CATALOGO.to_csv(m, index=False)
        return cargar.cargar_focos(historicos=h, recientes=r, municipios=m)

    return _escribir


def preparar(*filas) -> pd.DataFrame:
    """Los mismos pasos que cargar_focos(), pero sin archivos."""
    return cargar.preparar_focos(pd.DataFrame(list(filas)), CATALOGO)


def cuadritos_de(*filas) -> pd.DataFrame:
    return rejilla.cuadritos_dia(preparar(*filas))


# ---------------------------------------------------------------------------
# Las tres que pide la tarea 2 (docs/02)


def test_dos_focos_en_el_mismo_cuadrito_y_dia_cuentan_uno():
    # 20.1231 y 20.1249 redondean a 20.12; -89.4561 y -89.4551 a -89.46.
    c = cuadritos_de(
        foco(latitude=20.1231, longitude=-89.4561),
        foco(latitude=20.1249, longitude=-89.4551, acq_time=1905),
    )
    assert len(c) == 1
    assert c["n_focos"].iloc[0] == 2


def test_dos_satelites_distintos_nunca_se_suman():
    # Mismo cuadrito, mismo día: Terra, Aqua, S-NPP y NOAA-20. Cada uno va en su renglón.
    c = cuadritos_de(
        terra(acq_time=1600),
        foco(satellite="Aqua", sensor="MODIS", confidence="80", acq_time=1900),
        foco(satellite="N", sensor="S-NPP"),
        foco(satellite="N20", sensor="NOAA-20", acq_time=1850),
    )
    assert sorted(c["satelite"]) == ["Aqua", "NOAA-20", "S-NPP", "Terra"]
    assert (c["n_focos"] == 1).all()
    assert c[["lat_celda", "lon_celda", "dia_local"]].drop_duplicates().shape[0] == 1


def test_terra_a_las_4_utc_del_2_de_abril_cuenta_el_1_de_abril():
    # 4:00 UTC + (-89.5 / 15) h = 4:00 - 5:58 = 22:02 del 1 de abril, hora solar.
    c = cuadritos_de(terra(acq_date=pd.Timestamp("2024-04-02"), acq_time=400, longitude=-89.5))
    assert c["dia_local"].iloc[0] == pd.Timestamp("2024-04-01")


# ---------------------------------------------------------------------------
# Cuadritos y día local


def test_cuadritos_vecinos_cuentan_aparte():
    c = cuadritos_de(foco(latitude=20.123), foco(latitude=20.133))
    assert len(c) == 2


def test_mismo_cuadrito_en_dias_distintos_cuenta_dos():
    c = cuadritos_de(foco(), foco(acq_date=pd.Timestamp("2024-04-11")))
    assert len(c) == 2


def test_el_cuadrito_se_guarda_redondeado_a_dos_decimales():
    c = cuadritos_de(foco(latitude=20.1251, longitude=-89.4549))
    assert c["lat_celda"].iloc[0] == pytest.approx(20.13)
    assert c["lon_celda"].iloc[0] == pytest.approx(-89.45)


def test_un_foco_de_la_tarde_se_queda_en_su_dia():
    # 19:00 UTC son las 13:02 en Tekax: mismo día.
    c = cuadritos_de(foco(acq_time=1900))
    assert c["dia_local"].iloc[0] == pd.Timestamp("2024-04-10")


def test_acq_time_acepta_hhmm_sin_ceros_a_la_izquierda():
    # 5 = 00:05 UTC del 2 de enero → 18:07 del 1 de enero en Tekax.
    f = preparar(foco(acq_date=pd.Timestamp("2024-01-02"), acq_time=5))
    assert f["dia_local"].iloc[0] == pd.Timestamp("2024-01-01")


def test_acq_time_invalido_detiene_la_carga():
    with pytest.raises(cargar.DatosError, match="acq_time"):
        preparar(foco(acq_time=1275))


def test_anio_mes_y_semana_salen_del_dia_local():
    # 00:30 UTC del 1 de enero de 2025 es la noche del 31 de dic de 2024 en Tekax.
    f = preparar(foco(acq_date=pd.Timestamp("2025-01-01"), acq_time=30))
    assert f["anio"].iloc[0] == 2024
    assert f["mes"].iloc[0] == 12
    assert f["semana"].iloc[0] == 52


@pytest.mark.parametrize(
    "dia, semana", [(1, 1), (7, 1), (8, 2), (358, 52), (364, 52), (365, 52), (366, 52)]
)
def test_semana_de_1_a_52(dia, semana):
    assert cargar.semana_del_anio([dia])[0] == semana


# ---------------------------------------------------------------------------
# Filtro de focos (datos_peninsula/README.md)


def test_filtro_deja_solo_vegetacion():
    f = preparar(foco(type=0.0), foco(type=np.nan, latitude=20.2),
                 foco(type=2.0, latitude=20.3), foco(type=3.0, latitude=20.4))
    assert sorted(f["latitude"]) == [20.123, 20.2]


def test_filtro_de_confianza_viirs():
    f = preparar(foco(confidence="l"), foco(confidence="n", latitude=20.2),
                 foco(confidence="h", latitude=20.3))
    assert sorted(f["confidence"]) == ["h", "n"]


def test_filtro_de_confianza_modis_desde_30():
    f = preparar(terra(confidence="29"), terra(confidence="30", latitude=20.2),
                 terra(confidence="100", latitude=20.3))
    assert sorted(f["confidence"].astype(int)) == [30, 100]


def test_satelite_desconocido_detiene_la_carga():
    with pytest.raises(cargar.DatosError, match="satélite"):
        preparar(foco(satellite="J3"))


def test_nombres_de_satelite_claros():
    f = preparar(terra(), foco(satellite="Aqua", sensor="MODIS", confidence="80"),
                 foco(), foco(satellite="N20", sensor="NOAA-20"),
                 foco(satellite="N21", sensor="NOAA-21"))
    assert sorted(f["satelite"]) == ["Aqua", "NOAA-20", "NOAA-21", "S-NPP", "Terra"]


# ---------------------------------------------------------------------------
# Repetidos, archivos y zona


def test_un_foco_en_sp_y_nrt_se_queda_con_sp():
    f = preparar(foco(producto="NRT", frp=1.0), foco(producto="SP", frp=2.0))
    assert len(f) == 1
    assert f["producto"].iloc[0] == "SP"


def test_mismo_lugar_y_dia_a_otra_hora_no_es_repetido():
    # Dos pasadas distintas del satélite: son dos focos (aunque luego sean un cuadrito-día).
    f = preparar(foco(acq_time=700), foco(acq_time=1900))
    assert len(f) == 2


def test_carga_sin_archivo_de_recientes(archivos):
    f = archivos([foco()])
    assert len(f) == 1


def test_carga_une_historicos_y_recientes_sin_repetir(archivos):
    reciente = foco(acq_date=pd.Timestamp("2026-11-08"), producto="NRT")
    f = archivos([foco(), reciente], recientes=[reciente, foco(latitude=20.5, producto="NRT")])
    assert len(f) == 3


def test_cada_foco_recibe_su_zona():
    f = preparar(foco(), foco(municipio="Calakmul", estado="Campeche", latitude=18.5))
    assert dict(zip(f["municipio"], f["zona"])) == {"Tekax": "Yucatán 3", "Calakmul": "Campeche"}


def test_municipio_fuera_del_catalogo_detiene_la_carga():
    with pytest.raises(cargar.DatosError, match="catálogo"):
        preparar(foco(municipio="Gotham", estado="Yucatán"))


def test_foco_sin_municipio_no_entra_en_lo_municipal_pero_si_en_la_peninsula():
    f = preparar(foco(), foco(municipio=None, latitude=21.9))
    assert len(f) == 2
    assert len(rejilla.cuadritos_dia(f)) == 1
    assert len(rejilla.cuadritos_dia_peninsula(f)) == 2


def test_cuadrito_partido_cuenta_una_vez_por_municipio_y_una_en_la_peninsula():
    # Decisión B: un cuadrito en la frontera de dos municipios cuenta para cada uno,
    # pero en el total de la península cuenta una sola vez.
    f = preparar(foco(latitude=20.1231),
                 foco(latitude=20.1249, municipio="Tizimín", acq_time=1905))
    assert len(rejilla.cuadritos_dia(f)) == 2
    assert len(rejilla.cuadritos_dia_peninsula(f)) == 1


def test_contar_por_satelite_y_anio():
    c = cuadritos_de(foco(), foco(latitude=20.2), terra())
    t = rejilla.contar(c, ["satelite", "anio"])
    assert dict(zip(t["satelite"], t["cuadritos_dia"])) == {"S-NPP": 2, "Terra": 1}


# ---------------------------------------------------------------------------
# Con los datos reales


hay_datos = pytest.mark.skipif(
    not cargar.FOCOS_HISTORICOS.is_file(), reason="falta datos_peninsula/focos_peninsula.parquet"
)


@pytest.fixture(scope="module")
def reales():
    return cargar.cargar_focos()


@hay_datos
def test_reales_todos_los_focos_con_municipio_tienen_zona(reales):
    con_municipio = reales[reales["municipio"].notna()]
    assert con_municipio["zona"].notna().all()


@hay_datos
def test_reales_cinco_satelites(reales):
    assert set(reales["satelite"]) == {"Terra", "Aqua", "S-NPP", "NOAA-20", "NOAA-21"}


@hay_datos
def test_reales_coincide_con_el_calendario_provisional_de_nico(reales):
    """S-NPP por municipio, año y semana debe dar lo mismo que el calendario provisional
    (tarea 1), que se calcula con otro código pero con la misma regla. Se genera aquí: desde
    la tarea 5, salidas/calendario.parquet es la serie armonizada y ya no es solo S-NPP."""
    import calendario_provisional

    snpp = rejilla.cuadritos_dia(reales[reales["satelite"] == "S-NPP"])
    nuestro = rejilla.contar(snpp, ["estado", "municipio", "anio", "semana"])
    nico = calendario_provisional.generar_calendario()
    nico = nico[nico["cuadritos_viirs_crudo"] > 0]
    unido = nuestro.merge(
        nico[["estado", "municipio", "anio", "semana", "cuadritos_viirs_crudo"]],
        on=["estado", "municipio", "anio", "semana"], how="outer",
    )
    distintos = unido[unido["cuadritos_dia"] != unido["cuadritos_viirs_crudo"]]
    assert distintos.empty, distintos.head(10)

    # La comprobación a mano que pide la tarea 1: Tekax en 2024.
    tekax = snpp[(snpp["municipio"] == "Tekax") & (snpp["anio"] == 2024)]
    assert len(tekax) == nico.query("municipio == 'Tekax' and anio == 2024")[
        "cuadritos_viirs_crudo"].sum()
