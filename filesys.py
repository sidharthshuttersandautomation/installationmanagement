import streamlit as st

# Config & Theme Initialization
from installation_app.config import (
    COLOR_PRIMARY,
    COLOR_ACCENT,
    LOGO_PATH,
    init_page,
    apply_custom_css,
    render_sidebar_logo,
)
from installation_app.components.ui import (
    apply_global_theme,
    render_restricted_work_input,
)
from installation_app.services.sheets import read_sheet

# View Module Imports
from installation_app.views.admin import (
    render_executive_dashboard,
    render_sites_overview,
    render_sales_department_reports,
    render_logistics_production_reports,
    render_management_reports,
    render_worker_reports,
    render_budget_reports,
    render_admin_analytics,
    render_sales_analytics,
    render_tada_payroll,
    render_field_logs_inspector,
    render_user_management,
    render_master_database,
)
from installation_app.views.supervisor import (
    render_view_logs_and_update_status,
    render_new_installation_requests,
    render_site_daily_expenses,
    render_handover_dashboard,
    render_active_tasks_dashboard,
    render_team_head_dashboard,
    render_post_handover_ratings,
)
from installation_app.views.salesperson import (
    render_sales_dashboard,
    render_log_visit_and_order,
    render_track_site_progress,
)
from installation_app.views.worker import (
    render_worker_dashboard,
    render_worker_attendance,
    render_worker_history_report,
    render_employee_analytics_reports,
    render_user_profile_settings,
)
from installation_app.views.logistics import render_logistics_view

import asyncio
import sys

# Silence WinError 10054 connection reset noise on Windows
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
def login_screen():
    """Renders authentication & login form with detailed database connection error handling."""
    st.write("##")
    col_l, col_center, col_r = st.columns([1, 1.2, 1])
    with col_center:
        st.markdown(
            '<div style="max-width: 420px; margin: 0 auto;">',
            unsafe_allow_html=True,
        )
        with st.form("login_form"):
            if LOGO_PATH.exists():
                st.image(str(LOGO_PATH), width="stretch")
            else:
                st.markdown(
                    f"""
                    <div style="text-align: center;">
                        <h1 style="color: {COLOR_PRIMARY}; margin: 0; font-size: 26px;">SIDHARTH</h1>
                        <p style="color: {COLOR_ACCENT}; font-weight: bold; margin: 0; font-size: 12px; letter-spacing: 2px;">SHUTTER & AUTOMATION</p>
                    </div>
                """,
                    unsafe_allow_html=True,
                )

            st.caption("Enterprise Operations & Field Portal")

            username_input = st.text_input(
                "Username / Name / Work ID",
                value=st.session_state.get("remembered_username", ""),
                placeholder="e.g. Parvesh Kumar or W001",
            )
            password_input = st.text_input(
                "Password / PIN", type="password", placeholder="Enter password"
            )

            col_chk1, col_chk2 = st.columns(2)
            with col_chk1:
                st.checkbox("Show Password", key="show_password_check")
            with col_chk2:
                remember_me = st.checkbox(
                    "Remember Me",
                    value=bool(
                        st.session_state.get("remembered_username", "")
                    ),
                )

            submit_button = st.form_submit_button(
                "🔑 LOGIN TO DASHBOARD", width="stretch"
            )

            if submit_button:
                if not username_input or not password_input:
                    st.error("Please fill in both Username and Password.")
                else:
                    try:
                        df_workers = read_sheet("Workers_Master")
                        if not df_workers.empty:
                            # Normalize string comparison across worker dataframe columns
                            user_row = df_workers[
                                (
                                    (
                                        df_workers["name"]
                                        .astype(str)
                                        .str.strip()
                                        .str.lower()
                                        == username_input.strip().lower()
                                    )
                                    | (
                                        df_workers["worker_id"]
                                        .astype(str)
                                        .str.strip()
                                        .str.lower()
                                        == username_input.strip().lower()
                                    )
                                )
                                & (
                                    df_workers["pin"].astype(str).str.strip()
                                    == str(password_input).strip()
                                )
                            ]
                            if not user_row.empty:
                                st.session_state.authenticated_user = (
                                    user_row.iloc[0].to_dict()
                                )
                                st.session_state.remembered_username = (
                                    username_input.strip() if remember_me else ""
                                )
                                st.success("Authentication Successful!")
                                st.rerun()
                            else:
                                st.error("Invalid Username or Password.")
                        else:
                            st.error(
                                "⚠️ Could not load records from 'Workers_Master'. Check worksheet tab name and data rows."
                            )
                    except Exception as e:
                        st.error(
                            f"❌ **EXACT CONNECTION ERROR:** `{type(e).__name__}: {e}`"
                        )
                        with st.expander("🔍 View Full Exception Traceback"):
                            st.code(traceback.format_exc())

        st.markdown("</div>", unsafe_allow_html=True)

