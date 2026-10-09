import os
import re
from datetime import datetime
import pandas as pd
import streamlit as st

from installation_app.config import (
    COLOR_PRIMARY,
    COLOR_ACCENT,
    COLOR_BG_LIGHT,
    EMAIL_REGEX,
    TASK_CATEGORIES,
    DELAY_REASONS,
)
from installation_app.services.sheets import read_sheet, append_to_sheet
from installation_app.services.drive import upload_file_to_drive


def apply_global_theme():
    st.markdown(
        f"""
        <style>
        .stApp {{
            background-color: #F4F7FC;
        }}
        h1, h2, h3 {{ 
            color: {COLOR_PRIMARY} !important; 
            font-weight: 700 !important; 
        }}
        .stButton>button {{ 
            background-color: {COLOR_ACCENT} !important; 
            background: {COLOR_ACCENT} !important; 
            color: #FFFFFF !important; 
            border-radius: 8px !important;
            border: none !important;
            font-weight: 700 !important;
            transition: all 0.3s ease !important;
            box-shadow: 0 4px 12px rgba(0, 168, 89, 0.3) !important;
        }}
        .stButton>button * {{
            color: #FFFFFF !important;
            font-weight: 700 !important;
        }}
        .stButton>button:hover {{ 
            background-color: #008747 !important; 
            background: #008747 !important; 
            color: #FFFFFF !important; 
            box-shadow: 0 6px 15px rgba(0, 168, 89, 0.45) !important;
        }}
        .card-box {{ 
            background-color: {COLOR_BG_LIGHT}; 
            border-left: 6px solid {COLOR_PRIMARY}; 
            padding: 18px; 
            border-radius: 8px; 
            margin-bottom: 15px; 
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }}
        .client-card {{
            background-color: #FFFFFF;
            border-left: 5px solid {COLOR_ACCENT};
            padding: 12px 18px;
            border-radius: 8px;
            margin-bottom: 15px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.04);
        }}
        .kpi-card {{
            background-color: #FFFFFF;
            border: 2px solid {COLOR_PRIMARY};
            border-radius: 10px;
            padding: 15px;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            margin-bottom: 10px;
        }}
        .kpi-number {{
            font-size: 28px;
            font-weight: bold;
            color: {COLOR_PRIMARY};
        }}
        .kpi-label {{
            font-size: 13px;
            color: #6C757D;
            font-weight: 600;
        }}
        section[data-testid="stSidebar"] {{
            background-color: #EBF1F8;
        }}
        section[data-testid="stSidebar"] .block-container {{
            padding-top: 1.5rem !important;
            padding-bottom: 1.5rem !important;
        }}
        div[data-testid="stForm"] div[data-baseweb="input"],
        div[data-testid="stForm"] div[data-baseweb="select"] > div {{
            border: 2px solid {COLOR_PRIMARY} !important;
            border-radius: 8px !important;
            background-color: #FFFFFF !important;
        }}
        div[data-testid="stForm"] label {{
            color: {COLOR_PRIMARY} !important;
            font-weight: 700 !important;
        }}
        div[data-testid="stForm"] {{
            background-color: #FFFFFF;
            border: 2px solid {COLOR_PRIMARY};
            border-radius: 16px;
            padding: 24px 18px;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
        }}
        div[data-testid="stFormSubmitButton"] > button {{
            background-color: {COLOR_ACCENT} !important;
            background: {COLOR_ACCENT} !important;
            color: #FFFFFF !important;
            font-weight: 700 !important;
            border-radius: 8px !important;
            padding: 12px 20px !important;
            font-size: 15px !important;
            border: none !important;
            width: 100% !important;
            min-height: 48px !important;
            margin-top: 15px !important;
        }}
        </style>
    """,
        unsafe_allow_html=True,
    )


def validate_email(email_str: str) -> bool:
    """Validates structure of email address."""
    if not email_str:
        return False
    return bool(re.match(EMAIL_REGEX, email_str.strip()))


def generate_work_id(role: str, df_workers: pd.DataFrame) -> str:
    """Auto-generates dynamic Work IDs like ADM01, SPV001, W001, SP001."""
    role_prefix_map = {
        "Admin": "ADM",
        "Supervisor": "SPV",
        "Worker": "W",
        "Salesperson": "SP",
    }

    prefix = role_prefix_map.get(role, "EMP")

    if df_workers.empty or "worker_id" not in df_workers.columns:
        return f"{prefix}01" if prefix == "ADM" else f"{prefix}001"

    existing_ids = df_workers["worker_id"].dropna().astype(str).str.strip()
    role_ids = [uid for uid in existing_ids if uid.startswith(prefix)]

    if not role_ids:
        return f"{prefix}01" if prefix == "ADM" else f"{prefix}001"

    numbers = []
    for uid in role_ids:
        num_part = uid[len(prefix) :]
        if num_part.isdigit():
            numbers.append(int(num_part))

    next_num = max(numbers) + 1 if numbers else 1
    padding = 2 if prefix == "ADM" else 3
    return f"{prefix}{next_num:0{padding}d}"


