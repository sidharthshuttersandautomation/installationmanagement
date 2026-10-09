from datetime import datetime, timedelta
import pandas as pd
import plotly.express as px
import streamlit as st

from installation_app.services.sheets import read_sheet, append_to_sheet, update_sheet_row
from installation_app.components.ui import format_worker_dropdown_options, render_restricted_work_input

def render_view_logs_and_update_status():
    st.markdown("## 🔍 View Daily Logs & Update Status")

    df_sites = read_sheet("Sites_Master")
    if df_sites.empty:
        st.warning("No installation records found in Sites_Master database.")
        return

    df_sites.columns = [
        str(col).strip().lower().replace(" ", "_") for col in df_sites.columns
    ]

    site_map = {}
    site_data = {}

    for _, s in df_sites.iterrows():
        site_id = str(s.get("installation_id", "")).strip()
        status = str(s.get("status") or "In Progress").strip().title()

        if not site_id:
            continue

        c_name = str(
            s.get("client_name")
            or s.get("client")
            or s.get("company_name")
            or "N/A"
        ).strip()
        c_phone = str(
            s.get("client_phone")
            or s.get("mobile_no")
            or s.get("phone")
            or "N/A"
        ).strip()
        city = str(s.get("site_city") or s.get("city") or "N/A").strip()
        lead = str(s.get("team_lead") or s.get("lead") or "N/A").strip()

        display_label = f"{site_id} — {c_name} [{status}]" if c_name != "N/A" else f"{site_id} [{status}]"

        site_map[display_label] = site_id
        site_data[site_id] = {
            "client_name": c_name,
            "client_phone": c_phone,
            "city": city,
            "team_lead": lead,
            "status": status,
        }

    if not site_map:
        st.info("No active installation sites found in database.")
        return

    selected_label = st.selectbox(
        "Select Installation ID",
        options=list(site_map.keys()),
        key="view_logs_site_select",
    )

    selected_id = site_map[selected_label]
    info = site_data[selected_id]

    st.markdown(
        f"""
        <div style="background-color: #f0f4f8; padding: 20px; border-radius: 10px; border-left: 5px solid #1E3A8A; margin-top: 15px; margin-bottom: 20px;">
            <h2 style="color: #1E3A8A; margin-top: 0; margin-bottom: 10px;">{selected_id}</h2>
            <p style="margin: 5px 0;"><strong>Client Name:</strong> {info['client_name']} | <strong>Client Mobile:</strong> {info['client_phone']}</p>
            <p style="margin: 5px 0;"><strong>City:</strong> {info['city']} | <strong>Team Lead:</strong> {info['team_lead']}</p>
            <p style="margin: 5px 0;"><strong>Current Status:</strong> {info['status']}</p>
        </div>
    """,
        unsafe_allow_html=True,
    )

    STATUS_OPTIONS = ["In Progress", "On Hold", "Handovered", "Completed", "Cancelled"]
    HOLD_REASONS = [
        "Client Payment Pending",
        "Site Not Ready / Civil Work Pending",
        "Material Delivery Delayed",
        "Power Supply Issue at Site",
        "Client Requested Delay",
        "Other",
    ]

    col_st, col_btn = st.columns([2, 1])
    with col_st:
        curr_st = info["status"]
        st_idx = (
            STATUS_OPTIONS.index(curr_st) if curr_st in STATUS_OPTIONS else 0
        )
        new_st = st.selectbox(
            "Update Status",
            STATUS_OPTIONS,
            index=st_idx,
            key="update_status_selectbox",
        )

    hold_reason_val = ""
    hold_remark_val = ""

    if new_st == "On Hold":
        st.warning("⚠️ Site is being placed On Hold. A reason is mandatory.")
        c_r1, c_r2 = st.columns(2)
        with c_r1:
            hold_reason_val = st.selectbox(
                "Mandatory Reason for Hold *",
                HOLD_REASONS,
                key="hold_reason_select",
            )
        with c_r2:
            if hold_reason_val == "Other":
                hold_remark_val = st.text_input(
                    "Specific Hold Remarks (Mandatory for 'Other') *",
                    key="hold_remark_input",
                )

    with col_btn:
        st.write(" ")
        st.write(" ")
        if st.button("Update Status", key="btn_update_site_status"):
            if new_st == "On Hold":
                if hold_reason_val == "Other" and not hold_remark_val.strip():
                    st.error("Please enter specific remarks when selecting 'Other'.")
                    st.stop()
                
                final_hold_note = (
                    f"On Hold Reason: {hold_reason_val} - {hold_remark_val}"
                    if hold_reason_val == "Other"
                    else f"On Hold Reason: {hold_reason_val}"
                )
                update_sheet_row(
                    "Sites_Master",
                    "installation_id",
                    selected_id,
                    {"status": new_st, "hold_reason": final_hold_note},
                )
            else:
                update_sheet_row(
                    "Sites_Master",
                    "installation_id",
                    selected_id,
                    {"status": new_st},
                )

            st.success(f"Status updated to **{new_st}**!")
            st.rerun()

    st.divider()
    st.subheader("📜 Submitted Work Logs")
    df_logs = read_sheet("Worker_Daily_Logs")
    p_logs = (
        df_logs[df_logs["installation_id"] == selected_id]
        if not df_logs.empty and "installation_id" in df_logs.columns
        else pd.DataFrame()
    )

    if not p_logs.empty:
        for _, l in p_logs.iterrows():
            day_lbl = l.get("site_day", "")
            header_prefix = f"[{day_lbl}] " if day_lbl else ""
            with st.expander(
                f"📅 {header_prefix}Date: {l.get('logged_date')} | Worker: {l.get('worker_name')} | Role/Designation: {l.get('worker_role', 'N/A')}"
            ):
                st.write(f"**Task Category:** {l.get('task_category')}")
                st.write(f"**Task Description:** {l.get('task_name')}")
                st.write(
                    f"**Time Spent:** {l.get('hours_spent')} hrs {l.get('minutes_spent')} mins"
                )
                st.write(f"**Travel Day (TA/DA):** {l.get('is_travel_day')}")
                st.write(f"**Photo Attached:** {l.get('site_photo', 'No Photo')}")
                st.write(
                    f"**Remarks / Cause of Delay:** {l.get('site_remarks', 'None')}"
                )
    else:
        st.info("No submitted field logs found for this installation ID.")


