# Mapping theo kế hoạch 6 tuần của Lộc

## Week 1
- Phân tích dữ liệu đầu vào và ETL draft
- Thiết kế schema: users, upload_batches, sales_raw, sales_cleaned, products, regions, stores, etl_logs, data_quality_reports, sales_forecasts
- Định nghĩa metrics: total_revenue, total_orders, total_quantity, avg_order_value

## Week 2
- Chuẩn CSV: `sample_data/valid_sales.csv`
- Dataset lỗi: `sample_data/invalid_sales.csv`
- Rule kiểm tra nằm trong `services/etl_service.py`

## Week 3
- Upload CSV
- Extract raw rows
- Transform/clean
- Load vào `sales_cleaned`
- Sinh ETL logs + quality report

## Week 4
- Summary API
- Revenue by region/product
- Revenue trend
- KPI API

## Week 5
- Chuẩn bị time series theo ngày
- Forecast tuyến tính
- Lưu history dự báo

## Week 6
- Preview validation trước khi ETL
- Admin review logs/quality
- Tài liệu handoff kỹ thuật
