"""Pruebas de los factores de armonización (pipeline/armonizar.py), tarea 4: NOAA-20→S-NPP.

Casi todas usan cuadritos-día inventados, con números redondos para que el resultado se
pueda comprobar a mano. Están en tres grupos:
- «Lo que debe salir bien»: el cálculo da lo que debe dar.
- «Lo que debe fallar»: con datos equivocados, el código se detiene con error en lugar de
  dar un número.
- «Con los datos reales»: leen datos_peninsula/ y se saltan si no está.
"""
import sys
from datetime import date
from pathlib import Path

import pandas as pd
import pytest

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "pipeline"))
import armonizar  # noqa: E402
import cargar  # noqa: E402
import rejilla  # noqa: E402

PERIODO = (date(2018, 4, 1), date(2026, 11, 1))


def cuadritos(satelite: str, dia: str, n: int) -> list[dict]:
    """n cuadritos-día distintos de un satélite en un día (como sale de rejilla)."""
    dia = pd.Timestamp(dia)
    return [
        {"satelite": satelite, "dia_local": dia, "anio": dia.year, "mes": dia.month,
         "lat_celda": 20 + i / 100, "lon_celda": -89.0, "n_focos": 1}
        for i in range(n)
    ]


def tabla(*grupos) -> pd.DataFrame:
    """(satélite, día, cuántos) → tabla de cuadritos-día."""
    return pd.DataFrame([fila for g in grupos for fila in cuadritos(*g)])


def factores(*grupos, otro="NOAA-20", periodo=PERIODO) -> pd.DataFrame:
    dias = armonizar.dias_comunes(tabla(*grupos), otro, *periodo)
    return armonizar.factores_por_epoca(dias, otro, "Península").set_index("epoca")


# Un día de cada época con fuego de los dos, para que ninguna época quede vacía.
BASE_RESTO = [("S-NPP", "2019-08-10", 10), ("NOAA-20", "2019-08-10", 10)]
BASE_TEMPORADA = [("S-NPP", "2019-04-10", 10), ("NOAA-20", "2019-04-10", 10)]


# ---------------------------------------------------------------------------
# Lo que debe salir bien


def test_factor_es_snpp_entre_noaa20():
    f = factores(("S-NPP", "2019-04-10", 110), ("NOAA-20", "2019-04-10", 100), *BASE_RESTO)
    assert f.loc["temporada", "factor"] == pytest.approx(1.1)


def test_la_direccion_es_la_que_se_multiplica():
    # Si S-NPP ve el doble, NOAA-20 × factor debe dar lo de S-NPP: factor 2, no 0.5.
    f = factores(("S-NPP", "2019-04-10", 200), ("NOAA-20", "2019-04-10", 100), *BASE_RESTO)
    assert 100 * f.loc["temporada", "factor"] == pytest.approx(200)


def test_suma_los_dias_antes_de_dividir():
    # Día 1: 10/1; día 2: 90/99. Suma: 100/100 = 1. El promedio de cocientes daría ≈5.5.
    f = factores(
        ("S-NPP", "2019-04-10", 10), ("NOAA-20", "2019-04-10", 1),
        ("S-NPP", "2019-04-11", 90), ("NOAA-20", "2019-04-11", 99),
        *BASE_RESTO,
    )
    assert f.loc["temporada", "factor"] == pytest.approx(1.0)


def test_un_dia_sin_snpp_no_entra():
    # El 31 may 2024 NOAA-20 vio 900 y S-NPP nada (S-NPP no mandó datos): no cuenta.
    f = factores(
        ("S-NPP", "2019-04-10", 50), ("NOAA-20", "2019-04-10", 50),
        ("NOAA-20", "2024-05-31", 900),
        *BASE_RESTO,
    )
    assert f.loc["temporada", "factor"] == pytest.approx(1.0)
    assert f.loc["temporada", "cuadritos_dia_usados"] == 50


def test_un_dia_sin_noaa20_no_entra():
    f = factores(
        ("S-NPP", "2019-04-10", 50), ("NOAA-20", "2019-04-10", 50),
        ("S-NPP", "2019-04-12", 300),
        *BASE_RESTO,
    )
    assert f.loc["temporada", "factor"] == pytest.approx(1.0)


def test_marzo_y_mayo_son_temporada_febrero_y_junio_no():
    dias = armonizar.dias_comunes(
        tabla(*[(s, d, 1) for d in ("2019-02-28", "2019-03-01", "2019-05-31", "2019-06-01")
                for s in ("S-NPP", "NOAA-20")]),
        "NOAA-20", *PERIODO,
    )
    epocas = dict(zip(dias["dia_local"].dt.strftime("%m-%d"), dias["epoca"]))
    assert epocas == {"02-28": "resto", "03-01": "temporada", "05-31": "temporada",
                      "06-01": "resto"}


