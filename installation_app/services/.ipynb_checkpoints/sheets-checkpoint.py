import io
import pandas as pd
import streamlit as st
import gspread
from google.oauth2.service_account import Credentials

import traceback
# -----------------------------------------------------------------------------
# Google Sheets Connection Helper
# -----------------------------------------------------------------------------
@st.cache_resource
def get_gspread_client():
    """Authenticates with Google Sheets API using GCP service account credentials in st.secrets."""
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    try:
        if "gcp_service_account" in st.secrets:
            creds_dict = dict(st.secrets["gcp_service_account"])
            credentials = Credentials.from_service_account_info(creds_dict, scopes=scopes)
            return gspread.authorize(credentials)
    except Exception as e:
        st.error(f"Failed to authenticate with Google Sheets API: {e}")
    return None


def get_spreadsheet():
    """Opens the master Google Spreadsheet using the URL configured in secrets."""
    client = get_gspread_client()
    if client is not None:
        spreadsheet_url = st.secrets.get("spreadsheet_url")
        if spreadsheet_url:
            return client.open_by_url(spreadsheet_url)
    return None


# -----------------------------------------------------------------------------
# Core CRUD Operations
# -----------------------------------------------------------------------------

def read_sheet(sheet_name: str) -> pd.DataFrame:
    """Reads data from a specified worksheet tab into a pandas DataFrame."""
    try:
        sh = get_spreadsheet()
        if sh is None:
            st.error(
                "❌ `get_spreadsheet()` returned `None`. Check that `spreadsheet_url` is defined in `.streamlit/secrets.toml`."
            )
            return pd.DataFrame()

        worksheet = sh.worksheet(sheet_name)
        data = worksheet.get_all_records()
        return pd.DataFrame(data)

    except Exception as e:
        # Displays the EXACT underlying Python exception & traceback on screen
        st.error(f"❌ **EXACT CONNECTION ERROR:** `{type(e).__name__}: {e}`")
        with st.expander("🔍 View Full Traceback"):
            st.code(traceback.format_exc())
        return pd.DataFrame()


def update_cell(sheet_name: str, row_idx: int, col_name: str, value) -> bool:
    """Updates a single cell in the specified sheet tab by row index and column header."""
    try:
        sh = get_spreadsheet()
        if sh:
            worksheet = sh.worksheet(sheet_name)
            headers = worksheet.row_values(1)
            if col_name in headers:
                col_idx = headers.index(col_name) + 1
                # Account for 1-based indexing and header row (+2 offset)
                worksheet.update_cell(row_idx + 2, col_idx, value)
                return True
    except Exception as e:
        st.error(f"Failed to update cell in '{sheet_name}': {e}")
    return False


def append_to_sheet(sheet_name: str, row_data: dict) -> bool:
    """Appends a new row of dictionary data matching worksheet column headers."""
    try:
        sh = get_spreadsheet()
        if sh:
            worksheet = sh.worksheet(sheet_name)
            headers = worksheet.row_values(1)
            row_to_append = [row_data.get(col, "") for col in headers]
            worksheet.append_row(row_to_append)
            return True
    except Exception as e:
        st.error(f"Failed to append row to '{sheet_name}': {e}")
    return False


def update_sheet_row(sheet_name: str, row_idx: int, updated_data: dict) -> bool:
    """Updates an entire row in the specified sheet based on key-value column pairs."""
    try:
        sh = get_spreadsheet()
        if sh:
            worksheet = sh.worksheet(sheet_name)
            headers = worksheet.row_values(1)
            for col_name, value in updated_data.items():
                if col_name in headers:
                    col_idx = headers.index(col_name) + 1
                    worksheet.update_cell(row_idx + 2, col_idx, value)
            return True
    except Exception as e:
        st.error(f"Failed to update row in '{sheet_name}': {e}")
    return False


def delete_sheet_row(sheet_name: str, row_idx: int) -> bool:
    """Deletes a row from the specified sheet tab by DataFrame row index."""
    try:
        sh = get_spreadsheet()
        if sh:
            worksheet = sh.worksheet(sheet_name)
            # Row 0 in DataFrame corresponds to row 2 in Google Sheet (row 1 is header)
            worksheet.delete_rows(row_idx + 2)
            return True
    except Exception as e:
        st.error(f"Failed to delete row from '{sheet_name}': {e}")
    return False


