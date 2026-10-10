import io
import pandas as pd
import streamlit as st
from sqlalchemy import text
import gspread
from google.oauth2.service_account import Credentials

import traceback
# -----------------------------------------------------------------------------
# Google Sheets Connection Helper
# -----------------------------------------------------------------------------
def get_gspread_client():
    """Initializes native Streamlit SQL connection to Supabase PostgreSQL."""
    return st.connection("postgresql", type="sql")


# @st.cache_resource
# def get_gspread_client():
#     """Authenticates with Google Sheets API using GCP service account credentials in st.secrets."""
#     scopes = [
#         "https://www.googleapis.com/auth/spreadsheets",
#         "https://www.googleapis.com/auth/drive",
#     ]
#     try:
#         if "gcp_service_account" in st.secrets:
#             creds_dict = dict(st.secrets["gcp_service_account"])
#             credentials = Credentials.from_service_account_info(creds_dict, scopes=scopes)
#             return gspread.authorize(credentials)
#     except Exception as e:
#         st.error(f"Failed to authenticate with Google Sheets API: {e}")
#     return None

def get_spreadsheet():
    """Initializes and returns the native Streamlit SQL database connection engine.
    
    Kept with original name for full backward compatibility across the application.
    """
    try:
        return st.connection("postgresql", type="sql")
    except Exception as e:
        st.error(f"Failed to connect to Supabase database: {e}")
        return None

# def get_spreadsheet():
#     """Opens the master Google Spreadsheet using the URL configured in secrets."""
#     client = get_gspread_client()
#     if client is not None:
#         spreadsheet_url = st.secrets.get("spreadsheet_url")
#         if spreadsheet_url:
#             return client.open_by_url(spreadsheet_url)
#     return None


# -----------------------------------------------------------------------------
# Core CRUD Operations
# -----------------------------------------------------------------------------

@st.cache_data(ttl=60)
def read_sheet(sheet_name: str) -> pd.DataFrame:
    """Reads a table from Supabase PostgreSQL into a Pandas DataFrame."""
    try:
        conn = get_spreadsheet()
        if conn is None:
            return pd.DataFrame()

        # Enclosing in double quotes preserves exact case sensitivity
        df = conn.query(f'SELECT * FROM "{sheet_name}";', ttl=0)

        if df.empty:
            return pd.DataFrame()

        # Clean column headers
        df.columns = [str(col).strip() for col in df.columns]
        return df
    except Exception as e:
        st.error(f"❌ Connection error loading '{sheet_name}': {e}")
        return pd.DataFrame()


# @st.cache_data(ttl=60)
# def read_sheet(sheet_name: str) -> pd.DataFrame:
#     """Reads data from a specified Supabase PostgreSQL table into a pandas DataFrame safely."""
#     try:
#         conn = get_spreadsheet()
#         if conn is None:
#             st.error("❌ Database connection failed. Check `.streamlit/secrets.toml` structure.")
#             return pd.DataFrame()

#         # Enclosing table_name in double quotes preserves exact casing in Postgres
#         df = conn.query(f'SELECT * FROM "{sheet_name}";', ttl=0)

#         if df.empty:
#             return pd.DataFrame()

#         # 1. Ensure string column headers with whitespace stripped
#         df.columns = [str(col).strip() for col in df.columns]

#         # 2. Automatically remove empty column names
#         df = df.loc[:, df.columns != ""]

#         # 3. Automatically remove duplicate columns if duplicate headers exist
#         df = df.loc[:, ~df.columns.duplicated()]

#         return df

#     except Exception as e:
#         st.error(
#             f"❌ **EXACT CONNECTION ERROR (`{sheet_name}`):** `{type(e).__name__}: {e}`"
#         )
#         with st.expander("🔍 View Full Traceback"):
#             st.code(traceback.format_exc())
#         return pd.DataFrame()
    
# @st.cache_data(ttl=120)
# def read_sheet(sheet_name: str) -> pd.DataFrame:
#     """Reads data from a specified worksheet tab into a pandas DataFrame safely,

#     handling duplicate column headers and trailing blank columns.
#     """
#     try:
#         sh = get_spreadsheet()
#         if sh is None:
#             st.error(
#                 "❌ `get_spreadsheet()` returned `None`. Check `.streamlit/secrets.toml` structure."
#             )
#             return pd.DataFrame()

#         worksheet = sh.worksheet(sheet_name)

#         # 1. Fetch raw matrix values (avoids get_all_records duplicate header crashes)
#         raw_data = worksheet.get_all_values()

