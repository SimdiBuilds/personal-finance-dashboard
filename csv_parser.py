import pandas as pd
from fastapi import HTTPException
from io import BytesIO, StringIO


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


def categorise(description: str) -> str:
    desc = description.lower()
    for category, keywords in CATEGORY_RULES.items():
        if any(kw in desc for kw in keywords):
            return category
    return "Other"


def parse_csv(file_bytes: bytes) -> list[dict]:
    try:
        text = file_bytes.decode("utf-8", errors="replace")
        df = pd.read_csv(StringIO(text))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {e}")

    df.columns = [c.strip().lower() for c in df.columns]

    col_map = {}
    for col in df.columns:
        if col == "date" and "date" not in col_map:
            col_map["date"] = col
        elif col in ("description", "merchant", "details", "narration", "memo") and "description" not in col_map:
            col_map["description"] = col
        elif col in ("amount", "value", "transaction amount") and "amount" not in col_map:
            col_map["amount"] = col
        elif col in ("type", "transaction type", "cr/dr") and "type" not in col_map:
            col_map["type"] = col

    if "date" not in col_map or "amount" not in col_map:
        raise HTTPException(
            status_code=400,
            detail="CSV must have at least 'date' and 'amount' columns."
        )

    if "description" not in col_map:
        df["_description"] = "Unknown"
        col_map["description"] = "_description"

    df = df.rename(columns={v: k for k, v in col_map.items()})
    keep = [k for k in col_map.keys()]
    df = df[keep].copy()

    # parse dates without inference to avoid hanging on ambiguous formats
    df["date"] = pd.to_datetime(df["date"], format="mixed", dayfirst=False, errors="coerce")
    df = df.dropna(subset=["date"])

    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0.0)
    df["description"] = df["description"].fillna("Unknown").astype(str).str.strip()

    if "type" not in df.columns:
        df["type"] = df["amount"].apply(lambda x: "income" if x > 0 else "expense")
    else:
        df["type"] = df["type"].str.lower().str.strip()

    df["category"] = df["description"].apply(categorise)
    df["month"] = df["date"].dt.strftime("%Y-%m")
    df["amount"] = df["amount"].abs()
    df["date"] = df["date"].dt.strftime("%Y-%m-%d")

    df = df.sort_values("date", ascending=False)

    return df.to_dict(orient="records")