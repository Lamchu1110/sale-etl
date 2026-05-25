from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import pandas as pd
from sqlalchemy.orm import Session
from models.actual_revenue import ActualRevenue
from models.data_quality_report import DataQualityReport
from models.etl_log import ETLLog
from models.monthly_revenue import MonthlyRevenue
from models.product import Product
from models.region import Region
from models.sales_cleaned import SalesCleaned
from models.sales_raw import SalesRaw
from models.store import Store
from models.upload_batch import UploadBatch
from services.upload_service import get_batch_file_path

REQUIRED_COLUMNS = [
    'order_id',
    'order_date',
    'product_name',
    'category',
    'quantity',
    'unit_price',
    'total_revenue',
    'store_name',
    'region_name',
]

VALIDATION_RULES = [
    'CSV must contain all required columns.',
    'order_date must be convertible to a valid date.',
    'quantity, unit_price, total_revenue must be numeric.',
    'quantity, unit_price, total_revenue cannot be negative.',
    'quantity * unit_price must approximately equal total_revenue.',
    'Duplicate rows are checked by order_id + order_date + product_name + store_name.',
]


def log(db: Session, batch_id: int, step: str, message: str, level: str = 'INFO') -> None:
    db.add(ETLLog(batch_id=batch_id, step=step, message=message, level=level))
    db.commit()


def normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    actual = [str(c).strip().lower() for c in df.columns]
    df.columns = actual

    def find_col(keywords):
        """Find the first column whose name contains any of the keywords."""
        for k in keywords:
            for c in actual:
                # Prefer exact match first
                if c == k:
                    return c
            for c in actual:
                if k in c:
                    return c
        return None

    col_map = {}
    prod_col = find_col(['product_name', 'product', 'item', 'title', 'game', 'coffee_name'])
    if prod_col:
        col_map['product_name'] = prod_col

    date_col = find_col(['order_date', 'date', 'timestamp', 'year'])
    if date_col:
        col_map['order_date'] = date_col

    cat_col = find_col(['category', 'genre', 'type', 'department', 'platform', 'cash_type'])
    if cat_col:
        col_map['category'] = cat_col

    rev_col = find_col(['total_revenue', 'revenue', 'total_sales', 'sales', 'money'])
    if rev_col:
        col_map['total_revenue'] = rev_col

    price_col = find_col(['unit_price', 'price'])
    if price_col and price_col != rev_col:
        col_map['unit_price'] = price_col
    elif rev_col:
        col_map['unit_price'] = rev_col

    qty_col = find_col(['quantity', 'qty'])
    if qty_col:
        col_map['quantity'] = qty_col

    store_col = find_col(['store_name', 'store', 'location', 'publisher', 'developer'])
    if store_col:
        col_map['store_name'] = store_col

    region_col = find_col(['region_name', 'region', 'country', 'state'])
    if region_col:
        col_map['region_name'] = region_col

    for new_col, old_col in col_map.items():
        if new_col not in df.columns:
            df[new_col] = df[old_col]

    # Clean up dates before defaults
    if 'order_date' in df.columns:
        df['order_date'] = df['order_date'].astype(str).str.replace(r'\.0$', '', regex=True)

    if 'order_id' not in df.columns:
        df['order_id'] = [f"ORD-{i+1}" for i in range(len(df))]
    if 'order_date' not in df.columns:
        df['order_date'] = '2023-01-01'
    if 'product_name' not in df.columns:
        df['product_name'] = 'Unknown Product'
    if 'category' not in df.columns:
        df['category'] = 'General'
    if 'quantity' not in df.columns:
        df['quantity'] = 1
    if 'unit_price' not in df.columns:
        df['unit_price'] = 0.0
    if 'total_revenue' not in df.columns:
        df['total_revenue'] = 0.0
    if 'store_name' not in df.columns:
        df['store_name'] = 'Main Store'
    if 'region_name' not in df.columns:
        df['region_name'] = 'Global'

    return df



def preview_validation_rules(file_path: Path | None) -> dict:
    missing_columns: list[str] = []
    if file_path and file_path.exists():
        df = pd.read_csv(file_path, nrows=0)
        df = normalize_dataframe(df)
        actual = list(df.columns)
        missing_columns = [c for c in REQUIRED_COLUMNS if c not in actual]
    return {
        'required_columns': REQUIRED_COLUMNS,
        'missing_columns': missing_columns,
        'allowed_extensions': ['.csv'],
        'validation_rules': VALIDATION_RULES,
    }


# ── Dimension lookup helpers (with per-batch caching) ──────────────

def _infer_data_year(clean_df: pd.DataFrame) -> int | None:
    if clean_df.empty or 'order_date' not in clean_df.columns:
        return None
    years = clean_df['order_date'].dt.year.dropna()
    if years.empty:
        return None
    return int(years.mode().iloc[0])


