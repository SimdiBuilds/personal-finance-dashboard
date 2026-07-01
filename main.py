from fastapi import FastAPI, Request, UploadFile, File
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from csv_parser import parse_csv
from analytics import get_summary, get_by_category, get_by_month

app = FastAPI(title="Personal Finance Dashboard")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

_transactions: list[dict] = []


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        return JSONResponse(status_code=400, content={"error": "Only CSV files are accepted."})

    contents = await file.read()

    global _transactions
    _transactions = parse_csv(contents)

    return {
        "message": "File uploaded successfully.",
        "rows": len(_transactions),
        "preview": _transactions[:5],
    }


@app.get("/transactions")
async def transactions():
    return _transactions


@app.get("/summary")
async def summary():
    return get_summary(_transactions)


@app.get("/by-category")
async def by_category():
    return get_by_category(_transactions)


@app.get("/by-month")
async def by_month():
    return get_by_month(_transactions)