from sqlalchemy import text


def _column_names(connection, table_name: str) -> set[str]:
    return {
        row[1]
        for row in connection.execute(text(f'PRAGMA table_info({table_name})')).fetchall()
    }


def ensure_runtime_schema(engine) -> None:
    if engine.dialect.name != 'sqlite':
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT OR IGNORE INTO businesses (id, name, industry, notes) "
                "VALUES (1, 'Default Business', 'General', 'Created automatically for legacy data')"
            )
        )

        upload_batch_columns = _column_names(connection, 'upload_batches')
        if 'business_id' not in upload_batch_columns:
            connection.execute(text('ALTER TABLE upload_batches ADD COLUMN business_id INTEGER'))
            connection.execute(
                text('CREATE INDEX IF NOT EXISTS ix_upload_batches_business_id ON upload_batches (business_id)')
            )
        if 'data_year' not in upload_batch_columns:
            connection.execute(text('ALTER TABLE upload_batches ADD COLUMN data_year INTEGER'))
            connection.execute(
                text('CREATE INDEX IF NOT EXISTS ix_upload_batches_data_year ON upload_batches (data_year)')
            )
        if 'data_type' not in upload_batch_columns:
            connection.execute(text("ALTER TABLE upload_batches ADD COLUMN data_type VARCHAR(20) DEFAULT 'base'"))
            connection.execute(
                text('CREATE INDEX IF NOT EXISTS ix_upload_batches_data_type ON upload_batches (data_type)')
            )

        connection.execute(text("UPDATE upload_batches SET business_id = 1 WHERE business_id IS NULL"))
        connection.execute(text("UPDATE upload_batches SET data_type = 'base' WHERE data_type IS NULL OR data_type = ''"))

        sales_forecast_columns = _column_names(connection, 'sales_forecasts')
        if 'created_by_user_id' not in sales_forecast_columns:
            connection.execute(text('ALTER TABLE sales_forecasts ADD COLUMN created_by_user_id INTEGER'))
            connection.execute(
                text('CREATE INDEX IF NOT EXISTS ix_sales_forecasts_created_by_user_id ON sales_forecasts (created_by_user_id)')
            )