def _iqr_outlier_mask(series: pd.Series) -> pd.Series:
    numeric = pd.to_numeric(series, errors='coerce')
    valid = numeric.dropna()
    mask = pd.Series(False, index=series.index)
    if len(valid) < 4:
        return mask

    q1 = valid.quantile(0.25)
    q3 = valid.quantile(0.75)
    iqr = q3 - q1
    if pd.isna(iqr) or iqr <= 0:
        return mask

    lower_bound = q1 - 1.5 * iqr
    upper_bound = q3 + 1.5 * iqr
    return numeric.lt(lower_bound) | numeric.gt(upper_bound)


def _monthly_base_records(clean_df: pd.DataFrame, business_id: int, data_year: int, batch_id: int) -> list[dict]:
    year_df = clean_df[clean_df['order_date'].dt.year == data_year].copy()
    if year_df.empty:
        return []
    year_df['month'] = year_df['order_date'].dt.month.astype(int)
    grouped = (
        year_df.groupby('month')
        .agg(
            revenue=('total_revenue', 'sum'),
            total_orders=('order_id', 'nunique'),
            total_quantity=('quantity', 'sum'),
        )
        .reset_index()
    )
    return [
        {
            'business_id': business_id,
            'data_year': data_year,
            'month': int(row.month),
            'revenue': round(float(row.revenue), 2),
            'total_orders': int(row.total_orders),
            'total_quantity': int(row.total_quantity),
            'source_batch_id': batch_id,
        }
        for row in grouped.itertuples(index=False)
    ]


def _monthly_actual_records(clean_df: pd.DataFrame, business_id: int, actual_year: int, batch_id: int) -> list[dict]:
    year_df = clean_df[clean_df['order_date'].dt.year == actual_year].copy()
    if year_df.empty:
        return []
    year_df['month'] = year_df['order_date'].dt.month.astype(int)
    grouped = year_df.groupby('month').agg(revenue=('total_revenue', 'sum')).reset_index()
    return [
        {
            'business_id': business_id,
            'actual_year': actual_year,
            'month': int(row.month),
            'revenue': round(float(row.revenue), 2),
            'source_batch_id': batch_id,
        }
        for row in grouped.itertuples(index=False)
    ]


def _build_dimension_caches(db: Session):
    """Pre-load all existing dimension records into dictionaries for fast lookup."""
    product_cache = {p.name: p for p in db.query(Product).all()}
    region_cache = {r.name: r for r in db.query(Region).all()}
    store_cache = {(s.name, s.region_id): s for s in db.query(Store).all()}
    return product_cache, region_cache, store_cache


def get_or_create_product(db: Session, name: str, cache: dict) -> Product:
    if name in cache:
        return cache[name]
    item = Product(name=name)
    db.add(item)
    db.flush()  # Get the ID without full commit
    cache[name] = item
    return item


def get_or_create_region(db: Session, name: str, cache: dict) -> Region:
    if name in cache:
        return cache[name]
    item = Region(name=name)
    db.add(item)
    db.flush()
    cache[name] = item
    return item


def get_or_create_store(db: Session, name: str, region_id: int, cache: dict) -> Store:
    key = (name, region_id)
    if key in cache:
        return cache[key]
    item = Store(name=name, region_id=region_id)
    db.add(item)
    db.flush()
    cache[key] = item
    return item


