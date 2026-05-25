import importlib

MODEL_MODULES = [
    'models.user',
    'models.business',
    'models.upload_batch',
    'models.product',
    'models.region',
    'models.store',
    'models.sales_raw',
    'models.sales_cleaned',
    'models.monthly_revenue',
    'models.actual_revenue',
    'models.etl_log',
    'models.data_quality_report',
    'models.sales_forecast',
    'models.forecast_run',
    'models.forecast_result',
    'models.forecast_evaluation',
]


def load_model_modules() -> None:
    for module_name in MODEL_MODULES:
        importlib.import_module(module_name)