def test_las_epocas_no_se_mezclan():
    f = factores(
        ("S-NPP", "2019-04-10", 120), ("NOAA-20", "2019-04-10", 100),
        ("S-NPP", "2019-08-10", 80), ("NOAA-20", "2019-08-10", 100),
    )
    assert f.loc["temporada", "factor"] == pytest.approx(1.2)
    assert f.loc["resto", "factor"] == pytest.approx(0.8)


def test_solo_entra_el_periodo_y_sus_extremos():
    f = factores(
        ("S-NPP", "2018-03-31", 999), ("NOAA-20", "2018-03-31", 1),  # antes: no
        ("S-NPP", "2018-04-01", 10), ("NOAA-20", "2018-04-01", 10),  # primer día: sí
        ("S-NPP", "2026-11-01", 10), ("NOAA-20", "2026-11-01", 10),  # último día: sí
        ("S-NPP", "2026-11-02", 1), ("NOAA-20", "2026-11-02", 999),  # día a medias: no
    )
    assert f.loc["temporada", "factor"] == pytest.approx(1.0)
    assert f.loc["temporada", "cuadritos_dia_usados"] == 10
    assert f.loc["resto", "factor"] == pytest.approx(1.0)
    assert f.loc["resto", "cuadritos_dia_usados"] == 10


def test_otros_satelites_no_se_cuelan():
    f = factores(
        ("S-NPP", "2019-04-10", 100), ("NOAA-20", "2019-04-10", 100),
        ("NOAA-21", "2019-04-10", 500), ("Aqua", "2019-04-10", 30),
        *BASE_RESTO,
    )
    assert f.loc["temporada", "factor"] == pytest.approx(1.0)


def test_un_satelite_solo_no_es_dia_comun_aunque_haya_otro():
    # S-NPP y NOAA-21 ese día, NOAA-20 no: no es día común para NOAA-20.
    f = factores(
        ("S-NPP", "2019-04-10", 100), ("NOAA-20", "2019-04-10", 100),
        ("S-NPP", "2023-04-10", 400), ("NOAA-21", "2023-04-10", 400),
        *BASE_RESTO,
    )
    assert f.loc["temporada", "factor"] == pytest.approx(1.0)


def test_margen_quitando_un_anio_a_la_vez():
    # 2019: 100/100, 2020: 150/100, 2021: 100/200. Total 350/400 = 0.875.
    # Sin 2019: 250/300 = 0.8333; sin 2020: 200/300 = 0.6667; sin 2021: 250/200 = 1.25.
    f = factores(
        ("S-NPP", "2019-04-10", 100), ("NOAA-20", "2019-04-10", 100),
        ("S-NPP", "2020-04-10", 150), ("NOAA-20", "2020-04-10", 100),
        ("S-NPP", "2021-04-10", 100), ("NOAA-20", "2021-04-10", 200),
        *BASE_RESTO,
    )
    t = f.loc["temporada"]
    assert t["factor"] == pytest.approx(0.875)
    assert t["factor_min"] == pytest.approx(200 / 300)
    assert t["factor_max"] == pytest.approx(1.25)
    assert t["factor_min"] <= t["factor"] <= t["factor_max"]


def test_con_un_solo_anio_no_hay_margen():
    f = factores(*BASE_TEMPORADA, *BASE_RESTO)
    assert pd.isna(f.loc["temporada", "factor_min"])
    assert pd.isna(f.loc["temporada", "factor_max"])


def test_debil_con_menos_de_100_cuadritos_dia():
    f = factores(("S-NPP", "2019-04-10", 99), ("NOAA-20", "2019-04-10", 99),
                 ("S-NPP", "2019-08-10", 100), ("NOAA-20", "2019-08-10", 100))
    assert f.loc["temporada", "debil"]
    assert not f.loc["resto", "debil"]


def test_cuenta_cuadritos_no_focos():
    t = tabla(("S-NPP", "2019-04-10", 10), ("NOAA-20", "2019-04-10", 10), *BASE_RESTO)
    t.loc[t["satelite"] == "NOAA-20", "n_focos"] = 50  # muchos focos, mismos cuadritos
    dias = armonizar.dias_comunes(t, "NOAA-20", *PERIODO)
    f = armonizar.factores_por_epoca(dias, "NOAA-20", "Península").set_index("epoca")
    assert f.loc["temporada", "factor"] == pytest.approx(1.0)


