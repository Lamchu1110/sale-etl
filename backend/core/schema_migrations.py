from sqlalchemy import text


def ensure_runtime_schema(engine) -> None:
    if engine.dialect.name != 'sqlite':
        return

    with engine.begin() as connection:
        columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(sales_forecasts)")).fetchall()
        }
        if 'created_by_user_id' not in columns:
            connection.execute(text('ALTER TABLE sales_forecasts ADD COLUMN created_by_user_id INTEGER'))
            connection.execute(
                text('CREATE INDEX IF NOT EXISTS ix_sales_forecasts_created_by_user_id ON sales_forecasts (created_by_user_id)')
            )