def render_new_installation_requests():
    st.header("🔔 Pending Installation Requests & Sales Orders")
    st.caption("Review new installation orders raised by salespersons and assign team execution leads.")

    df_sites = read_sheet("Sites_Master")
    df_workers = read_sheet("Workers_Master")

    if df_sites.empty:
        st.info("No installation requests found.")
    else:
        unassigned_mask = (
            df_sites.get("team_lead", pd.Series()).astype(str).str.strip().replace(["", "nan", "None", "Unassigned"], "") == ""
        )
        pending_requests = df_sites[unassigned_mask].copy()

        if pending_requests.empty:
            st.success("✅ All installation orders have been processed and assigned to team leads!")
        else:
            st.warning(f"🚨 **{len(pending_requests)} New Installation Order(s) Awaiting Supervisor Action!**")

            worker_options = format_worker_dropdown_options(df_workers)

            for _, req in pending_requests.iterrows():
                site_id = req.get("installation_id", "N/A")
                c_name = req.get("client_name", "N/A")
                c_phone = req.get("client_phone", "N/A")
                sp_name = req.get("salesperson_name", "Salesperson")
                deal_amt = req.get("deal_amount", "N/A")

                with st.expander(f"🆕 Order ID: {site_id} — Client: {c_name} (Salesperson: {sp_name})", expanded=True):
                    col1, col2 = st.columns(2)
                    with col1:
                        st.write(f"**Client Mobile:** {c_phone}")
                        st.write(f"**City:** {req.get('site_city', 'N/A')}")
                        st.write(f"**Address:** {req.get('site_address', 'N/A')}")
                        st.write(f"**Order Date:** {req.get('order_date', 'N/A')}")
                    with col2:
                        st.write(f"**Deal Value:** ₹{deal_amt}")
                        st.write(f"**Target Handover:** {req.get('handover_date', 'N/A')}")
                        st.write(f"**Products Summary:** {req.get('products_summary', 'None')}")

                    st.markdown("#### ⚡ Assign Execution Team & Activate Site")
                    with st.form(f"assign_team_form_{site_id}"):
                        a_lead = st.selectbox("Assign Team Lead *", options=worker_options, key=f"lead_{site_id}")
                        a_helpers = st.multiselect("Assign Helpers / Crew", options=[w for w in worker_options if w != a_lead], key=f"helpers_{site_id}")

                        submit_assignment = st.form_submit_button("✅ Accept Order & Assign Team", use_container_width=True)

                        if submit_assignment:
                            if not a_lead:
                                st.error("Please select a Team Lead.")
                            else:
                                clean_lead = a_lead.split(" (")[0].strip()
                                clean_helpers = [h.split(" (")[0].strip() for h in a_helpers]
                                updates = {
                                    "team_lead": clean_lead,
                                    "team_members": ", ".join(clean_helpers),
                                    "status": "In Progress",
                                }
                                update_sheet_row("Sites_Master", "installation_id", site_id, updates)
                                st.success(f"Installation **{site_id}** activated and assigned to **{clean_lead}**!")
                                st.rerun()