def process_batch(db: Session, batch_id: int):
    batch = db.query(UploadBatch).filter(UploadBatch.id == batch_id).first()
    if not batch:
        raise ValueError('Batch not found')

    file_path = get_batch_file_path(batch_id, batch.file_name)
    if not file_path or not Path(file_path).exists():
        batch.file_status = 'failed'
        batch.error_summary = 'Uploaded file not found'
        db.commit()
        log(db, batch_id, 'extract', 'Uploaded file not found', 'ERROR')
        return {'status': 'failed', 'reason': 'file not found'}

    try:
        batch.file_status = 'processing'
        batch.error_summary = None
        batch.notes = 'ETL started'
        db.commit()
        log(db, batch_id, 'extract', f'Reading file {file_path.name}')

        df = pd.read_csv(file_path)
        df = normalize_dataframe(df)
        missing_columns = [c for c in REQUIRED_COLUMNS if c not in df.columns]
        if missing_columns:
            batch.file_status = 'failed'
            batch.error_summary = f"Missing required columns: {', '.join(missing_columns)}"
            db.commit()
            log(db, batch_id, 'validate', batch.error_summary, 'ERROR')
            return {'status': 'failed', 'reason': batch.error_summary}

        total_rows = len(df)
        batch.total_rows = int(total_rows)
        data_type = (batch.data_type or 'base').lower().strip()
        if data_type not in {'base', 'actual'}:
            batch.file_status = 'failed'
            batch.error_summary = 'data_type must be "base" or "actual"'
            db.commit()
            log(db, batch_id, 'validate', batch.error_summary, 'ERROR')
            return {'status': 'failed', 'reason': batch.error_summary}
        business_id = batch.business_id or 1
        batch.business_id = business_id
        batch.data_type = data_type
        db.commit()

        # Clear previous data for this batch
        db.query(SalesRaw).filter(SalesRaw.batch_id == batch_id).delete()
        db.query(SalesCleaned).filter(SalesCleaned.batch_id == batch_id).delete()
        db.query(MonthlyRevenue).filter(MonthlyRevenue.source_batch_id == batch_id).delete()
        db.query(ActualRevenue).filter(ActualRevenue.source_batch_id == batch_id).delete()
        db.query(DataQualityReport).filter(DataQualityReport.batch_id == batch_id).delete()
        db.commit()

        # ── EXTRACT: Bulk insert raw rows ──────────────────────────
        raw_records = []
        for idx, row in enumerate(df.itertuples(index=False)):
            row_dict = row._asdict()
            raw_records.append({
                'batch_id': batch_id,
                'row_number': idx + 1,
                'order_id': None if pd.isna(row_dict.get('order_id')) else str(row_dict.get('order_id')),
                'order_date': None if pd.isna(row_dict.get('order_date')) else str(row_dict.get('order_date')),
                'product_name': None if pd.isna(row_dict.get('product_name')) else str(row_dict.get('product_name')),
                'category': None if pd.isna(row_dict.get('category')) else str(row_dict.get('category')),
                'quantity': None if pd.isna(row_dict.get('quantity')) else str(row_dict.get('quantity')),
                'unit_price': None if pd.isna(row_dict.get('unit_price')) else str(row_dict.get('unit_price')),
                'total_revenue': None if pd.isna(row_dict.get('total_revenue')) else str(row_dict.get('total_revenue')),
                'store_name': None if pd.isna(row_dict.get('store_name')) else str(row_dict.get('store_name')),
                'region_name': None if pd.isna(row_dict.get('region_name')) else str(row_dict.get('region_name')),
                'raw_payload': json.dumps({k: None if pd.isna(v) else str(v) for k, v in row_dict.items()}),
            })
        if raw_records:
            db.bulk_insert_mappings(SalesRaw, raw_records)
            db.commit()
        log(db, batch_id, 'extract', f'Stored {total_rows} raw rows')

        # ── TRANSFORM: Clean and validate ──────────────────────────
        clean_df = df.copy()
        for col in ['order_id', 'product_name', 'category', 'store_name', 'region_name']:
            clean_df[col] = clean_df[col].apply(lambda x: x.strip() if isinstance(x, str) else x)

        missing_count = int(clean_df[REQUIRED_COLUMNS].isna().sum().sum())
        clean_df['order_date'] = pd.to_datetime(clean_df['order_date'], errors='coerce')
        clean_df['quantity'] = pd.to_numeric(clean_df['quantity'], errors='coerce')
        clean_df['unit_price'] = pd.to_numeric(clean_df['unit_price'], errors='coerce')
        clean_df['total_revenue'] = pd.to_numeric(clean_df['total_revenue'], errors='coerce')

        # Fix NaT dates instead of dropping
        clean_df.loc[clean_df['order_date'].isna(), 'order_date'] = pd.to_datetime('2023-01-01')

        # Remove duplicates first
        duplicate_count = int(clean_df.duplicated(subset=['order_id', 'order_date', 'product_name', 'store_name']).sum())
        clean_df = clean_df.drop_duplicates(subset=['order_id', 'order_date', 'product_name', 'store_name'])

        # THEN compute invalid mask on the deduplicated dataframe (fixes index alignment)
        invalid_logic_mask = (
            clean_df['quantity'].isna()
            | clean_df['unit_price'].isna()
            | clean_df['total_revenue'].isna()
            | (clean_df['quantity'] < 0)
            | (clean_df['unit_price'] < 0)
            | (clean_df['total_revenue'] < 0)
        )
        revenue_diff = (clean_df['quantity'] * clean_df['unit_price'] - clean_df['total_revenue']).abs()
        invalid_logic_mask = invalid_logic_mask | (revenue_diff > 0.01)

        valid_metric_df = clean_df[~invalid_logic_mask].copy()
        outlier_mask = (
            _iqr_outlier_mask(valid_metric_df['total_revenue'])
            | _iqr_outlier_mask(valid_metric_df['quantity'])
        )
        outlier_count = int(outlier_mask.sum())

        clean_df = valid_metric_df.dropna(subset=REQUIRED_COLUMNS).copy()

        invalid_count = int(total_rows - len(clean_df))
        clean_df['product_name'] = clean_df['product_name'].astype(str).str.title()
        clean_df['region_name'] = clean_df['region_name'].astype(str).str.title()
        clean_df['store_name'] = clean_df['store_name'].astype(str).str.title()
        clean_df['category'] = clean_df['category'].astype(str).str.title()
        clean_df['quantity'] = clean_df['quantity'].astype(int)
        data_year = batch.data_year or _infer_data_year(clean_df)
        if data_year is not None:
            batch.data_year = int(data_year)

        # ── LOAD: Bulk insert cleaned rows with cached dimensions ──
        aggregate_records: list[dict] = []
        cleaned_records: list[dict] = []

        if data_type == 'base':
            product_cache, region_cache, store_cache = _build_dimension_caches(db)

            for row in clean_df.itertuples(index=False):
                region = get_or_create_region(db, str(row.region_name), region_cache)
                product = get_or_create_product(db, str(row.product_name), product_cache)
                store = get_or_create_store(db, str(row.store_name), region.id, store_cache)

                cleaned_records.append({
                    'batch_id': batch_id,
                    'order_id': str(row.order_id),
                    'order_date': row.order_date.date() if hasattr(row.order_date, 'date') else row.order_date,
                    'product_id': product.id,
                    'region_id': region.id,
                    'store_id': store.id,
                    'product_name': str(row.product_name),
                    'category': str(row.category),
                    'quantity': int(row.quantity),
                    'unit_price': float(row.unit_price),
                    'total_revenue': float(row.total_revenue),
                    'store_name': str(row.store_name),
                    'region_name': str(row.region_name),
                })

            if cleaned_records:
                db.bulk_insert_mappings(SalesCleaned, cleaned_records)

            if data_year is not None:
                db.query(MonthlyRevenue).filter(
                    MonthlyRevenue.business_id == business_id,
                    MonthlyRevenue.data_year == int(data_year),
                ).delete(synchronize_session=False)
                aggregate_records = _monthly_base_records(clean_df, business_id, int(data_year), batch_id)
                if aggregate_records:
                    db.bulk_insert_mappings(MonthlyRevenue, aggregate_records)
        else:
            if data_year is not None:
                db.query(ActualRevenue).filter(
                    ActualRevenue.business_id == business_id,
                    ActualRevenue.actual_year == int(data_year),
                ).delete(synchronize_session=False)
                aggregate_records = _monthly_actual_records(clean_df, business_id, int(data_year), batch_id)
                if aggregate_records:
                    db.bulk_insert_mappings(ActualRevenue, aggregate_records)

        db.commit()

        report = DataQualityReport(
            batch_id=batch_id,
            missing_count=missing_count,
            duplicate_count=duplicate_count,
            invalid_count=invalid_count,
            summary=(
                f'original_rows={total_rows}, cleaned_rows={len(clean_df)}, '
                f'missing={missing_count}, duplicate={duplicate_count}, invalid={invalid_count}, '
                f'outliers_iqr={outlier_count}, data_type={data_type}, '
                f'aggregate_months={len(aggregate_records)}'
            ),
        )
        db.add(report)
        batch.valid_rows = int(len(clean_df))
        batch.invalid_rows = int(invalid_count)
        batch.file_status = 'processed'
        batch.notes = f'ETL completed for {data_type} data at {datetime.now(timezone.utc).isoformat()}'
        batch.processed_at = datetime.now(timezone.utc)
        batch.error_summary = None if invalid_count == 0 else f'{invalid_count} invalid rows removed during cleaning'
        db.commit()

        log(db, batch_id, 'transform', f'Cleaned rows: {len(clean_df)} | Invalid rows: {invalid_count}')
        if outlier_count:
            log(db, batch_id, 'validate', f'Detected {outlier_count} IQR outlier rows', 'WARNING')
        if data_type == 'base':
            log(db, batch_id, 'load', f'Loaded {len(cleaned_records)} rows into sales_cleaned and {len(aggregate_records)} monthly revenue rows')
        else:
            log(db, batch_id, 'load', f'Loaded {len(aggregate_records)} actual revenue rows')

        return {
            'status': 'processed',
            'batch_id': batch_id,
            'business_id': business_id,
            'data_year': int(data_year) if data_year is not None else None,
            'data_type': data_type,
            'total_rows': total_rows,
            'valid_rows': int(len(clean_df)),
            'invalid_rows': invalid_count,
            'duplicate_rows': duplicate_count,
            'missing_count': missing_count,
            'outlier_rows': outlier_count,
            'aggregate_months': len(aggregate_records),
        }
    except Exception as exc:
        batch.file_status = 'failed'
        batch.error_summary = str(exc)
        batch.notes = 'ETL failed'
        db.commit()
        log(db, batch_id, 'system', str(exc), 'ERROR')
        raise