def test_csv_con_las_columnas_del_contrato(tmp_path):
    f = factores(*BASE_TEMPORADA, *BASE_RESTO).reset_index()[armonizar.COLUMNAS]
    ruta = tmp_path / "factores.csv"
    armonizar.guardar_factores(f, ruta)
    leido = pd.read_csv(ruta)
    assert list(leido.columns) == ["zona", "epoca", "satelite", "factor", "factor_min",
                                   "factor_max", "cuadritos_dia_usados", "debil"]
    assert len(leido) == 2


def test_conteo_por_dia_pone_cero_en_los_dias_sin_nada():
    """La tabla día × satélite que usan dias_hueco() y la serie (días sin datos)."""
    t = tabla(("S-NPP", "2024-05-30", 3), ("NOAA-20", "2024-06-01", 2), ("Aqua", "2024-05-31", 7))
    conteo = armonizar.conteo_por_dia(t, ["S-NPP", "NOAA-20"], date(2024, 5, 30), date(2024, 6, 1))
    assert list(conteo.columns) == ["S-NPP", "NOAA-20"]
    assert list(conteo.index) == list(pd.date_range("2024-05-30", "2024-06-01"))
    assert conteo.to_numpy().tolist() == [[3, 0], [0, 0], [0, 2]]


# ---------------------------------------------------------------------------
# Lo que debe fallar


def test_falla_si_una_epoca_no_tiene_dias_comunes():
    with pytest.raises(armonizar.FactorError, match="resto"):
        factores(*BASE_TEMPORADA)


def test_falla_si_snpp_nunca_coincide():
    with pytest.raises(armonizar.FactorError):
        factores(("NOAA-20", "2019-04-10", 100), ("NOAA-20", "2019-08-10", 100))


def test_falla_si_se_pide_snpp_contra_si_mismo():
    with pytest.raises(armonizar.FactorError, match="sí mismo"):
        factores(*BASE_TEMPORADA, *BASE_RESTO, otro="S-NPP")


def test_falla_con_un_satelite_desconocido():
    with pytest.raises(armonizar.FactorError, match="desconocido"):
        factores(*BASE_TEMPORADA, *BASE_RESTO, otro="N20")  # el nombre de FIRMS, no el nuestro


def test_falla_con_el_periodo_al_reves():
    with pytest.raises(armonizar.FactorError, match="al revés"):
        factores(*BASE_TEMPORADA, *BASE_RESTO, periodo=(date(2026, 11, 1), date(2018, 4, 1)))


def test_falla_si_le_pasan_focos_y_no_cuadritos():
    # Los focos traen `satellite` (FIRMS), no `satelite`: es la tabla equivocada.
    focos = pd.DataFrame({"satellite": ["N"], "acq_date": [pd.Timestamp("2019-04-10")]})
    with pytest.raises(armonizar.FactorError, match="faltan columnas"):
        armonizar.dias_comunes(focos, "NOAA-20", *PERIODO)


def test_falla_con_un_mes_invalido():
    with pytest.raises(armonizar.FactorError):
        armonizar.epoca_de([3, 13])


def test_no_guarda_columnas_distintas_al_contrato(tmp_path):
    f = factores(*BASE_TEMPORADA, *BASE_RESTO).reset_index()
    with pytest.raises(armonizar.FactorError, match="contrato"):
        armonizar.guardar_factores(f.drop(columns="debil"), tmp_path / "f.csv")


def test_no_guarda_factores_vacios(tmp_path):
    f = factores(*BASE_TEMPORADA, *BASE_RESTO).reset_index()[armonizar.COLUMNAS]
    f.loc[0, "factor"] = float("nan")
    with pytest.raises(armonizar.FactorError, match="vacíos"):
        armonizar.guardar_factores(f, tmp_path / "f.csv")
    assert not (tmp_path / "f.csv").exists()


# ---------------------------------------------------------------------------
# Con los datos reales


hay_datos = pytest.mark.skipif(
    not cargar.FOCOS_HISTORICOS.is_file(), reason="falta datos_peninsula/focos_peninsula.parquet"
)


@pytest.fixture(scope="module")
def reales():
    return armonizar.factores_noaa20(rejilla.cuadritos_dia_peninsula(cargar.cargar_focos()))


@hay_datos
def test_reales_dos_filas_de_noaa20(reales):
    assert list(reales["epoca"]) == ["temporada", "resto"]
    assert set(reales["satelite"]) == {"NOAA-20"}
    assert not reales["debil"].any()


@hay_datos
def test_reales_dentro_del_rango_de_docs01(reales):
    bajo, alto = armonizar.RANGO_ESPERADO_NOAA20
    assert reales["factor"].between(bajo, alto).all(), reales.to_string()


@hay_datos
def test_reales_el_factor_queda_dentro_de_su_margen(reales):
    assert (reales["factor_min"] <= reales["factor"]).all()
    assert (reales["factor"] <= reales["factor_max"]).all()
