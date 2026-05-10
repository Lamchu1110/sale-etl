from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_revenue: float
    total_orders: int
    total_quantity: int
    avg_order_value: float


class RevenueByDimension(BaseModel):
    label: str
    revenue: float


class TrendPoint(BaseModel):
    period: str
    revenue: float


class KPIOut(BaseModel):
    kpi_name: str
    value: float
    note: str
