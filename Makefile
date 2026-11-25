LABEL ?= baseline
ENGINE ?= tesseract
PRESET ?= none
SPLIT ?= dev
CONFIRM_TEST ?= false

EVAL_CONFIRM := $(if $(filter true yes 1,$(CONFIRM_TEST)),--confirm-test,)

.PHONY: eval
eval:
	docker compose exec -T ocr python -m eval.run --engine "$(ENGINE)" --preprocess "configs/$(PRESET).json" --split "$(SPLIT)" --label "$(LABEL)" $(EVAL_CONFIRM)
