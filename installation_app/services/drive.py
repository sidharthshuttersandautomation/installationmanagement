import io
import streamlit as st
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

@st.cache_resource
def get_credentials():
    creds_dict = dict(st.secrets["gcp_service_account"])
    if "private_key" in creds_dict:
        creds_dict["private_key"] = creds_dict["private_key"].replace("\\n", "\n")
    return Credentials.from_service_account_info(creds_dict, scopes=SCOPES)

@st.cache_resource
def get_drive_service():
    creds = get_credentials()
    return build("drive", "v3", credentials=creds)

DRIVE_FOLDER_ID = st.secrets.get("drive_folder_id", "0ADjIFMwZGB62Uk9PVA")

def upload_file_to_drive(uploaded_file, file_name):
    try:
        service = get_drive_service()
        file_metadata = {
            "name": file_name,
            "parents": [DRIVE_FOLDER_ID],
        }
        media = MediaIoBaseUpload(
            io.BytesIO(uploaded_file.getvalue()),
            mimetype=uploaded_file.type,
            resumable=True,
        )
        file = (
            service.files()
            .create(
                body=file_metadata,
                media_body=media,
                fields="id, webViewLink",
                supportsAllDrives=True,
            )
            .execute()
        )
        file_id = file.get("id")
        user_permission = {"type": "anyone", "role": "reader"}
        service.permissions().create(
            fileId=file_id,
            body=user_permission,
            fields="id",
            supportsAllDrives=True,
        ).execute()
        return file.get("webViewLink", "")
    except Exception as e:
        st.error(f"Error uploading image to Google Drive: {e}")
        return "Upload Failed"