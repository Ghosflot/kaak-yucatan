"""Pruebas del calendario provisional (pipeline/calendario_provisional.py, tarea 1)."""
import sys
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
import calendario_provisional as cp  # noqa: E402


def foco(**cambios) -> dict:
    """Un foco S-NPP válido en Tekax; cada prueba cambia lo que necesita."""
    base = {
        "acq_date": pd.Timestamp("2024-04-10"),
        "acq_time": 1900,
        "latitude": 20.123,
        "longitude": -89.456,
        "sensor": "S-NPP",
        "confidence": "n",
        "type": 0.0,
        "municipio": "Tekax",
        "estado": "Yucatán",
    }
    base.update(cambios)
    return base


def focos(*filas) -> pd.DataFrame:
    return pd.DataFrame(list(filas))


def cuadritos_de(*filas) -> pd.DataFrame:
    return cp.crear_cuadritos_dia(cp.calcular_dia_solar(cp.filtrar_snpp(focos(*filas))))


CATALOGO = pd.DataFrame(
    {
        "municipio": ["Tekax", "Calakmul"],
        "estado": ["Yucatán", "Campeche"],
        "zona": ["Yucatán 3", "Campeche"],
        "ventana_inicio": ["03-10", np.nan],
        "ventana_fin": ["04-03", np.nan],
    }
)


# ---------------------------------------------------------------------------
# Unitarias


def test_u1_dos_focos_en_el_mismo_cuadrito_y_dia_cuentan_uno():
    c = cuadritos_de(foco(latitude=20.1231, longitude=-89.4561),
                     foco(latitude=20.1249, longitude=-89.4551, acq_time=1905))
    assert len(c) == 1


def test_u2_cuadritos_distintos_cuentan_dos():
    c = cuadritos_de(foco(latitude=20.12), foco(latitude=20.13))
    assert len(c) == 2


def test_mismo_cuadrito_en_dias_distintos_cuenta_dos():
    c = cuadritos_de(foco(), foco(acq_date=pd.Timestamp("2024-04-11")))
    assert len(c) == 2


def test_u3_dia_solar_del_paso_nocturno():
    df = cp.calcular_dia_solar(focos(foco(acq_date=pd.Timestamp("2024-04-02"),
                                          acq_time=400, longitude=-90.0)))
    assert df["dia_local"].iloc[0] == pd.Timestamp("2024-04-01")
    assert df["dia_del_anio"].iloc[0] == 92  # 2024 es bisiesto


def test_u3_paso_de_la_tarde_no_cambia_de_dia():
    df = cp.calcular_dia_solar(focos(foco(acq_date=pd.Timestamp("2024-04-02"),
                                          acq_time=1900, longitude=-90.0)))
    assert df["dia_local"].iloc[0] == pd.Timestamp("2024-04-02")


@pytest.mark.parametrize(
    "hhmm, minutos",
    [(5, 5), (45, 45), (430, 270), (1330, 810), ("0430", 270), (0, 0), (2359, 1439)],
)
def test_u4_hora_hhmm_con_ceros(hhmm, minutos):
    td = cp.hora_utc(pd.Series([hhmm], dtype=object))
    assert td.iloc[0] == pd.Timedelta(minutes=minutos)


@pytest.mark.parametrize("malo", [2400, 1260, -5, "12:30", "abc", 12345])
def test_u4_hora_invalida_detiene(malo):
    with pytest.raises(cp.CalendarioError, match="acq_time"):
        cp.hora_utc(pd.Series([malo], dtype=object))


def test_u5_solo_confianza_nominal_y_alta():
    df = cp.filtrar_snpp(focos(foco(confidence="n"), foco(confidence="h"),
                               foco(confidence="l")))
    assert sorted(df["confidence"]) == ["h", "n"]


def test_u6_solo_vegetacion():
    # El `type` 2 va en otro cuadrito: en el mismo quitaría los vacíos (la prueba siguiente).
    df = cp.filtrar_snpp(focos(foco(type=0.0), foco(type=np.nan), foco(type=2.0, latitude=20.5),
                               foco(type=3.0), foco(type="0"), foco(type="")))
    assert len(df) == 4


def test_sin_type_en_un_cuadrito_de_fuente_fija_no_entra():
    """La misma regla que pipeline/cargar.py: un foco sin `type` (NRT) donde alguna vez hubo
    un `type` 2, de cualquier satélite, es la fuente fija sin marca."""
    df = cp.filtrar_snpp(focos(foco(type=2.0, sensor="NOAA-20"), foco(type=np.nan), foco(type=""),
                               foco(type=0.0), foco(type=np.nan, latitude=20.5)))
    assert sorted(df["latitude"]) == [20.123, 20.5]