def format_worker_dropdown_options(df_workers: pd.DataFrame) -> list:
    """Formats worker options with designations for UI drop-downs."""
    if df_workers.empty or "name" not in df_workers.columns:
        return []

    options = []
    for _, row in df_workers.iterrows():
        name = str(row.get("name", "")).strip()
        role = str(row.get("role", "")).strip()
        desig = str(row.get("designation", "")).strip()

        if not name or role in ["Admin", "Salesperson"]:
            continue

        if role == "Worker" and desig:
            options.append(f"{name} ({desig})")
        else:
            options.append(name)

    return sorted(list(set(options)))


def render_kpi_card(title: str, value, delta: str = None):
    """Renders a styled KPI card using HTML or Streamlit native metric."""
    st.markdown(
        f"""
        <div class="kpi-card">
            <div class="kpi-label">{title}</div>
            <div class="kpi-number">{value}</div>
        </div>
    """,
        unsafe_allow_html=True,
    )


@st.dialog("🎉 Order Successfully Executed!")
def show_order_executed_modal(order_id: str, client_name: str, lead_name: str):
    st.balloons()
    st.success(f"**Order ID `{order_id}` has been successfully executed & activated!**")
    st.markdown(
        f"""
        * **Client Name:** {client_name}
        * **Assigned Team Lead:** {lead_name}
        * **Execution Status:** Updated to **In Progress** in Master Database.
        """
    )
    if st.button("Close & Continue", use_container_width=True, key="btn_close_exec_dialog"):
        st.rerun()


@st.dialog("🎉 Daily Log Submitted Successfully!")
def show_upload_success_modal(site_id, day_label, records_count):
    st.write("### Great Job! 🚀")
    st.markdown(
        f"""
        Your **{records_count} task(s)** and photos for **{site_id} ({day_label})** have been uploaded and saved directly to the database.
        
        * All entries have been synchronized.
        * The entry form has been cleared for your next log.
        """
    )
    if st.button("Close & Continue", use_container_width=True, key="btn_close_success_dialog"):
        st.session_state["show_success_modal"] = False
        st.rerun()


