from pydantic import BaseModel


class DashboardBusinessOption(BaseModel):
    id: int
    name: str
    years: list[int]


class DashboardFilterOptions(BaseModel):
    businesses: list[DashboardBusinessOption]
    years: list[int]
    default_business_id: int | None = None
    default_year: int | None = None


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
    label: str | None = None


class KPIOut(BaseModel):
    kpi_name: str
    value: float
    note: str
