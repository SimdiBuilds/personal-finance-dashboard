from collections import defaultdict


def get_summary(transactions: list[dict]) -> dict:
    income = sum(t["amount"] for t in transactions if t["type"] == "income")
    expenses = sum(t["amount"] for t in transactions if t["type"] == "expense")
    return {
        "total_income": round(income, 2),
        "total_expenses": round(expenses, 2),
        "net_balance": round(income - expenses, 2),
        "transaction_count": len(transactions),
    }


def get_by_category(transactions: list[dict]) -> list[dict]:
    totals = defaultdict(float)
    for t in transactions:
        if t["type"] == "expense":
            totals[t["category"]] += t["amount"]

    return sorted(
        [{"category": cat, "total": round(amt, 2)} for cat, amt in totals.items()],
        key=lambda x: x["total"],
        reverse=True,
    )


def get_by_month(transactions: list[dict]) -> list[dict]:
    income_by_month = defaultdict(float)
    expense_by_month = defaultdict(float)

    for t in transactions:
        if t["type"] == "income":
            income_by_month[t["month"]] += t["amount"]
        else:
            expense_by_month[t["month"]] += t["amount"]

    months = sorted(set(list(income_by_month.keys()) + list(expense_by_month.keys())))

    return [
        {
            "month": m,
            "income": round(income_by_month[m], 2),
            "expenses": round(expense_by_month[m], 2),
        }
        for m in months
    ]