#         if not raw_data or len(raw_data) < 1:
#             return pd.DataFrame()

#         # 2. Extract header row (row 0) and data rows
#         headers = [str(h).strip() for h in raw_data[0]]
#         data = raw_data[1:]

#         # 3. Build initial DataFrame
#         df = pd.DataFrame(data, columns=headers)

#         # 4. Remove empty column names (caused by extra trailing empty columns)
#         df = df.loc[:, df.columns != ""]

#         # 5. Automatically remove duplicate columns if duplicate headers exist
#         df = df.loc[:, ~df.columns.duplicated()]

#         return df

#     except Exception as e:
#         st.error(
#             f"❌ **EXACT CONNECTION ERROR (`{sheet_name}`):** `{type(e).__name__}: {e}`"
#         )
#         with st.expander("🔍 View Full Traceback"):
#             st.code(traceback.format_exc())
#         return pd.DataFrame()

def update_cell(sheet_name: str, row_idx: int, col_name: str, value, key_column: str = None, key_value = None) -> bool:
    """Updates a single column/cell value in Supabase PostgreSQL by key or row position."""
    try:
        conn = get_spreadsheet()
        if conn is None:
            return False

        # 1. Primary path: Update by explicit key column if provided
        if key_column and key_value is not None:
            sql_query = f'UPDATE "{sheet_name}" SET "{col_name}" = :val WHERE "{key_column}" = :key_val;'
            params = {"val": value, "key_val": str(key_value)}
        else:
            # 2. Fallback path: Determine primary key dynamically or update by row offset
            pk_map = {
                "Workers_Master": "worker_id",
                "Sites_Master": "installation_id",
                "Expense_Logs": "exp_id",
                "Worker_Daily_Logs": "log_id",
                "Task_Assignments": "task_id",
            }
            pk_col = pk_map.get(sheet_name)

            if pk_col:
                # Fetch row at index to get primary key value
                df = conn.query(f'SELECT "{pk_col}" FROM "{sheet_name}" OFFSET :offset LIMIT 1;', params={"offset": row_idx}, ttl=0)
                if df.empty:
                    st.error(f"Failed to locate row at index {row_idx} in '{sheet_name}'.")
                    return False
                target_key = df.iloc[0][pk_col]
                sql_query = f'UPDATE "{sheet_name}" SET "{col_name}" = :val WHERE "{pk_col}" = :target_key;'
                params = {"val": value, "target_key": target_key}
            else:
                # Direct SQL positional update if table primary key is unknown
                sql_query = f'UPDATE "{sheet_name}" SET "{col_name}" = :val WHERE ctid IN (SELECT ctid FROM "{sheet_name}" OFFSET :offset LIMIT 1);'
                params = {"val": value, "offset": row_idx}

        with conn.session as s:
            s.execute(text(sql_query), params)
            s.commit()

        st.cache_data.clear()
        return True
    except Exception as e:
        st.error(f"Failed to update cell in '{sheet_name}': {e}")
        return False
    
# def update_cell(sheet_name: str, row_idx: int, col_name: str, value) -> bool:
#     """Updates a single cell in the specified sheet tab by row index and column header."""
#     try:
#         sh = get_spreadsheet()
#         if sh:
#             worksheet = sh.worksheet(sheet_name)
#             headers = worksheet.row_values(1)
#             if col_name in headers:
#                 col_idx = headers.index(col_name) + 1
#                 # Account for 1-based indexing and header row (+2 offset)
#                 worksheet.update_cell(row_idx + 2, col_idx, value)
#                 return True
#     except Exception as e:
#         st.error(f"Failed to update cell in '{sheet_name}': {e}")
#     return False

def ensure_sheet_columns(sheet_name: str, column_names) -> bool:
    """Adds missing columns dynamically to a Supabase PostgreSQL table using ALTER TABLE."""
    try:
        conn = get_spreadsheet()
        if conn is None:
            st.error("Cannot update table schema because database connection is unavailable.")
            return False

        # Fetch existing column headers from PostgreSQL table
        existing_df = conn.query(f'SELECT * FROM "{sheet_name}" LIMIT 0;', ttl=0)
        existing_cols = set(existing_df.columns)

        missing_columns = [
            str(col_name).strip()
            for col_name in column_names
            if str(col_name).strip() and str(col_name).strip() not in existing_cols
        ]

        if not missing_columns:
            return True

        # Dynamically execute ALTER TABLE ADD COLUMN for any missing columns
        with conn.session as s:
            for col_name in missing_columns:
                sql_query = f'ALTER TABLE "{sheet_name}" ADD COLUMN IF NOT EXISTS "{col_name}" TEXT;'
                s.execute(text(sql_query))
            s.commit()

        st.cache_data.clear()
        return True
    except Exception as e:
        st.error(f"Failed to add columns to '{sheet_name}': {type(e).__name__}: {e}")
        return False
    
