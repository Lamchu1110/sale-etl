import importlib

MODEL_MODULES = [
    'models.user',
    'models.upload_batch',
    'models.product',
    'models.region',
    'models.store',
    'models.sales_raw',
    'models.sales_cleaned',
    'models.etl_log',
    'models.data_quality_report',
    'models.sales_forecast',
]


def load_model_modules() -> None:
    for module_name in MODEL_MODULES:
        importlib.import_module(module_name)
