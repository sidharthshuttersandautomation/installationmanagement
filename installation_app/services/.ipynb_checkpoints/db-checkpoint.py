import sqlite3
import pandas as pd

# 1. Connect to SQLite database
conn = sqlite3.connect("installation_management.db")
cursor = conn.cursor()

# 2. Define schema
tables_schema = {
    "Sites_Master": """
        CREATE TABLE IF NOT EXISTS Sites_Master (
            installation_id TEXT PRIMARY KEY,
            client_name TEXT,
            client_phone TEXT,
            client_email TEXT,
            salesperson_id TEXT,
            salesperson TEXT,
            team_lead TEXT,
            supervisor TEXT,
            site_city TEXT,
            site_address TEXT,
            order_date TEXT,
            handover_date TEXT,
            deal_stage TEXT,
            deal_amount REAL,
            products_summary TEXT,
            status TEXT,
            hold_reason TEXT
        );
    """,
    "Workers_Master": """
        CREATE TABLE IF NOT EXISTS Workers_Master (
            worker_id TEXT PRIMARY KEY,
            name TEXT,
            role TEXT,
            phone TEXT,
            status TEXT
        );
    """,
    "Worker_Daily_Logs": """
        CREATE TABLE IF NOT EXISTS Worker_Daily_Logs (
            log_id TEXT PRIMARY KEY,
            installation_id TEXT,
            log_type TEXT,
            date TEXT,
            worker_name TEXT,
            role TEXT,
            team_lead TEXT,
            task_category TEXT,
            task_description TEXT,
            hours INTEGER,
            minutes INTEGER,
            location_type TEXT,
            site_city TEXT,
            travel_required TEXT,
            delay_category TEXT,
            site_remarks TEXT,
            photo_url TEXT,
            logged_by TEXT
        );
    """,
    "Expense_Logs": """
        CREATE TABLE IF NOT EXISTS Expense_Logs (
            exp_id TEXT PRIMARY KEY,
            installation_id TEXT,
            exp_date TEXT,
            supervisor_name TEXT,
            travel_exp REAL,
            stay_exp REAL,
            food_exp REAL,
            misc_exp REAL,
            total_expense REAL,
            exp_remarks TEXT
        );
    """
}

# Create tables
for create_sql in tables_schema.values():
    cursor.execute(create_sql)

conn.commit()

# 3. Load Excel sheets directly into SQLite
excel_file = "installationmanagement.xlsx"
xls = pd.ExcelFile(excel_file)

for sheet_name in xls.sheet_names:
    if sheet_name in tables_schema:
        df = pd.read_excel(excel_file, sheet_name=sheet_name)
        df.to_sql(sheet_name, conn, if_exists="append", index=False)

conn.close()
print("SQLite database successfully created and populated.")