# def ensure_sheet_columns(sheet_name: str, column_names) -> bool:
#     """Add explicitly requested headers to an existing worksheet when missing."""
#     try:
#         sh = get_spreadsheet()
#         if sh is None:
#             st.error("Cannot update the sheet schema because the Google Sheets connection is unavailable.")
#             return False

#         worksheet = sh.worksheet(sheet_name)
#         headers = [str(header).strip() for header in worksheet.row_values(1)]
#         if not headers:
#             st.error(f"Cannot add columns because '{sheet_name}' has no header row.")
#             return False

#         missing_columns = [
#             str(column_name).strip()
#             for column_name in column_names
#             if str(column_name).strip() and str(column_name).strip() not in headers
#         ]
#         columns_needed = len(headers) + len(missing_columns)
#         if columns_needed > worksheet.col_count:
#             worksheet.add_cols(columns_needed - worksheet.col_count)
#         for column_name in missing_columns:
#             name = str(column_name).strip()
#             worksheet.update_cell(1, len(headers) + 1, name)
#             headers.append(name)
#         return True
#     except Exception as e:
#         st.error(f"Failed to add columns to '{sheet_name}': {type(e).__name__}: {e}")
#         return False

def append_to_sheet(sheet_name: str, row_data: dict, ensure_columns: bool = False) -> bool:
    """Appends a new row of dictionary data directly to a Supabase PostgreSQL table."""
    try:
        if not row_data:
            return False

        conn = get_spreadsheet()
        if conn is None:
            return False

        # 1. Optionally verify and add missing columns to the table schema
        if ensure_columns:
            ensure_sheet_columns(sheet_name, list(row_data.keys()))

        # 2. Build parametrized INSERT statement
        cols = list(row_data.keys())
        col_names = ", ".join([f'"{c}"' for c in cols])
        params_str = ", ".join([f":{c}" for c in cols])

        sql_query = f'INSERT INTO "{sheet_name}" ({col_names}) VALUES ({params_str});'

        # 3. Execute query and commit transaction
        with conn.session as s:
            s.execute(text(sql_query), row_data)
            s.commit()

        # 4. Clear Streamlit cache so new data reflects immediately
        st.cache_data.clear()
        return True

    except Exception as e:
        st.error(f"Failed to append row to '{sheet_name}': {e}")
        return False
    
# def append_to_sheet(sheet_name: str, row_data: dict, ensure_columns: bool = False) -> bool:
#     """Appends a new row of dictionary data matching worksheet column headers."""
#     try:
#         sh = get_spreadsheet()
#         if sh:
#             worksheet = sh.worksheet(sheet_name)
#             headers = worksheet.row_values(1)
#             missing_columns = [
#                 column for column in row_data if column not in headers
#             ]
#             if missing_columns and ensure_columns:
#                 columns_needed = len(headers) + len(missing_columns)
#                 if columns_needed > worksheet.col_count:
#                     worksheet.add_cols(columns_needed - worksheet.col_count)
#                 for column in missing_columns:
#                     worksheet.update_cell(1, len(headers) + 1, column)
#                     headers.append(column)
#             row_to_append = [row_data.get(col, "") for col in headers]
#             worksheet.append_row(row_to_append)
           
#             # Clear Streamlit's read cache so new data reflects immediately
#             st.cache_data.clear()
#             return True
#     except Exception as e:
#         st.error(f"Failed to append row to '{sheet_name}': {e}")
#     return False