def test_solo_s_npp_y_con_municipio():
    df = cp.filtrar_snpp(focos(foco(), foco(sensor="NOAA-20"), foco(sensor="MODIS"),
                               foco(municipio=None), foco(municipio="")))
    assert len(df) == 1


def test_sin_s_npp_detiene():
    with pytest.raises(cp.CalendarioError, match="S-NPP"):
        cp.filtrar_snpp(focos(foco(sensor="NOAA-20")))


def test_coordenada_invalida_detiene():
    with pytest.raises(cp.CalendarioError, match="coordenadas"):
        cp.filtrar_snpp(focos(foco(latitude="abc")))


@pytest.mark.parametrize("anio", [2023, 2024])
def test_u7_31_de_diciembre_es_semana_52(anio):
    df = cp.calcular_dia_solar(focos(foco(acq_date=pd.Timestamp(f"{anio}-12-31"),
                                          acq_time=1900)))
    assert cp.semana_del_anio(df["dia_del_anio"])[0] == 52


def test_nunca_hay_semana_53():
    semanas = cp.semana_del_anio(np.arange(1, 367))
    assert semanas.min() == 1 and semanas.max() == 52
    assert list(cp.semana_del_anio([1, 7, 8, 14, 15, 357, 358, 364, 365, 366])) == [
        1, 1, 2, 2, 3, 51, 52, 52, 52, 52]


def test_limites_de_semana():
    assert cp.limites_semana(2024, 1) == (date(2024, 1, 1), date(2024, 1, 7))
    assert cp.limites_semana(2024, 52) == (date(2024, 12, 23), date(2024, 12, 31))
    assert cp.limites_semana(2023, 52) == (date(2023, 12, 24), date(2023, 12, 31))


def test_u8_acumulado():
    cal = pd.DataFrame({"estado": "Yucatán", "municipio": "Tekax", "anio": 2024,
                        "semana": [3, 1, 2], "cuadritos_viirs_eq": [3.0, 2.0, 0.0]})
    assert cp.agregar_acumulados(cal)["acum"].tolist() == [2.0, 2.0, 5.0]


@pytest.mark.parametrize(
    "semana, esperado",
    [
        (9, False),   # 26 feb – 3 mar 2024: toda antes de la ventana (10 mar – 3 abr)
        (10, True),   # 4 – 10 mar: cruza el inicio
        (12, True),   # 18 – 24 mar: toda dentro
        (14, True),   # 1 – 7 abr: cruza el fin
        (15, False),  # 8 – 14 abr: toda después
    ],
)
def test_u9_ventana(semana, esperado):
    cal = CATALOGO.iloc[[0]].assign(anio=2024, semana=semana)
    assert bool(cp.agregar_ventana(cal)["en_ventana"].iloc[0]) is esperado


def test_u9_sin_ventana_queda_vacio():
    cal = CATALOGO.iloc[[1]].assign(anio=2024, semana=12)
    assert cp.agregar_ventana(cal)["en_ventana"].isna().all()


def test_u10_municipio_desconocido_detiene():
    semanal = cp.agregar_semanas(cuadritos_de(foco(municipio="Tekaks")))
    cobertura = cp.semanas_cubiertas(date(2024, 1, 1), date(2024, 12, 31))
    with pytest.raises(cp.CalendarioError, match="Tekaks"):
        cp.completar_semanas(semanal, CATALOGO, cobertura)


def test_catalogo_repetido_detiene():
    with pytest.raises(cp.CalendarioError, match="repite"):
        cp.validar_catalogo(pd.concat([CATALOGO, CATALOGO.iloc[[0]]]))


def test_semanas_cubiertas_solo_dentro_de_la_cobertura():
    cob = cp.semanas_cubiertas(date(2012, 1, 20), date(2026, 11, 2))
    assert cob[cob["anio"] == 2012]["semana"].min() == 3   # 20 ene = día 20, semana 3
    assert cob[cob["anio"] == 2026]["semana"].max() == 44  # 2 nov = día 306, semana 44
    assert len(cob[cob["anio"] == 2013]) == 52