def render_site_daily_expenses(user_name):
    st.header("💰 Supervisor Daily Site Expense Logging")
    st.caption("Record daily operational costs for running sites.")

    df_sites = read_sheet("Sites_Master")

    if df_sites.empty:
        st.warning("No installation sites found.")
    else:
        active_sites = df_sites[~df_sites["status"].astype(str).str.strip().str.title().isin(["Handovered", "Handover", "Completed"])]

        if active_sites.empty:
            st.info("No active installation sites requiring daily expense logs.")
        else:
            site_options = {
                f"{row.get('installation_id')} — {row.get('client_name', 'N/A')} ({row.get('site_city', 'N/A')})": row.get('installation_id')
                for _, row in active_sites.iterrows()
            }

            with st.form("supervisor_expense_form"):
                selected_label = st.selectbox("Select Active Installation Site *", options=list(site_options.keys()))
                sel_site_id = site_options[selected_label]

                col1, col2 = st.columns(2)
                with col1:
                    exp_date = st.date_input("Expense Date", value=datetime.now())
                    travel_exp = st.number_input("Travel Expense (₹)", min_value=0.0, step=100.0)
                    stay_exp = st.number_input("Stay / Accommodation Expense (₹)", min_value=0.0, step=100.0)
                with col2:
                    food_exp = st.number_input("Food / Daily Allowance Expense (₹)", min_value=0.0, step=50.0)
                    misc_exp = st.number_input("Local Purchase / Misc Expense (₹)", min_value=0.0, step=100.0)

                exp_remarks = st.text_area("Expense Description / Notes", placeholder="Detail local purchase items or travel distance...")

                submit_expense = st.form_submit_button("💾 Record & Sync Daily Expense", use_container_width=True)

                if submit_expense:
                    total_amount = travel_exp + stay_exp + food_exp + misc_exp
                    if total_amount <= 0:
                        st.error("Please enter a non-zero expense amount.")
                    else:
                        exp_id = f"EXP-{datetime.now().strftime('%Y%m%d%H%M%S')}"
                        exp_data = {
                            "expense_id": exp_id,
                            "installation_id": sel_site_id,
                            "logged_date": str(exp_date),
                            "supervisor_name": user_name,
                            "travel_expense": travel_exp,
                            "stay_expense": stay_exp,
                            "food_expense": food_exp,
                            "misc_expense": misc_exp,
                            "total_expense": total_amount,
                            "remarks": exp_remarks.strip(),
                        }
                        append_to_sheet("Expense_Logs", exp_data)
                        st.success(f"Daily expense of ₹{total_amount:,.2f} logged for site {sel_site_id}!")
                        st.rerun()
                        
            st.divider()
            st.subheader("📜 Recent Site Expense Logs")
            df_expenses = read_sheet("Expense_Logs")
            if not df_expenses.empty:
                st.dataframe(df_expenses.sort_values(by="logged_date", ascending=False), use_container_width=True)