def update_sheet_row(
    sheet_name: str,
    row_idx: int,
    updated_data: dict,
    key_column: str = None,
    key_value=None,
) -> bool:
    """Updates specific columns for a row in Supabase PostgreSQL by key or row position."""
    try:
        if not updated_data:
            return True

        conn = get_spreadsheet()
        if conn is None:
            return False

        # Build parameterized SET clauses
        set_clauses = ", ".join([f'"{col}" = :{col}' for col in updated_data.keys()])

        # 1. Primary path: Update by explicit key column if provided
        if key_column and key_value is not None:
            sql_query = (
                f'UPDATE "{sheet_name}" SET {set_clauses} WHERE "{key_column}" = :key_val;'
            )
            params = updated_data.copy()
            params["key_val"] = str(key_value)
        else:
            # 2. Fallback path: Match table primary key by row position offset
            pk_map = {
                "Workers_Master": "worker_id",
                "Sites_Master": "installation_id",
                "Expense_Logs": "exp_id",
                "Worker_Daily_Logs": "log_id",
                "Task_Assignments": "task_id",
            }
            pk_col = pk_map.get(sheet_name)

            if pk_col:
                df = conn.query(
                    f'SELECT "{pk_col}" FROM "{sheet_name}" OFFSET :offset LIMIT 1;',
                    params={"offset": row_idx},
                    ttl=0,
                )
                if df.empty:
                    st.error(
                        f"Failed to locate row at index {row_idx} in '{sheet_name}'."
                    )
                    return False
                target_key = df.iloc[0][pk_col]
                sql_query = f'UPDATE "{sheet_name}" SET {set_clauses} WHERE "{pk_col}" = :target_key;'
                params = updated_data.copy()
                params["target_key"] = target_key
            else:
                # Direct SQL positional update if table primary key is unknown
                sql_query = f'UPDATE "{sheet_name}" SET {set_clauses} WHERE ctid IN (SELECT ctid FROM "{sheet_name}" OFFSET :offset LIMIT 1);'
                params = updated_data.copy()
                params["offset"] = row_idx

        with conn.session as s:
            s.execute(text(sql_query), params)
            s.commit()

        st.cache_data.clear()
        return True

    except Exception as e:
        st.error(f"Failed to update row in '{sheet_name}': {e}")
        return False

# def update_sheet_row(sheet_name: str, row_idx: int, updated_data: dict) -> bool:
#     """Updates an entire row in the specified sheet based on key-value column pairs."""
#     try:
#         sh = get_spreadsheet()
#         if sh:
#             worksheet = sh.worksheet(sheet_name)
#             headers = worksheet.row_values(1)
#             for col_name, value in updated_data.items():
#                 if col_name in headers:
#                     col_idx = headers.index(col_name) + 1
#                     worksheet.update_cell(row_idx + 2, col_idx, value)
#             return True
#     except Exception as e:
#         st.error(f"Failed to update row in '{sheet_name}': {e}")
#     return False

def update_sheet_record(
    sheet_name: str,
    key_column: str,
    key_value: str,
    updated_data: dict,
    ensure_columns: bool = False,
) -> bool:
    """Updates a sheet record by a unique key column in Supabase PostgreSQL and returns an explicit result."""
    try:
        if not updated_data:
            return True

        conn = get_spreadsheet()
        if conn is None:
            st.error("Cannot update the record because the database connection is unavailable.")
            return False

        # 1. Optionally handle missing column additions if ensure_columns is set
        if ensure_columns:
            ensure_sheet_columns(sheet_name, list(updated_data.keys()))

        # 2. Build parameterized SET statement
        set_clauses = ", ".join([f'"{col}" = :{col}' for col in updated_data.keys()])
        sql_query = f'UPDATE "{sheet_name}" SET {set_clauses} WHERE "{key_column}" = :key_val;'

        params = updated_data.copy()
        params["key_val"] = str(key_value)

        # 3. Execute update inside transaction
        with conn.session as s:
            result = s.execute(text(sql_query), params)
            s.commit()

        # Clear Streamlit cache so changes reflect instantly
        st.cache_data.clear()
        return True

    except Exception as e:
        st.error(f"Failed to update record in '{sheet_name}': {type(e).__name__}: {e}")
        return False
    
# def update_sheet_record(
#     sheet_name: str,
#     key_column: str,
#     key_value: str,
#     updated_data: dict,
#     ensure_columns: bool = False,
# ) -> bool:
#     """Updates a sheet record by a unique key column and returns an explicit result."""
#     try:
#         sh = get_spreadsheet()
#         if sh is None:
#             st.error("Cannot update the record because the Google Sheets connection is unavailable.")
#             return False

#         worksheet = sh.worksheet(sheet_name)
#         rows = worksheet.get_all_values()
#         if not rows:
#             st.error(f"Cannot update the record because '{sheet_name}' has no header row.")
#             return False

#         headers = [str(header).strip() for header in rows[0]]
#         if key_column not in headers:
#             st.error(f"Cannot update the record because '{key_column}' is not a column in '{sheet_name}'.")
#             return False