def test_semanas_parciales_de_la_cobertura_de_s_npp():
    parciales = cp.semanas_parciales()
    assert parciales.to_dict("records") == [
        {"anio": 2012, "semana": 3, "dias_semana": 7, "dias_observados": 2},
        {"anio": 2026, "semana": 44, "dias_semana": 7, "dias_observados": 5},
    ]


def test_semana_52_larga_no_es_parcial():
    parciales = cp.semanas_parciales(date(2024, 1, 1), date(2024, 12, 31))
    assert parciales.empty


def test_cobertura_es_el_periodo_fijo_no_las_detecciones():
    # Sin fuego en todo un periodo, sus semanas se emiten igual (con cero).
    cob = cp.semanas_cubiertas(*cp.COBERTURA)
    assert cp.COBERTURA == (date(2012, 1, 20), date(2026, 11, 2))
    assert len(cob) == 50 + 13 * 52 + 44


@pytest.mark.parametrize("dia", ["2012-01-19", "2026-11-03"])
def test_cuadrito_fuera_de_la_cobertura_detiene(dia):
    c = cuadritos_de(foco(acq_date=pd.Timestamp(dia)))
    with pytest.raises(cp.CalendarioError, match="fuera de la cobertura"):
        cp.validar_cobertura(c, *cp.COBERTURA)


def test_cuadrito_en_los_bordes_de_la_cobertura_pasa():
    c = cuadritos_de(foco(acq_date=pd.Timestamp("2012-01-20")),
                     foco(acq_date=pd.Timestamp("2026-11-02")))
    cp.validar_cobertura(c, *cp.COBERTURA)


def test_completar_rellena_con_cero_y_conserva_municipios_sin_fuego():
    semanal = cp.agregar_semanas(cuadritos_de(foco(), foco(latitude=20.5)))
    cobertura = cp.semanas_cubiertas(date(2024, 1, 1), date(2024, 12, 31))
    cal = cp.completar_semanas(semanal, CATALOGO, cobertura)
    assert len(cal) == 2 * 52
    assert cal["cuadritos_viirs_crudo"].sum() == 2
    assert cal.loc[cal["municipio"] == "Calakmul", "cuadritos_viirs_crudo"].eq(0).all()


def test_percentiles_sobre_los_anios_base():
    anios = list(range(2013, 2026))
    cal = pd.DataFrame({"estado": "Yucatán", "municipio": "Tekax", "semana": 1,
                        "anio": anios + [2026],
                        "cuadritos_viirs_eq": [float(i) for i in range(13)] + [1000.0]})
    cal["acum"] = cal["cuadritos_viirs_eq"] * 2
    out = cp.agregar_percentiles(cal)
    # 2026 no entra al baseline, pero recibe los mismos percentiles.
    assert out["p50"].nunique() == 1 and out["p50"].iloc[0] == 6.0
    assert out["p10"].iloc[0] == pytest.approx(1.2)
    assert out["p90"].iloc[0] == pytest.approx(10.8)
    assert out["acum_p50"].iloc[0] == 12.0


def test_percentiles_sin_anios_completos_detiene():
    cal = pd.DataFrame({"estado": "Yucatán", "municipio": "Tekax", "semana": 1,
                        "anio": [2013, 2014], "cuadritos_viirs_eq": [1.0, 2.0],
                        "acum": [1.0, 2.0]})
    with pytest.raises(cp.CalendarioError, match="baseline"):
        cp.agregar_percentiles(cal)


# ---------------------------------------------------------------------------
# Contrato e integración con los datos reales


@pytest.fixture(scope="module")
def generado(tmp_path_factory):
    resumen: dict = {}
    cal = cp.generar_calendario(resumen=resumen)
    ruta = tmp_path_factory.mktemp("salidas") / "calendario.parquet"
    cp.escribir(cal, ruta)
    return cal, pd.read_parquet(ruta), resumen, ruta


def test_columnas_y_tipos_del_contrato(generado):
    _, leido, _, _ = generado
    assert list(leido.columns) == list(cp.CONTRATO)
    assert {c: str(t) for c, t in leido.dtypes.items()} == cp.CONTRATO


def test_parquet_releido_cumple_el_contrato(generado):
    cal, leido, _, _ = generado
    cp.validar_calendario(leido, anios=list(range(2012, 2027)))
    pd.testing.assert_frame_equal(cal, leido)


