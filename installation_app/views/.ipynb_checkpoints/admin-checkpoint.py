from datetime import datetime, timedelta
import pandas as pd
import plotly.express as px
import streamlit as st

from installation_app.config import WORKER_DESIGNATIONS
from installation_app.services.sheets import (
    read_sheet,
    append_to_sheet,
    update_sheet_row,
    delete_sheet_row,
    generate_excel_download,
)
from installation_app.components.ui import (
    generate_work_id,
    validate_email,
)

def render_admin_analytics():
    st.header("📊 Admin Operations & Dynamic Expense Analytics")

    df_logs = read_sheet("Worker_Daily_Logs")
    df_expenses = read_sheet("Expense_Logs")
    df_sites = read_sheet("Sites_Master")

    active_site_ids = []
    if not df_sites.empty and "installation_id" in df_sites.columns:
        df_sites_copy = df_sites.copy()
        df_sites_copy.columns = [str(col).strip().lower().replace(" ", "_") for col in df_sites_copy.columns]
        
        running_sites = df_sites_copy[
            ~df_sites_copy["status"].astype(str).str.strip().str.title().isin(["Handovered", "Handover", "Completed"])
        ]
        active_site_ids = running_sites["installation_id"].unique().tolist()

    if not df_logs.empty and active_site_ids:
        df_logs = df_logs[df_logs["installation_id"].isin(active_site_ids)]

    if df_logs.empty and df_expenses.empty:
        st.info("No active log or expense data available for running sites.")
    else:
        sites_visited = df_logs["installation_id"].nunique() if "installation_id" in df_logs.columns else 0
        days_worked = df_logs["logged_date"].nunique() if "logged_date" in df_logs.columns else 0
        days_travelled = len(df_logs[df_logs["is_travel_day"] == "Yes"]) if "is_travel_day" in df_logs.columns else 0

        active_expenses = df_expenses[df_expenses["installation_id"].isin(active_site_ids)] if not df_expenses.empty and "installation_id" in df_expenses.columns else pd.DataFrame()

        travel_exp = (
            pd.to_numeric(active_expenses["travel_expense"], errors="coerce").sum() 
            if not active_expenses.empty and "travel_expense" in active_expenses.columns 
            else 0
        )
        stay_exp = (
            pd.to_numeric(active_expenses["stay_expense"], errors="coerce").sum() 
            if not active_expenses.empty and "stay_expense" in active_expenses.columns 
            else 0
        )
        food_exp = (
            pd.to_numeric(active_expenses["food_expense"], errors="coerce").sum() 
            if not active_expenses.empty and "food_expense" in active_expenses.columns 
            else 0
        )
        misc_exp = (
            pd.to_numeric(active_expenses["misc_expense"], errors="coerce").sum() 
            if not active_expenses.empty and "misc_expense" in active_expenses.columns 
            else 0
        )
        total_site_expenses = travel_exp + stay_exp + food_exp + misc_exp

        k1, k2, k3, k4, k5 = st.columns(5)
        with k1:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{sites_visited}</div><div class="kpi-label">Active Sites Visited</div></div>', unsafe_allow_html=True)
        with k2:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{days_worked}</div><div class="kpi-label">Days Worked</div></div>', unsafe_allow_html=True)
        with k3:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{days_travelled}</div><div class="kpi-label">Days Travelled</div></div>', unsafe_allow_html=True)
        with k4:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">₹{total_site_expenses:,.0f}</div><div class="kpi-label">Running Sites Total Cost</div></div>', unsafe_allow_html=True)
        with k5:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">₹{travel_exp:,.0f}</div><div class="kpi-label">Travel Expenses</div></div>', unsafe_allow_html=True)

        st.divider()

        g1, g2 = st.columns(2)
        with g1:
            st.subheader("⚠️ Problems & Delays Encountered")
            if "delay_category" in df_logs.columns:
                delay_df = df_logs[df_logs["delay_category"] != "No Delay"]
                if not delay_df.empty:
                    fig_delay = px.bar(
                        delay_df,
                        x="delay_category",
                        color="installation_id",
                        title="Site Problems by Category (Running Sites)",
                    )
                    st.plotly_chart(fig_delay, use_container_width=True)
                else:
                    st.success("No delays or problems reported across running sites!")

        with g2:
            st.subheader("💰 Dynamic Everyday Site Expenses Breakdown")
            if not active_expenses.empty and "installation_id" in active_expenses.columns:
                fig_exp = px.bar(
                    active_expenses,
                    x="installation_id",
                    y=["travel_expense", "stay_expense", "food_expense", "misc_expense"],
                    title="Active Site Expense Breakdown (Dynamic Daily Tracker)",
                    barmode="stack",
                )
                st.plotly_chart(fig_exp, use_container_width=True)
            else:
                st.info("No active site expenses recorded yet.")