# -----------------------------------------------------------------------------
# Export & Report Generation Helpers
# -----------------------------------------------------------------------------
def generate_excel_download(df: pd.DataFrame) -> bytes:
    """Converts a pandas DataFrame into Excel binary bytes for st.download_button."""
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Sheet1")
    return output.getvalue()


# -----------------------------------------------------------------------------
# Function Aliases & Variable Exports
# Ensures full compatibility across admin.py, supervisor.py, logistics.py, etc.
# -----------------------------------------------------------------------------
# Read operations
load_sheet_data = read_sheet

# Cell updates
update_sheet_cell = update_cell
update_cell_in_sheet = update_cell

# Row updates
update_row_in_sheet = update_sheet_row

# Delete operations
delete_row_from_sheet = delete_sheet_row

# Append operations
append_sheet_row = append_to_sheet
append_row_to_sheet = append_to_sheet


# @st.cache_resource
# def get_credentials():
#     creds_dict = dict(st.secrets["gcp_service_account"])
#     if "private_key" in creds_dict:
#         creds_dict["private_key"] = creds_dict["private_key"].replace("\\n", "\n")
#     return Credentials.from_service_account_info(creds_dict, scopes=SCOPES)

# @st.cache_resource
# def get_gspread_client():
#     creds = get_credentials()
#     return gspread.authorize(creds)

# def get_workbook():
#     client = get_gspread_client()
#     sheet_url = st.secrets.get(
#         "spreadsheet_url",
#         "https://docs.google.com/spreadsheets/d/19rQC3aNtosjhSwyctKAk9ojUt0c8gyOPH-Q8trW5q5s/edit",
#     )
#     return client.open_by_url(sheet_url)

# @st.cache_data(ttl=60)
# def read_sheet(sheet_name: str) -> pd.DataFrame:
#     try:
#         wb = get_workbook()
#         sheet = wb.worksheet(sheet_name)
#         data = sheet.get_all_records()
#         df = pd.DataFrame(data)
        
#         # Privacy protection step for sheet readings
#         if sheet_name == "Workers_Master" and "aadhaar_no" in df.columns:
#             df["aadhaar_no"] = df["aadhaar_no"].astype(str)
            
#         return df
#     except Exception as e:
#         print(f"DEBUG SHEET ERROR [{sheet_name}]: {e}")
#         return pd.DataFrame()

# def append_to_sheet(sheet_name: str, row_data_dict: dict):
#     try:
#         wb = get_workbook()
#         sheet = wb.worksheet(sheet_name)
#         headers = sheet.row_values(1)
#         if not headers:
#             headers = list(row_data_dict.keys())
#             sheet.append_row(headers)
#         row_values = [str(row_data_dict.get(h, "")) for h in headers]
#         sheet.append_row(row_values)
#         st.cache_data.clear()
#     except Exception as e:
#         st.error(f"Error writing to tab '{sheet_name}': {e}")

# def update_sheet_row(sheet_name: str, key_col: str, key_val: str, update_dict: dict) -> bool:
#     try:
#         wb = get_workbook()
#         sheet = wb.worksheet(sheet_name)
#         df = pd.DataFrame(sheet.get_all_records())
#         if df.empty or key_col not in df.columns:
#             return False
#         match_idx = df[df[key_col].astype(str) == str(key_val)].index
#         if match_idx.empty:
#             return False
#         row_num = int(match_idx[0]) + 2
#         headers = sheet.row_values(1)
#         for col_name, new_val in update_dict.items():
#             if col_name in headers:
#                 col_num = headers.index(col_name) + 1
#                 sheet.update_cell(row_num, col_num, str(new_val))
#         st.cache_data.clear()
#         return True
#     except Exception as e:
#         st.error(f"Error updating tab '{sheet_name}': {e}")
#         return False

# def delete_sheet_row(sheet_name: str, key_col: str, key_val: str) -> bool:
#     """Deletes a row matching key_col == key_val from specified sheet."""
#     try:
#         wb = get_workbook()
#         sheet = wb.worksheet(sheet_name)
#         df = pd.DataFrame(sheet.get_all_records())
#         if df.empty or key_col not in df.columns:
#             return False
#         match_idx = df[df[key_col].astype(str).str.strip() == str(key_val).strip()].index
#         if match_idx.empty:
#             return False
#         row_num = int(match_idx[0]) + 2
#         sheet.delete_rows(row_num)
#         st.cache_data.clear()
#         return True
#     except Exception as e:
#         st.error(f"Error deleting row from '{sheet_name}': {e}")
#         return False

# def generate_excel_download(df, filename="report.xlsx"):
#     output = io.BytesIO()
#     with pd.ExcelWriter(output, engine="openpyxl") as writer:
#         df.to_excel(writer, index=False, sheet_name="Sheet1")
#     return output.getvalue()


# @st.cache_resource
# def get_credentials():
#     creds_dict = dict(st.secrets["gcp_service_account"])
#     if "private_key" in creds_dict:
#         creds_dict["private_key"] = creds_dict["private_key"].replace("\\n", "\n")
#     return Credentials.from_service_account_info(creds_dict, scopes=SCOPES)

# @st.cache_resource
# def get_gspread_client():
#     creds = get_credentials()
#     return gspread.authorize(creds)

# def get_workbook():
#     client = get_gspread_client()
#     sheet_url = st.secrets.get(
#         "spreadsheet_url",
#         "https://docs.google.com/spreadsheets/d/19rQC3aNtosjhSwyctKAk9ojUt0c8gyOPH-Q8trW5q5s/edit",
#     )
#     return client.open_by_url(sheet_url)

# @st.cache_data(ttl=60)
# def read_sheet(sheet_name: str) -> pd.DataFrame:
#     try:
#         wb = get_workbook()
#         sheet = wb.worksheet(sheet_name)
#         data = sheet.get_all_records()
#         df = pd.DataFrame(data)
        
#         # Privacy protection step for sheet readings
#         if sheet_name == "Workers_Master" and "aadhaar_no" in df.columns:
#             df["aadhaar_no"] = df["aadhaar_no"].astype(str)
            
#         return df
#     except Exception as e:
#         print(f"DEBUG SHEET ERROR [{sheet_name}]: {e}")
#         return pd.DataFrame()

# def append_to_sheet(sheet_name: str, row_data_dict: dict):
#     try:
#         wb = get_workbook()
#         sheet = wb.worksheet(sheet_name)
#         headers = sheet.row_values(1)
#         if not headers:
#             headers = list(row_data_dict.keys())
#             sheet.append_row(headers)
#         row_values = [str(row_data_dict.get(h, "")) for h in headers]
#         sheet.append_row(row_values)
#         st.cache_data.clear()
#     except Exception as e:
#         st.error(f"Error writing to tab '{sheet_name}': {e}")

# def update_sheet_row(sheet_name: str, key_col: str, key_val: str, update_dict: dict) -> bool:
#     try:
#         wb = get_workbook()
#         sheet = wb.worksheet(sheet_name)
#         df = pd.DataFrame(sheet.get_all_records())
#         if df.empty or key_col not in df.columns:
#             return False
#         match_idx = df[df[key_col].astype(str) == str(key_val)].index
#         if match_idx.empty:
#             return False
#         row_num = int(match_idx[0]) + 2
#         headers = sheet.row_values(1)
#         for col_name, new_val in update_dict.items():
#             if col_name in headers:
#                 col_num = headers.index(col_name) + 1
#                 sheet.update_cell(row_num, col_num, str(new_val))
#         st.cache_data.clear()
#         return True
#     except Exception as e:
#         st.error(f"Error updating tab '{sheet_name}': {e}")
#         return False

# def delete_sheet_row(sheet_name: str, key_col: str, key_val: str) -> bool:
#     """Deletes a row matching key_col == key_val from specified sheet."""
#     try:
#         wb = get_workbook()
#         sheet = wb.worksheet(sheet_name)
#         df = pd.DataFrame(sheet.get_all_records())
#         if df.empty or key_col not in df.columns:
#             return False
#         match_idx = df[df[key_col].astype(str).str.strip() == str(key_val).strip()].index
#         if match_idx.empty:
#             return False
#         row_num = int(match_idx[0]) + 2
#         sheet.delete_rows(row_num)
#         st.cache_data.clear()
#         return True
#     except Exception as e:
#         st.error(f"Error deleting row from '{sheet_name}': {e}")
#         return False

# def generate_excel_download(df, filename="report.xlsx"):
#     output = io.BytesIO()
#     with pd.ExcelWriter(output, engine="openpyxl") as writer:
#         df.to_excel(writer, index=False, sheet_name="Sheet1")
#     return output.getvalue()