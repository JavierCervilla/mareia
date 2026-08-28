# Pipeline de estaciones de Mareia. Ver README.md.
#
# El intérprete se puede sobreescribir:  make all PYTHON=python3.12

PYTHON ?= python3
VENV := .venv
BIN := $(VENV)/bin
export PYTHONPATH := $(CURDIR)

.PHONY: all venv fetch build check test clean clean-cache

## all: entorno + dataset + informe QC + tests (el camino completo desde cero)
all: build test

## venv: crea el entorno virtual con las dependencias pinneadas
venv: $(VENV)/.installed

$(VENV)/.installed: requirements.txt
	$(PYTHON) -m venv $(VENV)
	$(BIN)/pip install --quiet --upgrade pip
	$(BIN)/pip install --quiet --requirement requirements.txt
	touch $@

## fetch: calienta la caché de descargas sin generar nada
fetch: venv
	$(BIN)/python run.py fetch

## build: genera data/stations/*.json, data/brest/constituents.json y reports/QC-<fecha>.md
build: venv
	$(BIN)/python run.py build

## check: valida contra el schema station/v1 los JSON ya commiteados (no necesita red)
check: venv
	$(BIN)/python run.py check

## test: suite de tests (no necesita red)
test: venv
	$(BIN)/python -m pytest tests -q

## clean-cache: borra las descargas para forzar el camino desde cero
clean-cache:
	rm -rf .cache

## clean: borra caché y entorno virtual
clean: clean-cache
	rm -rf $(VENV) .pytest_cache
	find . -name __pycache__ -type d -exec rm -rf {} +