def render_sales_analytics():
    st.header("📊 Salesperson Performance & Orders Analytics")
    st.caption("Track order volume, project statuses, and revenue acquisition per Salesperson across custom time windows.")

    df_sites = read_sheet("Sites_Master")

    if df_sites.empty:
        st.warning("No site records found in Sites_Master.")
    else:
        f1, f2 = st.columns([2, 2])
        with f1:
            time_filter = st.selectbox(
                "📅 Select Report Time Period:",
                [
                    "All Time",
                    "Last 15 Days",
                    "Last 1 Month (30 Days)",
                    "Last 3 Months (90 Days)",
                    "Last 6 Months (180 Days)",
                    "Last 9 Months (270 Days)",
                    "Quarterly (90 Days)",
                    "Last 1 Year (365 Days)",
                ],
            )

        filtered_sites = df_sites.copy()
        if "order_date" in filtered_sites.columns:
            filtered_sites["order_dt"] = pd.to_datetime(filtered_sites["order_date"], errors="coerce")
            today = datetime.now()

            days_map = {
                "Last 15 Days": 15,
                "Last 1 Month (30 Days)": 30,
                "Last 3 Months (90 Days)": 90,
                "Last 6 Months (180 Days)": 180,
                "Last 9 Months (270 Days)": 270,
                "Quarterly (90 Days)": 90,
                "Last 1 Year (365 Days)": 365,
            }

            if time_filter in days_map:
                cutoff_date = today - timedelta(days=days_map[time_filter])
                filtered_sites = filtered_sites[filtered_sites["order_dt"] >= cutoff_date]

        k1, k2, k3, k4 = st.columns(4)
        with k1:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{len(filtered_sites)}</div><div class="kpi-label">Orders Acquired</div></div>', unsafe_allow_html=True)
        with k2:
            in_prog = len(filtered_sites[filtered_sites["status"].astype(str).str.strip().str.title() == "In Progress"]) if "status" in filtered_sites.columns else 0
            st.markdown(f'<div class="kpi-card"><div class="kpi-number" style="color:#00A859;">{in_prog}</div><div class="kpi-label">Sites In Progress</div></div>', unsafe_allow_html=True)
        with k3:
            on_hold = len(filtered_sites[filtered_sites["status"].astype(str).str.strip().str.title() == "On Hold"]) if "status" in filtered_sites.columns else 0
            st.markdown(f'<div class="kpi-card"><div class="kpi-number" style="color:#D32F2F;">{on_hold}</div><div class="kpi-label">Sites On Hold</div></div>', unsafe_allow_html=True)
        with k4:
            handovered = len(filtered_sites[filtered_sites["status"].astype(str).str.strip().str.title().isin(["Handovered", "Completed"])]) if "status" in filtered_sites.columns else 0
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{handovered}</div><div class="kpi-label">Completed Handovers</div></div>', unsafe_allow_html=True)

        st.divider()

        if "salesperson_name" in filtered_sites.columns or "salesperson_id" in filtered_sites.columns:
            sp_col = "salesperson_name" if "salesperson_name" in filtered_sites.columns else "salesperson_id"
            
            c_chart1, c_chart2 = st.columns(2)
            with c_chart1:
                st.subheader("📦 Total Orders Brought per Salesperson")
                fig_orders = px.bar(
                    filtered_sites,
                    x=sp_col,
                    color="status",
                    title=f"Orders & Status Breakdown ({time_filter})",
                    barmode="stack",
                )
                st.plotly_chart(fig_orders, use_container_width=True)

            with c_chart2:
                st.subheader("🎯 Site Status Share")
                fig_pie = px.pie(
                    filtered_sites,
                    names="status",
                    title=f"Site Execution Distribution ({time_filter})",
                    hole=0.4,
                )
                st.plotly_chart(fig_pie, use_container_width=True)

            st.subheader("📜 Detailed Salesperson Order Records")
            disp_cols = [c for c in ["installation_id", "client_name", sp_col, "order_date", "deal_amount", "site_city", "status", "hold_reason"] if c in filtered_sites.columns]
            st.dataframe(filtered_sites[disp_cols], use_container_width=True)
        else:
            st.info("No salesperson assignment columns found in Sites_Master yet.")


