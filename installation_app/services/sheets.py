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
    """Reads data from a specified worksheet tab into a pandas DataFrame safely,

    handling duplicate column headers and trailing blank columns.
    """
    try:
        sh = get_spreadsheet()
        if sh is None:
            st.error(
                "❌ `get_spreadsheet()` returned `None`. Check `.streamlit/secrets.toml` structure."
            )
            return pd.DataFrame()

        worksheet = sh.worksheet(sheet_name)

        # 1. Fetch raw matrix values (avoids get_all_records duplicate header crashes)
        raw_data = worksheet.get_all_values()

        if not raw_data or len(raw_data) < 1:
            return pd.DataFrame()

        # 2. Extract header row (row 0) and data rows
        headers = [str(h).strip() for h in raw_data[0]]
        data = raw_data[1:]

        # 3. Build initial DataFrame
        df = pd.DataFrame(data, columns=headers)

        # 4. Remove empty column names (caused by extra trailing empty columns)
        df = df.loc[:, df.columns != ""]

        # 5. Automatically remove duplicate columns if duplicate headers exist
        df = df.loc[:, ~df.columns.duplicated()]

        return df

    except Exception as e:
        st.error(
            f"❌ **EXACT CONNECTION ERROR (`{sheet_name}`):** `{type(e).__name__}: {e}`"
        )
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


def ensure_sheet_columns(sheet_name: str, column_names) -> bool:
    """Add explicitly requested headers to an existing worksheet when missing."""
    try:
        sh = get_spreadsheet()
        if sh is None:
            st.error("Cannot update the sheet schema because the Google Sheets connection is unavailable.")
            return False

        worksheet = sh.worksheet(sheet_name)
        headers = [str(header).strip() for header in worksheet.row_values(1)]
        if not headers:
            st.error(f"Cannot add columns because '{sheet_name}' has no header row.")
            return False

        missing_columns = [
            str(column_name).strip()
            for column_name in column_names
            if str(column_name).strip() and str(column_name).strip() not in headers
        ]
        columns_needed = len(headers) + len(missing_columns)
        if columns_needed > worksheet.col_count:
            worksheet.add_cols(columns_needed - worksheet.col_count)
        for column_name in missing_columns:
            name = str(column_name).strip()
            worksheet.update_cell(1, len(headers) + 1, name)
            headers.append(name)
        return True
    except Exception as e:
        st.error(f"Failed to add columns to '{sheet_name}': {type(e).__name__}: {e}")
        return False


def append_to_sheet(sheet_name: str, row_data: dict, ensure_columns: bool = False) -> bool:
    """Appends a new row of dictionary data matching worksheet column headers."""
    try:
        sh = get_spreadsheet()
        if sh:
            worksheet = sh.worksheet(sheet_name)
            headers = worksheet.row_values(1)
            missing_columns = [
                column for column in row_data if column not in headers
            ]
            if missing_columns and ensure_columns:
                columns_needed = len(headers) + len(missing_columns)
                if columns_needed > worksheet.col_count:
                    worksheet.add_cols(columns_needed - worksheet.col_count)
                for column in missing_columns:
                    worksheet.update_cell(1, len(headers) + 1, column)
                    headers.append(column)
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


def update_sheet_record(
    sheet_name: str,
    key_column: str,
    key_value: str,
    updated_data: dict,
    ensure_columns: bool = False,
) -> bool:
    """Updates a sheet record by a unique key column and returns an explicit result."""
    try:
        sh = get_spreadsheet()
        if sh is None:
            st.error("Cannot update the record because the Google Sheets connection is unavailable.")
            return False

        worksheet = sh.worksheet(sheet_name)
        rows = worksheet.get_all_values()
        if not rows:
            st.error(f"Cannot update the record because '{sheet_name}' has no header row.")
            return False

        headers = [str(header).strip() for header in rows[0]]
        if key_column not in headers:
            st.error(f"Cannot update the record because '{key_column}' is not a column in '{sheet_name}'.")
            return False

        key_index = headers.index(key_column)
        matches = [
            row_index + 2
            for row_index, row in enumerate(rows[1:])
            if len(row) > key_index and str(row[key_index]).strip() == str(key_value).strip()
        ]
        if len(matches) != 1:
            st.error(
                f"Expected one '{sheet_name}' record for {key_column}='{key_value}', found {len(matches)}."
            )
            return False

        missing_columns = [column for column in updated_data if column not in headers]
        if missing_columns and ensure_columns:
            columns_needed = len(headers) + len(missing_columns)
            if columns_needed > worksheet.col_count:
                worksheet.add_cols(columns_needed - worksheet.col_count)
            for column in missing_columns:
                worksheet.update_cell(1, len(headers) + 1, column)
                headers.append(column)

        target_row = matches[0]
        editable_columns = [
            (headers.index(column) + 1, value)
            for column, value in updated_data.items()
            if column in headers
        ]
        if not editable_columns:
            st.error(f"No requested fields exist as columns in '{sheet_name}'.")
            return False

        for column_index, value in editable_columns:
            worksheet.update_cell(target_row, column_index, value)
        return True
    except Exception as e:
        st.error(f"Failed to update record in '{sheet_name}': {type(e).__name__}: {e}")
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
def generate_excel_download(
    df: pd.DataFrame, filename: str = "Export.xlsx"
) -> bytes:
    """Generates an in-memory Excel file bytes buffer from a pandas DataFrame."""
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Logs")
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