def render_restricted_work_input(target_worker_name, is_crew_log=False):
    if st.session_state.get("show_success_modal"):
        m_info = st.session_state.get("modal_info", {})
        show_upload_success_modal(
            m_info.get("site_id", ""),
            m_info.get("day_label", ""),
            m_info.get("count", 1),
        )

    form_version_key = f"form_version_{target_worker_name}_{is_crew_log}"
    if form_version_key not in st.session_state:
        st.session_state[form_version_key] = 0
    v = st.session_state[form_version_key]

    df_sites = read_sheet("Sites_Master")
    df_workers = read_sheet("Workers_Master")
    df_logs = read_sheet("Worker_Daily_Logs")

    valid_site_map = {}
    site_info_dict = {}

    if not df_sites.empty and "installation_id" in df_sites.columns:
        today_date = datetime.now().date()

        for _, s in df_sites.iterrows():
            site_id = str(s.get("installation_id", "")).strip()
            status = str(s.get("status", "")).strip().lower()
            c_name = str(s.get("client_name", "N/A")).strip() or "N/A"
            c_phone = str(s.get("client_phone", "N/A")).strip() or "N/A"
            handover_str = str(s.get("handover_date", "")).strip()

            if status in ["handovered", "handover", "completed"]:
                continue

            if handover_str:
                try:
                    h_date = pd.to_datetime(handover_str).date()
                    if today_date > h_date:
                        continue
                except Exception:
                    pass

            display_label = f"{site_id} — {c_name}"
            valid_site_map[display_label] = site_id
            site_info_dict[site_id] = {
                "client_name": c_name,
                "client_phone": c_phone,
                "city": s.get("site_city", "Jaipur"),
                "address": s.get("site_address", "N/A"),
            }

    if not valid_site_map:
        st.warning("⚠️ No Active Installation Sites Available.")
        return

    header_placeholder = st.empty()

    c_site, c_date = st.columns(2)
    with c_site:
        selected_display_label = st.selectbox(
            "Current Logging for :",
            list(valid_site_map.keys()),
            key=f"site_{target_worker_name}_{is_crew_log}_v{v}",
        )
        selected_site_id = valid_site_map[selected_display_label]

    with c_date:
        log_date = st.date_input(
            "Date of Work",
            value=datetime.now(),
            key=f"date_{target_worker_name}_{is_crew_log}_v{v}",
        )

    site_days_count = 1
    if not df_logs.empty and "installation_id" in df_logs.columns and "logged_date" in df_logs.columns:
        site_logs = df_logs[df_logs["installation_id"] == selected_site_id]
        logged_dates = sorted(site_logs["logged_date"].astype(str).unique())

        cur_date_str = str(log_date)
        if cur_date_str in logged_dates:
            site_days_count = logged_dates.index(cur_date_str) + 1
        else:
            site_days_count = len(logged_dates) + 1

    site_day_label = f"Day {site_days_count}"

    header_placeholder.markdown(f"## 📝 Log Daily Tasks - {selected_site_id} ({site_day_label})")

    site_meta = site_info_dict[selected_site_id]
    st.markdown(
        f"""
        <div class="client-card">
            <span style="font-size:15px; font-weight:700; color:{COLOR_PRIMARY};">🏢 Client Name: {site_meta['client_name']}</span>
            &nbsp;&nbsp;|&nbsp;&nbsp;
            <span style="font-size:15px; font-weight:700; color:{COLOR_ACCENT};">📞 Contact Mobile: <a href="tel:{site_meta['client_phone']}" style="color:{COLOR_ACCENT}; text-decoration:none;">{site_meta['client_phone']}</a></span>
            &nbsp;&nbsp;|&nbsp;&nbsp;
            <span style="font-size:15px; font-weight:700; color:{COLOR_PRIMARY};">📅 Current Timeline: <strong>{site_day_label}</strong></span>
        </div>
    """,
        unsafe_allow_html=True,
    )

    site_city = site_meta["city"]

    worker_options = format_worker_dropdown_options(df_workers)
    if not worker_options:
        worker_options = [target_worker_name]

    st.markdown("### 👥 Crew & Team Assignment")
    col_lead, col_helpers = st.columns(2)

    with col_lead:
        # Find default match
        default_lead_idx = 0
        for idx, w_opt in enumerate(worker_options):
            if target_worker_name in w_opt:
                default_lead_idx = idx
                break

        team_lead_selected = st.selectbox(
            "Team Lead Name *",
            options=worker_options,
            index=default_lead_idx,
            key=f"team_lead_{target_worker_name}_{is_crew_log}_v{v}",
        )

    with col_helpers:
        available_helpers = [w for w in worker_options if w != team_lead_selected]
        team_helpers_selected = st.multiselect(
            "Team Members / Helpers",
            options=available_helpers,
            key=f"helpers_{target_worker_name}_{is_crew_log}_v{v}",
        )

    active_crew = [team_lead_selected] + team_helpers_selected

    st.write("##")
    st.markdown("### 🛠️ Tasks Completed Today")

    task_count_key = f"task_lines_count_{target_worker_name}_{is_crew_log}_v{v}"
    if task_count_key not in st.session_state:
        st.session_state[task_count_key] = 1

    task_entries = []

    for i in range(st.session_state[task_count_key]):
        st.caption(f"**Task Line #{i+1}**")
        col_cat, col_desc, col_assigned, col_hrs, col_min = st.columns([2.5, 3, 2.5, 1.2, 1.2])

        with col_cat:
            cat = st.selectbox(f"Category #{i+1}", TASK_CATEGORIES, key=f"cat_{target_worker_name}_{is_crew_log}_{i}_v{v}")
        with col_desc:
            desc = st.text_input(f"Task #{i+1} Description", placeholder="e.g., Track Leveling", key=f"desc_{target_worker_name}_{is_crew_log}_{i}_v{v}")
        with col_assigned:
            assigned_worker = st.selectbox(f"Assigned To #{i+1}", options=active_crew, key=f"assigned_{target_worker_name}_{is_crew_log}_{i}_v{v}")
        with col_hrs:
            hrs = st.number_input("Hours", min_value=0, max_value=24, value=2, step=1, key=f"hrs_{target_worker_name}_{is_crew_log}_{i}_v{v}")
        with col_min:
            mins = st.selectbox("Minutes", [0, 15, 30, 45], key=f"min_{target_worker_name}_{is_crew_log}_{i}_v{v}")

        task_entries.append({
            "category": cat,
            "description": desc,
            "assigned_worker": assigned_worker,
            "hours": hrs,
            "minutes": mins,
        })

    if st.button("➕ ADD MORE TASK LINES", key=f"add_task_btn_{target_worker_name}_{is_crew_log}_v{v}"):
        st.session_state[task_count_key] += 1
        st.rerun()

    st.divider()

    st.markdown("### ⚠️ Site Remarks / Delays")
    col_delay_cat, col_delay_notes = st.columns([1, 2])

    with col_delay_cat:
        delay_reason = st.selectbox("Primary Delay Category", options=DELAY_REASONS, key=f"delay_reason_{target_worker_name}_{is_crew_log}_v{v}")

    with col_delay_notes:
        site_remarks = st.text_area("Specific Site Notes / Remarks", placeholder="Provide details...", key=f"rem_{target_worker_name}_{is_crew_log}_v{v}")

    st.markdown("### 📷 Site Photo Documentation")
    uploaded_photo = st.file_uploader("Upload Photo of Site", type=["jpg", "jpeg", "png"], key=f"photo_{target_worker_name}_{is_crew_log}_v{v}")

    if uploaded_photo is not None:
        st.image(uploaded_photo, caption="Uploaded Site Photo Preview", width=280)

    st.write("##")

    if st.button("💾 Sync Daily Log to Database", key=f"btn_sync_{target_worker_name}_{is_crew_log}_v{v}", use_container_width=True):
        valid_tasks = [t for t in task_entries if t["description"].strip()]

        if not valid_tasks:
            st.error("Please enter at least one task description before syncing.")
        else:
            photo_link = "No Photo"
            if uploaded_photo is not None:
                photo_name = f"{selected_site_id}_{target_worker_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
                photo_link = upload_file_to_drive(uploaded_photo, photo_name)

            records_saved = 0

            for idx, t in enumerate(valid_tasks):
                clean_worker_name = t["assigned_worker"].split(" (")[0].strip()
                w_base = "Jaipur"
                w_desig = "Worker"

                if not df_workers.empty:
                    m = df_workers[df_workers["name"] == clean_worker_name]
                    if not m.empty:
                        w_base = m.iloc[0].get("base_location", "Jaipur")
                        w_desig = m.iloc[0].get("designation", "Worker")

                w_is_travel = str(w_base).strip().lower() != str(site_city).strip().lower()
                clean_lead_name = team_lead_selected.split(" (")[0].strip()

                log_id = f"LOG-{datetime.now().strftime('%Y%m%d%H%M%S')}-{idx+1}"
                log_entry = {
                    "log_id": log_id,
                    "installation_id": selected_site_id,
                    "site_day": site_day_label,
                    "logged_date": str(log_date),
                    "worker_name": clean_worker_name,
                    "worker_role": w_desig,
                    "team_lead_name": clean_lead_name,
                    "task_category": t["category"],
                    "task_name": t["description"],
                    "hours_spent": t["hours"],
                    "minutes_spent": t["minutes"],
                    "base_location": w_base,
                    "site_city": site_city,
                    "is_travel_day": "Yes" if w_is_travel else "No",
                    "delay_category": delay_reason,
                    "site_remarks": site_remarks,
                    "site_photo": photo_link,
                    "logged_by": target_worker_name,
                }
                append_to_sheet("Worker_Daily_Logs", log_entry)
                records_saved += 1

            if records_saved > 0:
                st.session_state["show_success_modal"] = True
                st.session_state["modal_info"] = {
                    "site_id": selected_site_id,
                    "day_label": site_day_label,
                    "count": records_saved,
                }
                st.session_state[form_version_key] += 1
                st.rerun()


def get_logo_path():
    components_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(components_dir, "..", ".."))
    logo_names = ["Company Logo.jpeg", "Company Logo.jpg", "Company Logo.png", "logo.png", "logo.jpeg", "logo.jpg"]

    for name in logo_names:
        full_path = os.path.join(project_root, name)
        if os.path.exists(full_path):
            return full_path
    return None


def render_header(title: str, subtitle: str = ""):
    """Renders page header with the logo displayed on top-left."""
    logo_path = get_logo_path()
    col1, col2 = st.columns([1, 5])

    with col1:
        if logo_path:
            st.image(logo_path, width=90)
        else:
            st.write("🚪")
    with col2:
        st.title(title)
        if subtitle:
            st.caption(subtitle)
    st.divider()