def main():
    """Main Application Entry Point and Dynamic Role-based Router."""
    # 1. Page Configuration & Theme Injection
    init_page()
    apply_global_theme()
    apply_custom_css()

    # 2. State Initialization
    if "authenticated_user" not in st.session_state:
        st.session_state.authenticated_user = None

    if "remembered_username" not in st.session_state:
        st.session_state.remembered_username = ""

    # 3. Login Check
    if not st.session_state.authenticated_user:
        login_screen()
        return

    # 4. User Context
    user = st.session_state.authenticated_user
    user_name = user.get("name", "User")
    user_role = user.get("role", "Worker")
    user_designation = user.get("designation", user_role)
    user_id = user.get("worker_id", "N/A")
    user_base_location = user.get("base_location", "Jaipur")

    # 5. Sidebar Branding & Profile Summary
    if LOGO_PATH.exists():
        st.sidebar.image(str(LOGO_PATH), width="stretch")
    else:
        render_sidebar_logo()

    st.sidebar.markdown(
        f"**Active User:** {user_name} (`{user_id}`)  \n"
        f"**Designation:** {user_designation}  \n"
        f"**Role:** {user_role}  \n"
        f"**Base Station:** {user_base_location}"
    )
    st.sidebar.divider()

    # 6. Navigation Mapping based on Role
    if user_role == "Admin":
        menu_options = [
            "🏠 Dashboard",
            "🏗️ Active Sites",
            "💹 Sales Reports",
            "🚚 Logistics & Production Reports",
            "🧭 Management Reports",
            "👷 Worker & Employee Reports",
            "💸 Budget Reports",
            "👥 Dynamic User & Access Management",
            "🚗 TA/DA Payroll & Travel Summary",
            "🕵️ Advanced Field Logs Inspector",
            "🛢️ Master Database",
        ]
    elif user_role == "Salesperson":
        menu_options = [
            "💼 My Sales Dashboard",
            "📝 Log Visit & Order Deal",
            "🔍 Track Site Progress",
            "👤 My Profile & Settings",
        ]
    elif user_role == "Supervisor":
        menu_options = [
            "🔔 New Installation Requests",
            "✍️ Log Daily Tasks",
            "💰 Log Site Daily Expenses",
            "🔍 View Logs & Update Status",
            "🗓️ Handover Date Dashboard",
            "📌 Active Tasks Dashboard",
            "👨‍💼 Employee Analytics & Availability",
            "👨‍🏫 Team Head Dashboard",
            "⭐ Site QA & Handover Ratings",
        ]
    elif user_role in ("Logistics Coordinator", "Logistics Manager", "Production Manager"):
        menu_options = [
            "🚚 Dispatch & Order Logistics Portal",
            "🔔 Orders Ready for Dispatch",
            "📞 Coordination & Notes",
            "👤 My Profile & Settings",
        ]
    elif user_role == "Budget Manager":
        menu_options = [
            "💸 Budget Reports",
            "👤 My Profile & Settings",
        ]
    else:  # Worker
        menu_options = [
            "📊 My Work Dashboard",
            "✍️ Log Daily Tasks",
            "🏆 My Work History & Performance",
            "👤 My Profile & Settings",
        ]

    menu = st.sidebar.radio("Navigation Menu", menu_options)
    st.sidebar.divider()

    if st.sidebar.button("🚪 LOG OUT", width="stretch"):
        st.session_state.authenticated_user = None
        st.rerun()

    # 7. Router Execution
    # Admin Views
    if menu == "🏠 Dashboard":
        render_executive_dashboard()
    elif menu == "🏗️ Active Sites":
        render_sites_overview()
    elif menu == "💹 Sales Reports":
        render_sales_department_reports()
    elif menu == "🚚 Logistics & Production Reports":
        render_logistics_production_reports()
    elif menu == "🧭 Management Reports":
        render_management_reports()
    elif menu == "👷 Worker & Employee Reports":
        render_employee_analytics_reports()
    elif menu == "💸 Budget Reports":
        render_budget_reports()
    elif menu == "👨‍💼 Employee Analytics & Availability":
        render_employee_analytics_reports()
    elif menu == "👥 Dynamic User & Access Management":
        render_user_management()
    elif menu == "🚗 TA/DA Payroll & Travel Summary":
        render_tada_payroll()
    elif menu == "🕵️ Advanced Field Logs Inspector":
        render_field_logs_inspector()
    elif user_role == "Admin" and menu == "🛢️ Master Database":
        render_master_database()

    # Supervisor Views
    elif menu == "🔔 New Installation Requests":
        render_new_installation_requests()
    elif menu == "💰 Log Site Daily Expenses":
        render_site_daily_expenses(user_name)
    elif menu == "🔍 View Logs & Update Status":
        render_view_logs_and_update_status()
    elif menu == "🗓️ Handover Date Dashboard":
        render_handover_dashboard()
    elif menu == "📌 Active Tasks Dashboard":
        render_active_tasks_dashboard()
    elif menu == "👨‍🏫 Team Head Dashboard":
        render_team_head_dashboard(user_name)
    elif menu == "⭐ Site QA & Handover Ratings":
        render_post_handover_ratings(user_name)

    # Salesperson Views
    elif menu == "💼 My Sales Dashboard":
        render_sales_dashboard(user_name, user_id, user_role)
    elif menu == "📝 Log Visit & Order Deal":
        render_log_visit_and_order(user_name, user_id, user_base_location)
    elif menu == "🔍 Track Site Progress":
        render_track_site_progress(user_name, user_id, user_role)

    elif menu == "👤 My Profile & Settings":
        render_user_profile_settings(
            user,
            user_name,
            user_id,
            user_role,
            user_designation,
            user_base_location,
        )

    # Logistics and production views
    elif user_role in ("Logistics Coordinator", "Logistics Manager", "Production Manager"):
        render_logistics_view(menu, user)

    # Worker Views
    elif menu == "📊 My Work Dashboard":
        render_worker_dashboard(user_name, user_designation, user_id)
    elif menu == "✍️ Log Daily Tasks":
        if user_role == "Worker":
            render_worker_attendance(user_name, user_id)
        render_restricted_work_input(
            target_worker_name=user_name, is_crew_log=False
        )
    elif menu == "🏆 My Work History & Performance":
        render_worker_history_report(user_name)
    elif menu == "👤 My Profile & Settings":
        render_user_profile_settings(
            user,
            user_name,
            user_id,
            user_role,
            user_designation,
            user_base_location,
        )


if __name__ == "__main__":
    main()