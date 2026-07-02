import pytest
from pathlib import Path

from csv_parser import parse_csv, categorise
from analytics import get_summary, get_by_category, get_by_month


SAMPLE_CSV = Path(__file__).parent.parent / "sample_data" / "transactions.csv"


@pytest.fixture
def transactions():
    with open(SAMPLE_CSV, "rb") as f:
        return parse_csv(f.read())


# ── categoriser ──────────────────────────────────────────────────

def test_categorise_food():
    assert categorise("McDonald's") == "Food & Dining"
    assert categorise("Starbucks coffee") == "Food & Dining"


def test_categorise_transport():
    assert categorise("Uber ride") == "Transport"


def test_categorise_income():
    assert categorise("Salary Deposit") == "Income"


def test_categorise_unknown_falls_back_to_other():
    assert categorise("Some Random Merchant XYZ") == "Other"


def test_categorise_case_insensitive():
    assert categorise("NETFLIX SUBSCRIPTION") == "Entertainment"


# ── csv parsing ──────────────────────────────────────────────────

def test_parse_csv_row_count(transactions):
    assert len(transactions) == 40


def test_parse_csv_fields_present(transactions):
    row = transactions[0]
    assert "date" in row
    assert "description" in row
    assert "amount" in row
    assert "type" in row
    assert "category" in row
    assert "month" in row


def test_parse_csv_amounts_are_positive(transactions):
    # amounts are stored as absolute values; direction lives in 'type'
    assert all(t["amount"] >= 0 for t in transactions)


def test_parse_csv_missing_columns_raises():
    bad_csv = b"foo,bar\n1,2\n"
    with pytest.raises(Exception):
        parse_csv(bad_csv)


def test_parse_csv_invalid_file_raises():
    with pytest.raises(Exception):
        parse_csv(b"this is not a csv at all !!! ###")


def test_parse_csv_accepts_alternate_headers():
    csv = b"Transaction Date,Merchant Name,Amount\n2026-06-01,Coffee Shop,-4.50\n"
    rows = parse_csv(csv)
    assert len(rows) == 1
    assert rows[0]["description"] == "Coffee Shop"
    assert rows[0]["type"] == "expense"


def test_parse_csv_accepts_debit_credit_split():
    csv = (
        b"Posted Date,Narration,Debit,Credit\n"
        b"2026-06-01,Salary,0,3500.00\n"
        b"2026-06-02,Groceries,65.00,0\n"
    )
    rows = parse_csv(csv)
    assert len(rows) == 2
    income_row = next(r for r in rows if r["type"] == "income")
    expense_row = next(r for r in rows if r["type"] == "expense")
    assert income_row["amount"] == 3500.00
    assert expense_row["amount"] == 65.00


# ── analytics: summary ──────────────────────────────────────────────

def test_summary_totals(transactions):
    summary = get_summary(transactions)
    assert summary["total_income"] == 15462.00
    assert summary["total_expenses"] == 3625.34
    assert summary["net_balance"] == 11836.66
    assert summary["transaction_count"] == 40


def test_summary_empty_transactions():
    summary = get_summary([])
    assert summary["total_income"] == 0
    assert summary["total_expenses"] == 0
    assert summary["net_balance"] == 0
    assert summary["transaction_count"] == 0


# ── analytics: by category ──────────────────────────────────────────

def test_by_category_only_includes_expenses(transactions):
    categories = get_by_category(transactions)
    names = [c["category"] for c in categories]
    assert "Income" not in names


def test_by_category_sorted_descending(transactions):
    categories = get_by_category(transactions)
    totals = [c["total"] for c in categories]
    assert totals == sorted(totals, reverse=True)


def test_by_category_housing_is_top(transactions):
    categories = get_by_category(transactions)
    assert categories[0]["category"] == "Housing"


# ── analytics: by month ──────────────────────────────────────────────

def test_by_month_covers_two_months(transactions):
    months = get_by_month(transactions)
    month_names = [m["month"] for m in months]
    assert "2026-05" in month_names
    assert "2026-06" in month_names


def test_by_month_sorted_chronologically(transactions):
    months = get_by_month(transactions)
    month_names = [m["month"] for m in months]
    assert month_names == sorted(month_names)


def test_by_month_income_and_expenses_present(transactions):
    months = get_by_month(transactions)
    for m in months:
        assert "income" in m
        assert "expenses" in m