#         key_index = headers.index(key_column)
#         matches = [
#             row_index + 2
#             for row_index, row in enumerate(rows[1:])
#             if len(row) > key_index and str(row[key_index]).strip() == str(key_value).strip()
#         ]
#         if len(matches) != 1:
#             st.error(
#                 f"Expected one '{sheet_name}' record for {key_column}='{key_value}', found {len(matches)}."
#             )
#             return False

#         missing_columns = [column for column in updated_data if column not in headers]
#         if missing_columns and ensure_columns:
#             columns_needed = len(headers) + len(missing_columns)
#             if columns_needed > worksheet.col_count:
#                 worksheet.add_cols(columns_needed - worksheet.col_count)
#             for column in missing_columns:
#                 worksheet.update_cell(1, len(headers) + 1, column)
#                 headers.append(column)

#         target_row = matches[0]
#         editable_columns = [
#             (headers.index(column) + 1, value)
#             for column, value in updated_data.items()
#             if column in headers
#         ]
#         if not editable_columns:
#             st.error(f"No requested fields exist as columns in '{sheet_name}'.")
#             return False

#         for column_index, value in editable_columns:
#             worksheet.update_cell(target_row, column_index, value)
#         return True
#     except Exception as e:
#         st.error(f"Failed to update record in '{sheet_name}': {type(e).__name__}: {e}")
#         return False

def delete_sheet_row(
    sheet_name: str,
    row_idx: int = None,
    key_column: str = None,
    key_value=None,
) -> bool:
    """Deletes a row from Supabase PostgreSQL by key or row position."""
    try:
        conn = get_spreadsheet()
        if conn is None:
            return False

        # 1. Primary path: Delete by explicit key column if provided
        if key_column and key_value is not None:
            sql_query = f'DELETE FROM "{sheet_name}" WHERE "{key_column}" = :key_val;'
            params = {"key_val": str(key_value)}

        # 2. Fallback path: Match table primary key by row position offset
        elif row_idx is not None:
            pk_map = {
                "Workers_Master": "worker_id",
                "Sites_Master": "installation_id",
                "Expense_Logs": "exp_id",
                "Worker_Daily_Logs": "log_id",
                "Task_Assignments": "task_id",
            }
            pk_col = pk_map.get(sheet_name)

            if pk_col:
                df = conn.query(
                    f'SELECT "{pk_col}" FROM "{sheet_name}" OFFSET :offset LIMIT 1;',
                    params={"offset": row_idx},
                    ttl=0,
                )
                if df.empty:
                    st.error(
                        f"Failed to locate row at index {row_idx} in '{sheet_name}'."
                    )
                    return False
                target_key = df.iloc[0][pk_col]
                sql_query = f'DELETE FROM "{sheet_name}" WHERE "{pk_col}" = :target_key;'
                params = {"target_key": target_key}
            else:
                # Direct SQL positional delete if primary key is unknown
                sql_query = f'DELETE FROM "{sheet_name}" WHERE ctid IN (SELECT ctid FROM "{sheet_name}" OFFSET :offset LIMIT 1);'
                params = {"offset": row_idx}
        else:
            st.error("Either row_idx or key_column/key_value must be provided.")
            return False

        with conn.session as s:
            s.execute(text(sql_query), params)
            s.commit()

        st.cache_data.clear()
        return True

    except Exception as e:
        st.error(f"Failed to delete row from '{sheet_name}': {e}")
        return False

# def delete_sheet_row(sheet_name: str, row_idx: int) -> bool:
#     """Deletes a row from the specified sheet tab by DataFrame row index."""
#     try:
#         sh = get_spreadsheet()
#         if sh:
#             worksheet = sh.worksheet(sheet_name)
#             # Row 0 in DataFrame corresponds to row 2 in Google Sheet (row 1 is header)
#             worksheet.delete_rows(row_idx + 2)
#             return True
#     except Exception as e:
#         st.error(f"Failed to delete row from '{sheet_name}': {e}")
#     return False


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

# def generate_excel_download(
#     df: pd.DataFrame, filename: str = "Export.xlsx"
# ) -> bytes:
#     """Generates an in-memory Excel file bytes buffer from a pandas DataFrame."""
#     output = io.BytesIO()
#     with pd.ExcelWriter(output, engine="openpyxl") as writer:
#         df.to_excel(writer, index=False, sheet_name="Logs")
#     return output.getvalue()

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