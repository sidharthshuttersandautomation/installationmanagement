import streamlit as st
import gspread
from google.oauth2.service_account import Credentials

try:
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    
    # 1. Test reading secrets
    creds_dict = dict(st.secrets["gcp_service_account"])
    spreadsheet_url = st.secrets["spreadsheet_url"]
    print(" secrets.toml read successfully.")

    # 2. Test authentication
    credentials = Credentials.from_service_account_info(creds_dict, scopes=scopes)
    client = gspread.authorize(credentials)
    print(" Authenticated with GCP Service Account.")

    # 3. Test opening spreadsheet
    sh = client.open_by_url(spreadsheet_url)
    print(f" Connected to Google Sheet: '{sh.title}'")

    # 4. Test reading a worksheet
    worksheet = sh.worksheet("Sites_Master")
    data = worksheet.get_all_records()
    print(f" Successfully retrieved {len(data)} rows from 'Sites_Master'.")

except Exception as e:
    print(f"❌ CONNECTION ERROR: {e}")