def render_handover_dashboard():
    st.header("📅 Site Handover Date Dashboard & Delivery Tracker")
    st.caption("Monitor upcoming project handovers, identify delayed/overdue installations, and update delivery targets.")

    df_sites = read_sheet("Sites_Master")

    if df_sites.empty:
        st.warning("No installation site records found in Sites_Master.")
    else:
        df_sites_clean = df_sites.copy()
        df_sites_clean.columns = [str(c).strip().lower().replace(" ", "_") for c in df_sites_clean.columns]

        today = datetime.now().date()

        if "handover_date" in df_sites_clean.columns:
            df_sites_clean["handover_dt"] = pd.to_datetime(df_sites_clean["handover_date"], errors="coerce").dt.date
        else:
            df_sites_clean["handover_dt"] = None

        total_sites = len(df_sites_clean)
        completed_sites = len(df_sites_clean[df_sites_clean["status"].astype(str).str.strip().str.title().isin(["Handovered", "Completed"])])
        active_sites = df_sites_clean[~df_sites_clean["status"].astype(str).str.strip().str.title().isin(["Handovered", "Completed"])].copy()
        
        overdue_sites = active_sites[active_sites["handover_dt"].apply(lambda d: d is not None and d < today)]
        due_this_week = active_sites[active_sites["handover_dt"].apply(lambda d: d is not None and today <= d <= (today + timedelta(days=7)))]

        k1, k2, k3, k4 = st.columns(4)
        with k1:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{len(active_sites)}</div><div class="kpi-label">Active Running Sites</div></div>', unsafe_allow_html=True)
        with k2:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number" style="color:#D32F2F;">{len(overdue_sites)}</div><div class="kpi-label">Overdue Target Handovers</div></div>', unsafe_allow_html=True)
        with k3:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number" style="color:#10418A;">{len(due_this_week)}</div><div class="kpi-label">Handovers Due This Week</div></div>', unsafe_allow_html=True)
        with k4:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number" style="color:#00A859;">{completed_sites}</div><div class="kpi-label">Handovered / Completed</div></div>', unsafe_allow_html=True)

        st.divider()

        st.subheader(" Timeline Overview of Running Sites")
        if not active_sites.empty:
            active_sites["days_remaining"] = active_sites["handover_dt"].apply(lambda d: (d - today).days if d is not None else None)
            
            fig_handover = px.bar(
                active_sites.dropna(subset=["days_remaining"]),
                x="installation_id",
                y="days_remaining",
                color="status",
                hover_data=["client_name", "site_city", "team_lead", "handover_date"],
                title="Days Remaining Until Handover Target per Site",
                labels={"days_remaining": "Days Remaining (+ Future / - Overdue)", "installation_id": "Site ID"},
            )
            st.plotly_chart(fig_handover, use_container_width=True)

            st.divider()
            st.subheader("✏️ Quick Update Site Target Handover Date")
            site_options = {
                f"{r.get('installation_id')} — {r.get('client_name', 'N/A')} (Target: {r.get('handover_date', 'N/A')})": str(r.get('installation_id')).strip()
                for _, r in active_sites.iterrows()
            }

            if site_options:
                col_sel, col_new_date, col_btn_date = st.columns([2, 1.5, 1])
                with col_sel:
                    target_label = st.selectbox("Select Site to Reschedule Handover", options=list(site_options.keys()))
                    target_id = site_options[target_label]
                with col_new_date:
                    new_handover_dt = st.date_input("New Agreed Handover Date", value=today + timedelta(days=7))
                with col_btn_date:
                    st.write(" ")
                    st.write(" ")
                    if st.button("Update Handover Date", key="btn_update_handover_dt"):
                        success = update_sheet_row("Sites_Master", "installation_id", target_id, {"handover_date": str(new_handover_dt)})
                        if success:
                            st.success(f"Handover date for `{target_id}` updated to **{new_handover_dt}**!")
                            st.rerun()

            st.divider()
            st.subheader("📋 Active Sites Handover Schedule Table")
            disp_cols = [c for c in ["installation_id", "client_name", "client_phone", "site_city", "team_lead", "order_date", "handover_date", "days_remaining", "status"] if c in active_sites.columns]
            st.dataframe(active_sites[disp_cols].sort_values(by="handover_date", ascending=True), use_container_width=True)


def render_active_tasks_dashboard():
    st.header("📋 Active Tasks Dashboard")
    st.caption("Track site installation progress, monitor individual task statuses, and export site reports.")

    df_tasks = read_sheet("Task_Assignments")
    df_sites = read_sheet("Sites_Master")

    if df_tasks.empty:
        st.info("⚠️ No Active Tasks Found")
    else:
        col_f1, col_f2 = st.columns(2)
        with col_f1:
            site_options = ["All Sites"] + (
                df_sites["installation_id"].tolist()
                if not df_sites.empty and "installation_id" in df_sites.columns
                else []
            )
            site_filter = st.selectbox("Filter by Site", site_options)
        with col_f2:
            status_filter = st.selectbox("Filter by Task Status", ["All Statuses", "In Progress", "Pending", "Completed"])

        filtered_tasks = df_tasks.copy()
        if site_filter != "All Sites" and "installation_id" in filtered_tasks.columns:
            filtered_tasks = filtered_tasks[filtered_tasks["installation_id"] == site_filter]
        if status_filter != "All Statuses" and "status" in filtered_tasks.columns:
            filtered_tasks = filtered_tasks[filtered_tasks["status"] == status_filter]

        st.write("##")
        st.subheader(f"Task List ({len(filtered_tasks)} Records)")
        st.dataframe(filtered_tasks, use_container_width=True)


def render_team_head_dashboard(user_name):
    st.header("👥 Dual-Tab Team Head Dashboard")
    tab_personal, tab_crew = st.tabs(["👤 Personal Work Log", "👨‍🔧 Crew Task Logging"])

    with tab_personal:
        st.subheader(f"Personal Execution Log ({user_name})")
        render_restricted_work_input(target_worker_name=user_name, is_crew_log=False)

    with tab_crew:
        st.subheader("Manage Active Crew Logs")
        df_workers = read_sheet("Workers_Master")
        
        worker_options = format_worker_dropdown_options(df_workers)

        if not worker_options:
            st.info("⚠️ No Active Crew Members Found")
        else:
            selected_crew_str = st.selectbox("Select Worker to Log For", worker_options)
            selected_crew = selected_crew_str.split(" (")[0].strip()
            st.divider()
            render_restricted_work_input(target_worker_name=selected_crew, is_crew_log=True)