def test_grano_y_cobertura(generado):
    cal, _, resumen, _ = generado
    assert not cal.duplicated(cp.CLAVE).any()
    assert cal["semana"].between(1, 52).all()
    assert sorted(cal["anio"].unique()) == list(range(2012, 2027))
    assert cal["municipio"].nunique() == 127
    assert resumen["cobertura"] == cp.COBERTURA
    ini, fin = resumen["detecciones"]
    assert cp.COBERTURA[0] <= ini <= fin <= cp.COBERTURA[1]
    assert len(resumen["semanas_parciales"]) == 2
    por_anio = cal.groupby("anio")["semana"].agg(["min", "max", "nunique"])
    assert tuple(por_anio.loc[2012]) == (3, 52, 50)
    assert tuple(por_anio.loc[2026]) == (1, 44, 44)
    assert (por_anio.loc[2013:2025, "nunique"] == 52).all()
    filas_mun = cal.groupby(["estado", "municipio"]).size()
    assert (filas_mun == 50 + 13 * 52 + 44).all()


def test_conteos_s_npp_sin_modis(generado):
    cal, _, resumen, _ = generado
    assert (cal["cuadritos_viirs_crudo"] >= 0).all()
    assert (cal["cuadritos_viirs_eq"] == cal["cuadritos_viirs_crudo"]).all()
    assert cal["cuadritos_modis_crudo"].isna().all()
    assert cal["cuadritos_viirs_crudo"].sum() == resumen["cuadritos_dia"]


def test_acumulado_monotono_y_total_anual(generado):
    cal, _, _, _ = generado
    g = cal.groupby(["estado", "municipio", "anio"])
    assert (g["acum"].diff().fillna(0) >= 0).all()
    assert np.allclose(g["acum"].last(), g["cuadritos_viirs_eq"].sum())


def test_ventana_y_zona(generado):
    cal, _, _, _ = generado
    assert cal["zona"].notna().all()
    yuc = cal["estado"] == "Yucatán"
    assert cal.loc[yuc, "en_ventana"].notna().all()
    assert cal.loc[~yuc, "en_ventana"].isna().all()
    tekax = cal[(cal["municipio"] == "Tekax") & (cal["anio"] == 2024) & cal["en_ventana"]]
    assert tekax["semana"].tolist() == [10, 11, 12, 13, 14]


def test_percentiles_iguales_entre_anios(generado):
    cal, _, _, _ = generado
    cols = ["p10", "p50", "p90", "acum_p10", "acum_p50", "acum_p90"]
    distintos = cal.groupby(["estado", "municipio", "semana"])[cols].nunique()
    assert (distintos == 1).all().all()


def test_salida_determinista(generado, tmp_path):
    _, leido, _, ruta = generado
    otra = tmp_path / "calendario.parquet"
    cp.escribir(cp.generar_calendario(), otra)
    pd.testing.assert_frame_equal(leido, pd.read_parquet(otra))


def test_escribir_no_deja_temporales_y_crea_el_directorio(tmp_path):
    ruta = tmp_path / "nuevo" / "calendario.parquet"
    cal = pd.DataFrame({"a": [1, 2]})
    cp.escribir(cal, ruta)
    assert ruta.is_file()
    assert [p.name for p in ruta.parent.iterdir()] == ["calendario.parquet"]


def test_tekax_2024_coincide_con_conteo_independiente(generado):
    """Cuenta los cuadritos-día de Tekax 2024 directo de los focos, sin usar el pipeline."""
    cal, _, _, _ = generado
    f = pd.read_parquet(cp.FOCOS)
    tipo = f["type"]
    f = f[(f["sensor"] == "S-NPP")
          & (tipo.isna() | (tipo == 0))
          & f["confidence"].isin(["n", "h"])
          & (f["municipio"] == "Tekax")]
    hhmm = f["acq_time"].astype(int)
    utc = f["acq_date"] + pd.to_timedelta(hhmm // 100 * 60 + hhmm % 100, unit="min")
    solar = utc + pd.to_timedelta(f["longitude"] / 15, unit="h")
    dias = pd.DataFrame({
        "dia": solar.dt.floor("D"),
        "lat": f["latitude"].round(2),
        "lon": f["longitude"].round(2),
    }).drop_duplicates()
    independiente = int((dias["dia"].dt.year == 2024).sum())

    del_calendario = int(cal.loc[(cal["municipio"] == "Tekax") & (cal["anio"] == 2024),
                                 "cuadritos_viirs_crudo"].sum())
    assert independiente == del_calendario, (
        f"Tekax 2024: conteo independiente {independiente}, calendario {del_calendario}"
    )
    assert independiente > 0
