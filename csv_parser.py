import pandas as pd
from fastapi import HTTPException
from io import StringIO


CATEGORY_RULES = {
    "Food & Dining": ["restaurant", "cafe", "coffee", "mcdonald", "kfc", "pizza",
                      "burger", "sushi", "grocery", "supermarket", "eating", "food",
                      "chipotle", "subway", "starbucks", "doordash", "ubereats"],
    "Transport": ["uber", "lyft", "taxi", "fuel", "petrol", "gas station", "parking",
                  "toll", "bus", "train", "metro", "transit", "airline", "flight"],
    "Shopping": ["amazon", "ebay", "walmart", "target", "mall", "store", "shop",
                 "clothing", "fashion", "nike", "zara", "h&m", "online order"],
    "Entertainment": ["netflix", "spotify", "hulu", "disney", "cinema", "movie",
                      "game", "steam", "playstation", "xbox", "concert", "ticket"],
    "Utilities": ["electricity", "water", "internet", "cable", "phone", "utility",
                  "bill", "power", "energy", "broadband"],
    "Health": ["pharmacy", "hospital", "clinic", "doctor", "dentist", "gym",
               "fitness", "health", "medical", "prescription", "cvs", "walgreens"],
    "Housing": ["rent", "mortgage", "landlord", "apartment", "maintenance", "repair"],
    "Income": ["salary", "payroll", "deposit", "freelance", "transfer in",
               "payment received", "refund", "cashback", "interest earned"],
}

COLUMN_KEYWORDS = {
    "date": ["date"],
    "debit": ["debit", "withdrawal", "money out", "paid out"],
    "credit": ["credit", "deposit", "money in", "paid in"],
    "amount": ["amount", "amt", "value"],
    "type": ["transaction type", "cr/dr", "dr/cr", "direction", "type"],
    "description": ["description", "merchant", "detail", "narration",
                     "memo", "payee", "particular", "reference"],
}

FIELD_PRIORITY = ["date", "debit", "credit", "amount", "type", "description"]


def categorise(description: str) -> str:
    desc = description.lower()
    for category, keywords in CATEGORY_RULES.items():
        if any(kw in desc for kw in keywords):
            return category
    return "Other"


def detect_columns(columns: list[str]) -> dict[str, str]:
    """Map raw CSV headers to our internal field names using keyword matching."""
    col_map: dict[str, str] = {}
    for field in FIELD_PRIORITY:
        for col in columns:
            if col in col_map.values():
                continue
            if any(kw in col for kw in COLUMN_KEYWORDS[field]):
                col_map[field] = col
                break
    return col_map


def parse_csv(file_bytes: bytes) -> list[dict]:
    try:
        text = file_bytes.decode("utf-8", errors="replace")
        df = pd.read_csv(StringIO(text))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {e}")

    df.columns = [c.strip().lower() for c in df.columns]
    col_map = detect_columns(list(df.columns))

    has_amount = "amount" in col_map
    has_split = "debit" in col_map and "credit" in col_map

    if "date" not in col_map or not (has_amount or has_split):
        raise HTTPException(
            status_code=400,
            detail=(
                "Couldn't find the columns needed to read this file. "
                "Make sure it has a date column and either an amount column, "
                "or separate debit and credit columns."
            ),
        )

    if "description" not in col_map:
        df["_description"] = "Unknown"
        col_map["description"] = "_description"

    df = df.rename(columns={v: k for k, v in col_map.items()})

    df["date"] = pd.to_datetime(df["date"], format="mixed", dayfirst=False, errors="coerce")
    df = df.dropna(subset=["date"])
    df["description"] = df["description"].fillna("Unknown").astype(str).str.strip()

    if has_split:
        debit = pd.to_numeric(df["debit"], errors="coerce").fillna(0.0)
        credit = pd.to_numeric(df["credit"], errors="coerce").fillna(0.0)
        df["amount"] = (credit - debit).abs()
        df["type"] = (credit >= debit).map({True: "income", False: "expense"})
    else:
        raw_amount = pd.to_numeric(df["amount"], errors="coerce").fillna(0.0)
        if "type" in df.columns:
            df["type"] = df["type"].astype(str).str.lower().str.strip()
            df["type"] = df["type"].apply(lambda t: "income" if t.startswith(("cr", "in", "income")) else "expense")
        else:
            df["type"] = raw_amount.apply(lambda x: "income" if x > 0 else "expense")
        df["amount"] = raw_amount.abs()

    df["category"] = df["description"].apply(categorise)
    df["month"] = df["date"].dt.strftime("%Y-%m")
    df["date"] = df["date"].dt.strftime("%Y-%m-%d")

    keep = ["date", "description", "amount", "type", "category", "month"]
    df = df[keep].sort_values("date", ascending=False)

    return df.to_dict(orient="records")