def render_tada_payroll():
    st.header("✈️ TA/DA Payroll & Field Travel Summary")
    st.caption("Calculate daily allowance, travel metrics, and worker site reimbursements.")

    df_logs = read_sheet("Worker_Daily_Logs")

    if df_logs.empty:
        st.info("No field daily logs found for TA/DA calculations.")
    else:
        st.subheader("📊 TA/DA & Travel Visual Analytics")

        travel_logs = df_logs[df_logs["is_travel_day"].astype(str).str.title() == "Yes"] if "is_travel_day" in df_logs.columns else df_logs

        if travel_logs.empty:
            st.info("No outstation travel days logged yet.")
        else:
            summary = travel_logs.groupby("worker_name").agg(
                Travel_Days=("logged_date", "nunique"),
                Total_Hours=("hours_spent", "sum"),
                Sites_Covered=("installation_id", "nunique"),
            ).reset_index()

            summary["Estimated_TADA_Allowance"] = summary["Travel_Days"] * 500

            c1, c2 = st.columns(2)
            with c1:
                fig_ta = px.bar(
                    summary,
                    x="worker_name",
                    y="Travel_Days",
                    title="Outstation Travel Days per Worker",
                    color="Travel_Days",
                )
                st.plotly_chart(fig_ta, use_container_width=True)
            with c2:
                fig_allowance = px.bar(
                    summary,
                    x="worker_name",
                    y="Estimated_TADA_Allowance",
                    title="Calculated TA/DA Allowance (₹)",
                    color="Estimated_TADA_Allowance",
                )
                st.plotly_chart(fig_allowance, use_container_width=True)

            st.divider()
            st.subheader("📜 Detailed Individual Worker TA/DA Breakdown Table")
            st.dataframe(summary, use_container_width=True)

            excel_ta = generate_excel_download(summary, "TADA_Payroll_Summary.xlsx")
            st.download_button(
                "📥 Download TA/DA Payroll Summary Excel",
                data=excel_ta,
                file_name="TADA_Payroll_Summary.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )


def render_field_logs_inspector():
    st.header("🔍 Advanced Field Logs & Photo Inspector")
    st.caption("Audit complete field logs, examine attached site photos, and filter entries by date, worker, or site ID.")

    df_logs = read_sheet("Worker_Daily_Logs")

    if df_logs.empty:
        st.warning("No worker field logs present in database.")
    else:
        col_f1, col_f2, col_f3 = st.columns(3)
        with col_f1:
            site_list = ["All Sites"] + sorted(df_logs["installation_id"].dropna().unique().tolist())
            selected_site = st.selectbox("Filter Site", site_list)
        with col_f2:
            worker_list = ["All Workers"] + sorted(df_logs["worker_name"].dropna().unique().tolist())
            selected_worker = st.selectbox("Filter Worker", worker_list)
        with col_f3:
            delay_list = ["All Categories"] + sorted(df_logs["delay_category"].dropna().unique().tolist()) if "delay_category" in df_logs.columns else ["All Categories"]
            selected_delay = st.selectbox("Filter Delay Category", delay_list)

        inspect_df = df_logs.copy()
        if selected_site != "All Sites":
            inspect_df = inspect_df[inspect_df["installation_id"] == selected_site]
        if selected_worker != "All Workers":
            inspect_df = inspect_df[inspect_df["worker_name"] == selected_worker]
        if selected_delay != "All Categories" and "delay_category" in inspect_df.columns:
            inspect_df = inspect_df[inspect_df["delay_category"] == selected_delay]

        st.write("##")
        k1, k2, k3, k4 = st.columns(4)
        with k1:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{len(inspect_df)}</div><div class="kpi-label">Total Field Logs</div></div>', unsafe_allow_html=True)
        with k2:
            s_cnt = inspect_df["installation_id"].nunique() if "installation_id" in inspect_df.columns else 0
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{s_cnt}</div><div class="kpi-label">Active Sites Covered</div></div>', unsafe_allow_html=True)
        with k3:
            w_cnt = inspect_df["worker_name"].nunique() if "worker_name" in inspect_df.columns else 0
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{w_cnt}</div><div class="kpi-label">Field Personnel</div></div>', unsafe_allow_html=True)
        with k4:
            p_cnt = len(inspect_df[inspect_df["site_photo"].astype(str).str.startswith("http")]) if "site_photo" in inspect_df.columns else 0
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{p_cnt}</div><div class="kpi-label">Photos Attached</div></div>', unsafe_allow_html=True)

        st.divider()
        st.subheader(f"📋 Inspection Records ({len(inspect_df)} entries found)")
        st.dataframe(inspect_df, use_container_width=True)

        excel_logs = generate_excel_download(inspect_df, "Field_Logs_Inspector.xlsx")
        st.download_button(
            "📥 Export Inspected Logs to Excel",
            data=excel_logs,
            file_name="Field_Logs_Inspector.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

        st.divider()
        st.subheader("📷 Photo Audit Log")
        photo_logs = inspect_df[inspect_df["site_photo"].astype(str).str.startswith("http")] if "site_photo" in inspect_df.columns else pd.DataFrame()

        if photo_logs.empty:
            st.info("No site photos attached for selected filters.")
        else:
            cols = st.columns(3)
            for idx, (_, row) in enumerate(photo_logs.iterrows()):
                with cols[idx % 3]:
                    st.markdown(f"**Site:** `{row.get('installation_id')}` | **Worker:** {row.get('worker_name')}")
                    st.caption(f"Date: {row.get('logged_date')} | Task: {row.get('task_name')}")
                    st.markdown(f"[🔗 Open Google Drive Photo]({row.get('site_photo')})")


def render_user_management():
    st.header("👥 Dynamic User & Access Management")
    df_workers = read_sheet("Workers_Master")

    if st.session_state.get("user_created_success"):
        new_user = st.session_state.get("created_user_name", "User")
        st.toast(f"👤 Account for {new_user} created successfully!", icon="✅")
        del st.session_state["user_created_success"]

    tabs_list = ["➕ Add Single User", "✏️ Update User", "❌ Delete User (Admin Only)"]
    tab_add, tab_edit, tab_del = st.tabs(tabs_list)

    # 1. ADD USER TAB
    with tab_add:
        st.subheader("Add Employee / Salesperson / Supervisor")
        col_l, col_center, col_r = st.columns([0.1, 0.8, 0.1])
        with col_center:
            selected_role = st.selectbox(
                "System Access Role *", 
                ["Worker", "Supervisor", "Salesperson", "Admin"], 
                key="add_user_role_select"
            )
            
            worker_designation = ""
            if selected_role == "Worker":
                worker_designation = st.selectbox("Worker Designation *", WORKER_DESIGNATIONS)

            generated_id = generate_work_id(selected_role, df_workers)
            st.info(f"🆔 **Automated System Work ID:** `{generated_id}`")

            with st.form("add_single_user_form"):
                worker_name = st.text_input("Full Name *", placeholder="e.g. Parvesh Kumar")
                phone_no = st.text_input("Mobile Number *", max_chars=10, placeholder="e.g. 9876543210")
                worker_pin = st.text_input("4-Digit Security PIN *", max_chars=4, type="password", placeholder="e.g. 1234")
                base_location = st.text_input("Base Station / City *", value="Jaipur")

                submit_user = st.form_submit_button("👤 Create User Profile", use_container_width=True)

                if submit_user:
                    clean_phone = str(phone_no).strip()
                    clean_pin = str(worker_pin).strip()

                    if not worker_name.strip() or not clean_phone or not clean_pin:
                        st.error("Please fill in all mandatory fields.")
                    elif len(clean_phone) != 10 or not clean_phone.isdigit():
                        st.error("Mobile number must be exactly 10 digits.")
                    elif len(clean_pin) < 4 or not clean_pin.isdigit():
                        st.error("PIN must be 4 numeric digits.")
                    else:
                        new_user_data = {
                            "worker_id": generated_id,
                            "name": worker_name.strip(),
                            "role": selected_role,
                            "designation": worker_designation if selected_role == "Worker" else selected_role,
                            "phone_no": clean_phone,
                            "pin": clean_pin,
                            "base_location": base_location.strip(),
                        }
                        append_to_sheet("Workers_Master", new_user_data)
                        st.session_state["user_created_success"] = True
                        st.session_state["created_user_name"] = worker_name.strip()
                        st.rerun()

    # 2. EDIT USER TAB
    with tab_edit:
        st.subheader("Edit System User Details")
        if df_workers.empty:
            st.info("No active users present.")
        else:
            user_options = {
                f"{r.get('name')} ({r.get('worker_id')}) — {r.get('role')}": r.get("worker_id")
                for _, r in df_workers.iterrows()
            }
            sel_user_label = st.selectbox("Select User to Modify", list(user_options.keys()))
            target_id = user_options[sel_user_label]

            m_row = df_workers[df_workers["worker_id"] == target_id].iloc[0]

            with st.form("edit_user_form"):
                e_name = st.text_input("Full Name", value=m_row.get("name", ""))
                e_role = st.selectbox("Access Role", ["Worker", "Supervisor", "Salesperson", "Admin"], index=["Worker", "Supervisor", "Salesperson", "Admin"].index(m_row.get("role", "Worker")) if m_row.get("role") in ["Worker", "Supervisor", "Salesperson", "Admin"] else 0)
                e_desig = st.text_input("Designation", value=m_row.get("designation", ""))
                e_phone = st.text_input("Phone Number", value=str(m_row.get("phone_no", "")))
                e_pin = st.text_input("PIN", value=str(m_row.get("pin", "")))
                e_base = st.text_input("Base Location", value=m_row.get("base_location", "Jaipur"))

                btn_update_u = st.form_submit_button("Update User Profile", use_container_width=True)

                if btn_update_u:
                    up_dict = {
                        "name": e_name.strip(),
                        "role": e_role,
                        "designation": e_desig.strip(),
                        "phone_no": e_phone.strip(),
                        "pin": e_pin.strip(),
                        "base_location": e_base.strip(),
                    }
                    update_sheet_row("Workers_Master", "worker_id", target_id, up_dict)
                    st.success(f"User {e_name} updated successfully!")
                    st.rerun()

    # 3. DELETE USER TAB
    with tab_del:
        st.subheader("Delete System User")
        if df_workers.empty:
            st.info("No users found.")
        else:
            del_options = {
                f"{r.get('name')} ({r.get('worker_id')})": r.get("worker_id")
                for _, r in df_workers.iterrows()
            }
            del_label = st.selectbox("Select User to Remove", list(del_options.keys()))
            del_id = del_options[del_label]

            if st.button("❌ Confirm Delete User", type="primary"):
                delete_sheet_row("Workers_Master", "worker_id", del_id)
                st.success("User deleted successfully!")
                st.rerun()

    st.divider()
    st.subheader("📋 System Users Directory")
    disp_cols = [c for c in ["worker_id", "name", "role", "designation", "phone_no", "base_location"] if c in df_workers.columns]
    st.dataframe(df_workers[disp_cols], use_container_width=True)


def render_master_database():
    st.header("🛢️ Master Database Tabs Explorer")
    sheet_options = ["Sites_Master", "Workers_Master", "Worker_Daily_Logs", "Expense_Logs", "Task_Assignments"]
    sel_sheet = st.selectbox("Select Database Sheet Tab to Inspect", sheet_options)

    df_data = read_sheet(sel_sheet)
    st.subheader(f"Data Records — {sel_sheet} ({len(df_data)} Records)")
    st.dataframe(df_data, use_container_width=True)

    if not df_data.empty:
        e_bytes = generate_excel_download(df_data, f"{sel_sheet}.xlsx")
        st.download_button(
            f"📥 Download {sel_sheet} Excel",
            data=e_bytes,
            file_name=f"{sel_sheet}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )