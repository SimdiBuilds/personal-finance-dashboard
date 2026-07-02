# Personal Finance Dashboard

A full-stack web app that turns a bank statement CSV into visual spending insights — category breakdowns, monthly trends, and a searchable transaction log.

**Stack:** Python · FastAPI · pandas · Chart.js · HTML/CSS/JS

---

## Features

- Upload a CSV and get an instant dashboard — no account, no setup
- Flexible column detection — works with most bank export formats, not just one exact layout
- Automatic keyword-based categorisation (Food, Transport, Housing, etc.)
- Doughnut chart for spending by category, bar chart for income vs expenses by month
- Searchable, sortable transaction table
- Sample data included — try it without your own file

---

## Running it

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Open `http://localhost:8000`. Click **Use sample data instead** to try it immediately, or upload your own CSV.

---

## CSV format guide

The parser detects columns by keyword, not by exact name, so it works with most real bank exports without any editing.

### Required

| Field | Recognised header keywords |
|---|---|
| Date | `date` |
| Amount | `amount`, `amt`, `value` — **or** separate `debit`/`credit` columns |

### Optional

| Field | Recognised header keywords |
|---|---|
| Description | `description`, `merchant`, `detail`, `narration`, `memo`, `payee`, `particular`, `reference` |
| Type | `type`, `transaction type`, `cr/dr`, `dr/cr`, `direction` |

If no description column is found, transactions are labelled "Unknown." If no type column is found, the sign of the amount decides income vs expense — negative is treated as an expense, positive as income. If your file has separate `Debit` and `Credit` columns instead of one signed `Amount` column, that's handled automatically too.

### Examples that all work

```csv
date,description,amount,type
2026-06-01,Salary Deposit,3500.00,income
2026-06-02,McDonald's,-12.50,expense
```

```csv
Transaction Date,Merchant Name,Amount
2026-06-01,Salary Deposit,3500.00
2026-06-02,McDonald's,-12.50
```

```csv
Posted Date,Narration,Debit,Credit
2026-06-01,Salary Deposit,0,3500.00
2026-06-02,McDonald's,12.50,0
```

---

## Running the tests

```bash
pip install pytest
python -m pytest tests/ -v
```

---

## Project structure

```
personal-finance-dashboard/
├── main.py            # FastAPI app and routes
├── csv_parser.py       # CSV parsing, column detection, categorisation
├── analytics.py        # Summary, by-category, by-month calculations
├── requirements.txt
├── sample_data/
│   └── transactions.csv
├── static/
│   ├── style.css
│   └── app.js
├── templates/
│   └── index.html
└── tests/
    └── test_backend.py
```

---

## License

MIT