from datetime import datetime, timedelta
import pandas as pd
import plotly.express as px
import streamlit as st

from installation_app.services.sheets import (
    read_sheet,
    append_to_sheet,
    update_sheet_row,
    update_sheet_record,
)
from installation_app.components.ui import (
    format_worker_dropdown_options,
    render_data_drawer,
    render_restricted_work_input,
)

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

        if not site_id or status in {"Handover", "Handovered", "Completed", "Cancelled"}:
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
        st.info("No active installation sites are available for status updates.")
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
            updates = {"status": new_st}
            if new_st == "On Hold":
                if hold_reason_val == "Other" and not hold_remark_val.strip():
                    st.error("Please enter specific remarks when selecting 'Other'.")
                    st.stop()
                
                final_hold_note = (
                    f"On Hold Reason: {hold_reason_val} - {hold_remark_val}"
                    if hold_reason_val == "Other"
                    else f"On Hold Reason: {hold_reason_val}"
                )
                updates["hold_reason"] = final_hold_note
            if new_st in {"Handovered", "Completed"}:
                completed_at = datetime.now()
                updates["actual_handover_date"] = str(completed_at.date())
                updates["completed_at"] = completed_at.isoformat(timespec="seconds")

            if update_sheet_record(
                "Sites_Master",
                "installation_id",
                selected_id,
                updates,
                ensure_columns=True,
            ):
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
    if not df_sites.empty:
        deal_status = (
            df_sites["deal_status"].astype(str).str.strip().str.casefold()
            if "deal_status" in df_sites.columns
            else pd.Series("", index=df_sites.index)
        )
        statuses = (
            df_sites["status"].astype(str).str.strip().str.casefold()
            if "status" in df_sites.columns
            else pd.Series("", index=df_sites.index)
        )
        leads = df_sites.get("team_lead", pd.Series("", index=df_sites.index)).astype(str).str.strip()
        pending_count = int(
            (leads.isin(["", "nan", "None", "Unassigned"])
             & ~statuses.isin(["handovered", "handover", "completed", "cancelled"])
             & ~deal_status.isin(["lost", "lost / cancelled", "cancelled"])).sum()
        )
        dispatched_mask = (
            df_sites.get(
                "production_status", pd.Series("", index=df_sites.index)
            ).astype(str).str.strip().str.casefold().eq("dispatched")
        )
        dispatched_sites = df_sites[dispatched_mask]
        dispatch_dates = pd.to_datetime(
            df_sites.get("target_dispatch_date", pd.Series("", index=df_sites.index)),
            errors="coerce",
        ).dt.normalize()
        today = datetime.now().date()
        due_soon_mask = (
            dispatch_dates.notna()
            & dispatch_dates.le(pd.Timestamp(today + timedelta(days=3)))
            & ~dispatched_mask
        )
        due_soon_sites = df_sites[due_soon_mask]
        alert_cols = st.columns(3)
        alert_cols[0].metric("New site visit / installation requests", pending_count)
        alert_cols[1].metric("Dispatch due within 3 days", len(due_soon_sites))
        alert_cols[2].metric("Dispatched · team alignment required", len(dispatched_sites))
        for _, due_site in due_soon_sites.iterrows():
            due_date = pd.to_datetime(due_site.get("target_dispatch_date")).date()
            message = (
                f"Dispatch overdue: {due_site.get('installation_id')} · {due_date}."
                if due_date < today
                else f"Dispatch reminder: {due_site.get('installation_id')} due by {due_date}."
            )
            st.error(message) if due_date < today else st.warning(message)
        for _, dispatch in dispatched_sites.iterrows():
            st.error(
                f"🚚 {dispatch.get('installation_id')} dispatched — urgent team alignment required. "
                f"Tracking: {dispatch.get('tracking_reference', 'not recorded')} · "
                f"Vehicle: {dispatch.get('dispatch_vehicle', 'not recorded')} · "
                f"ETA: {dispatch.get('estimated_arrival_at', 'not recorded')}"
            )
            photo = str(dispatch.get("loaded_vehicle_photo_url", "")).strip()
            if photo.startswith("http"):
                st.link_button(
                    f"View loaded vehicle photo · {dispatch.get('installation_id')}",
                    photo,
                )

    if df_sites.empty:
        st.info("No installation requests found.")
    else:
        unassigned_mask = (
            df_sites.get("team_lead", pd.Series()).astype(str).str.strip().replace(["", "nan", "None", "Unassigned"], "") == ""
        )
        site_status = (
            df_sites["status"].astype(str).str.strip().str.casefold()
            if "status" in df_sites.columns
            else pd.Series("", index=df_sites.index)
        )
        deal_status = (
            df_sites["deal_status"].astype(str).str.strip().str.casefold()
            if "deal_status" in df_sites.columns
            else pd.Series("", index=df_sites.index)
        )
        open_mask = ~site_status.isin(
            ["handovered", "handover", "completed", "cancelled"]
        )
        if deal_status.ne("").any():
            open_mask &= ~deal_status.isin(["lost", "lost / cancelled", "cancelled"])
        pending_requests = df_sites[unassigned_mask & open_mask].copy()

        if pending_requests.empty:
            st.success("✅ All installation orders have been processed and assigned to team leads!")
        else:
            st.warning(f"🚨 **{len(pending_requests)} New Installation Order(s) Awaiting Supervisor Action!**")

            worker_options = format_worker_dropdown_options(
                df_workers, available_only=True
            )

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

                        submit_assignment = st.form_submit_button("✅ Accept Order & Assign Team", width="stretch")

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
                                if update_sheet_record(
                                    "Sites_Master",
                                    "installation_id",
                                    str(site_id),
                                    updates,
                                    ensure_columns=True,
                                ):
                                    st.success(f"Installation **{site_id}** activated and assigned to **{clean_lead}**!")
                                    st.rerun()


def render_site_daily_expenses(user_name):
    st.header("💰 Supervisor Daily Site Expense Logging")
    st.caption("Record daily operational costs for running sites.")
    if st.session_state.pop("clear_expense_fields", False):
        for key in (
            "expense_travel",
            "expense_stay",
            "expense_food",
            "expense_misc",
            "expense_remarks",
        ):
            st.session_state[key] = "" if key == "expense_remarks" else 0.0

    df_sites = read_sheet("Sites_Master")

    if df_sites.empty:
        st.warning("No installation sites found.")
    else:
        site_status = (
            df_sites["status"].astype(str).str.strip().str.lower()
            if "status" in df_sites.columns
            else pd.Series("", index=df_sites.index)
        )
        active_sites = df_sites[
            ~site_status.isin(["handovered", "handover", "completed", "cancelled"])
        ]

        if active_sites.empty:
            st.info("No active installation sites requiring daily expense logs.")
        else:
            site_options = {
                f"{row.get('installation_id')} — {row.get('client_name', 'N/A')} ({row.get('site_city', 'N/A')})": str(row.get('installation_id', '')).strip()
                for _, row in active_sites.iterrows()
                if str(row.get("installation_id", "")).strip()
            }
            if not site_options:
                st.info("No sites have an installation ID available for expense logging.")
                return

            selected_label = st.selectbox(
                "Select active site ID *",
                options=list(site_options.keys()),
                key="expense_site_select",
            )
            sel_site_id = site_options[selected_label]
            exp_date = st.date_input(
                "Expense date",
                value=datetime.now().date(),
                key="expense_date_input",
            )
            supervisor_name = st.text_input(
                "Supervisor name *",
                value=user_name,
                key="expense_supervisor_name",
            )

            col1, col2 = st.columns(2)
            with col1:
                travel_exp = st.number_input(
                    "Travel (₹)", min_value=0.0, step=100.0, key="expense_travel"
                )
                stay_exp = st.number_input(
                    "Stay / lodging (₹)", min_value=0.0, step=100.0, key="expense_stay"
                )
            with col2:
                food_exp = st.number_input(
                    "Food / daily allowance (₹)", min_value=0.0, step=50.0, key="expense_food"
                )
                misc_exp = st.number_input(
                    "Misc / local purchase (₹)", min_value=0.0, step=100.0, key="expense_misc"
                )
            exp_remarks = st.text_area(
                "Expense remarks / item details",
                placeholder="Describe purchases, travel, or other expense details",
                key="expense_remarks",
            )
            total_amount = travel_exp + stay_exp + food_exp + misc_exp
            st.metric("Total expense", f"₹{total_amount:,.2f}")

            if st.button("Record & sync daily expense", key="submit_site_expense"):
                if not supervisor_name.strip():
                    st.error("Enter the supervisor name before submitting.")
                elif total_amount <= 0:
                    st.error("Enter a non-zero expense amount before submitting.")
                else:
                    df_expenses = read_sheet("Expense_Logs")
                    used_ids = set()
                    if not df_expenses.empty:
                        for column in ("exp_id", "expense_id"):
                            if column in df_expenses.columns:
                                used_ids.update(
                                    df_expenses[column].dropna().astype(str).str.strip()
                                )
                    exp_time = datetime.now().replace(microsecond=0)
                    exp_id = f"EXP-{exp_time.strftime('%Y%m%d%H%M%S')}"
                    while exp_id in used_ids:
                        exp_time += timedelta(seconds=1)
                        exp_id = f"EXP-{exp_time.strftime('%Y%m%d%H%M%S')}"
                    exp_data = {
                        "exp_id": exp_id,
                        "expense_id": exp_id,
                        "installation_id": sel_site_id,
                        "exp_date": str(exp_date),
                        "logged_date": str(exp_date),
                        "supervisor_name": supervisor_name.strip(),
                        "travel_exp": travel_exp,
                        "travel_expense": travel_exp,
                        "stay_exp": stay_exp,
                        "stay_expense": stay_exp,
                        "food_exp": food_exp,
                        "food_expense": food_exp,
                        "misc_exp": misc_exp,
                        "misc_expense": misc_exp,
                        "total_expense": total_amount,
                        "exp_remarks": exp_remarks.strip(),
                        "remarks": exp_remarks.strip(),
                    }
                    if append_to_sheet(
                        "Expense_Logs", exp_data, ensure_columns=True
                    ):
                        st.success(
                            f"Expense {exp_id} recorded for {sel_site_id}: ₹{total_amount:,.2f}."
                        )
                        st.session_state["clear_expense_fields"] = True
                        st.rerun()
                    else:
                        st.error("Expense could not be saved to Expense_Logs. Check the sheet connection and column headers, then retry.")

            st.divider()
            st.subheader("📜 Recent Site Expense Logs")
            df_expenses = read_sheet("Expense_Logs")
            if not df_expenses.empty:
                date_column = next(
                    (column for column in ("logged_date", "exp_date", "expense_date") if column in df_expenses.columns),
                    None,
                )
                if date_column:
                    df_expenses = df_expenses.sort_values(by=date_column, ascending=False)
                for _, expense in df_expenses.head(20).iterrows():
                    with st.container(border=True):
                        st.markdown(
                            f"**{expense.get('installation_id', 'Site')} · "
                            f"{expense.get(date_column or '', 'Undated')} · "
                            f"₹{expense.get('total_expense', 0)}**"
                        )
                        st.caption(
                            f"Supervisor: {expense.get('supervisor_name', 'Not recorded')} · "
                            f"Travel ₹{expense.get('travel_expense', expense.get('travel_exp', 0))} · "
                            f"Stay ₹{expense.get('stay_expense', expense.get('stay_exp', 0))} · "
                            f"Food ₹{expense.get('food_expense', expense.get('food_exp', 0))} · "
                            f"Misc ₹{expense.get('misc_expense', expense.get('misc_exp', 0))}"
                        )
                        remarks = str(expense.get("exp_remarks", expense.get("remarks", ""))).strip()
                        if remarks and remarks.casefold() not in ("nan", "none"):
                            st.write(remarks)
                render_data_drawer(
                    "Inspect and export site expense logs",
                    df_expenses,
                    "supervisor_expense_records",
                )
            else:
                st.info("No expense entries available.")


def render_handover_dashboard():
    st.header("📅 Site Handover Date Dashboard & Delivery Tracker")
    st.caption("Monitor upcoming project handovers, identify delayed/overdue installations, and update delivery targets.")

    df_sites = read_sheet("Sites_Master")
    field_logs = read_sheet("Worker_Daily_Logs")

    if df_sites.empty:
        st.warning("No installation site records found in Sites_Master.")
    else:
        df_sites_clean = df_sites.copy()
        df_sites_clean.columns = [str(c).strip().lower().replace(" ", "_") for c in df_sites_clean.columns]

        today = datetime.now().date()

        if "handover_date" in df_sites_clean.columns:
            df_sites_clean["handover_dt"] = pd.to_datetime(
                df_sites_clean["handover_date"], errors="coerce"
            ).dt.normalize()
        else:
            df_sites_clean["handover_dt"] = pd.Series(
                pd.NaT, index=df_sites_clean.index, dtype="datetime64[ns]"
            )

        total_sites = len(df_sites_clean)
        completed_sites = len(df_sites_clean[df_sites_clean["status"].astype(str).str.strip().str.title().isin(["Handovered", "Completed"])])
        active_sites = df_sites_clean[~df_sites_clean["status"].astype(str).str.strip().str.title().isin(["Handovered", "Completed"])].copy()
        today_timestamp = pd.Timestamp(today)
        overdue_sites = active_sites[
            active_sites["handover_dt"].notna()
            & active_sites["handover_dt"].lt(today_timestamp)
        ]
        due_this_week = active_sites[
            active_sites["handover_dt"].notna()
            & active_sites["handover_dt"].ge(today_timestamp)
            & active_sites["handover_dt"].le(
                pd.Timestamp(today + timedelta(days=7))
            )
        ]

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
            active_sites["days_remaining"] = (
                active_sites["handover_dt"] - today_timestamp
            ).dt.days
            
            fig_handover = px.bar(
                active_sites.dropna(subset=["days_remaining"]),
                x="installation_id",
                y="days_remaining",
                color="status",
                hover_data=["client_name", "site_city", "team_lead", "handover_date"],
                title="Days Remaining Until Handover Target per Site",
                labels={"days_remaining": "Days Remaining (+ Future / - Overdue)", "installation_id": "Site ID"},
            )
            st.plotly_chart(fig_handover, width="stretch")

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
            st.subheader("Handover schedule")
            schedule = active_sites.sort_values(
                by="handover_date", ascending=True, na_position="last"
            )
            for _, site in schedule.iterrows():
                remaining = site.get("days_remaining")
                delayed = pd.notna(remaining) and remaining < 0
                with st.container(border=True):
                    st.markdown(
                        f"**{site.get('installation_id', 'Site')} · "
                        f"{site.get('client_name', 'Client')}**"
                    )
                    st.caption(
                        f"{site.get('site_city', 'Location not recorded')} · "
                        f"Lead: {site.get('team_lead', 'Unassigned')} · "
                        f"Target: {site.get('handover_date', 'Not recorded')}"
                    )
                    if delayed:
                        site_logs = (
                            field_logs[
                                field_logs.get(
                                    "installation_id",
                                    pd.Series("", index=field_logs.index),
                                ).astype(str).str.strip().eq(
                                    str(site.get("installation_id", "")).strip()
                                )
                            ]
                            if not field_logs.empty
                            else pd.DataFrame()
                        )
                        delay_notes = (
                            site_logs.get(
                                "site_remarks",
                                pd.Series("", index=site_logs.index),
                            ).astype(str).str.strip()
                        )
                        delay_notes = delay_notes[
                            delay_notes.ne("") & ~delay_notes.str.casefold().isin(["nan", "none"])
                        ]
                        logged_justification = (
                            delay_notes.iloc[-1] if not delay_notes.empty else ""
                        )
                        justification = (
                            logged_justification
                            or site.get(
                                "delay_justification",
                                site.get("hold_reason", "Not recorded"),
                            )
                        )
                        st.error(
                            f"Danger flag · {abs(int(remaining))} days overdue. "
                            f"Delay justification: {justification}"
                        )
                    elif pd.notna(remaining):
                        st.progress(
                            max(0.0, min(1.0, 1 - int(remaining) / 30)),
                            text=f"{int(remaining)} days remaining",
                        )
            render_data_drawer(
                "Inspect and export active handover schedule",
                schedule,
                "supervisor_handover_schedule",
            )


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
            if not df_sites.empty and "status" in df_sites.columns:
                site_statuses = df_sites["status"].astype(str).str.strip().str.casefold()
                active_site_ids = df_sites.loc[
                    ~site_statuses.isin(["handovered", "handover", "completed", "cancelled"]),
                    "installation_id",
                ].dropna().tolist() if "installation_id" in df_sites.columns else []
            else:
                active_site_ids = (
                    df_sites["installation_id"].dropna().tolist()
                    if not df_sites.empty and "installation_id" in df_sites.columns
                    else []
                )
            site_options = ["All Sites"] + (
                active_site_ids
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
        if "task_category" in filtered_tasks.columns and not filtered_tasks.empty:
            category_counts = (
                filtered_tasks["task_category"]
                .fillna("Not categorized")
                .value_counts()
                .rename_axis("Task")
                .reset_index(name="Assignments")
            )
            st.plotly_chart(
                px.pie(category_counts, names="Task", values="Assignments", hole=0.55),
                width="stretch",
                alt="Task distribution by category",
            )
        for _, task in filtered_tasks.iterrows():
            with st.container(border=True):
                st.markdown(
                    f"**{task.get('task_name', task.get('task_category', 'Task'))} · "
                    f"{task.get('installation_id', 'Site not recorded')}**"
                )
                st.caption(
                    f"{task.get('worker_name', task.get('assigned_worker', 'Worker not assigned'))} · "
                    f"{task.get('status', 'Status not recorded')}"
                )
        if not filtered_tasks.empty:
            leaderboard = filtered_tasks.copy()
            duration = pd.to_numeric(
                leaderboard.get("hours_spent", pd.Series(0, index=leaderboard.index)),
                errors="coerce",
            ).fillna(0) * 60 + pd.to_numeric(
                leaderboard.get("minutes_spent", pd.Series(0, index=leaderboard.index)),
                errors="coerce",
            ).fillna(0)
            leaderboard["duration_minutes"] = duration
            completed_tasks = leaderboard[
                leaderboard.get("status", pd.Series("", index=leaderboard.index))
                .astype(str).str.casefold().eq("completed")
                & leaderboard["duration_minutes"].gt(0)
            ]
            if not completed_tasks.empty and "worker_name" in completed_tasks.columns:
                top_workers = (
                    completed_tasks.groupby("worker_name")["duration_minutes"]
                    .mean()
                    .nsmallest(3)
                    .rename("Average completion minutes")
                    .reset_index()
                )
                st.subheader("Top 3 fastest workers")
                for rank, (_, worker_row) in enumerate(top_workers.iterrows(), start=1):
                    st.success(
                        f"#{rank} {worker_row['worker_name']} · "
                        f"{worker_row['Average completion minutes']:.0f} min average"
                    )
        render_data_drawer(
            "Excel / raw data view · task assignments",
            filtered_tasks,
            "supervisor_task_records",
        )


def render_team_head_dashboard(user_name):
    st.header("👥 Dual-Tab Team Head Dashboard")
    tab_personal, tab_crew, tab_availability = st.tabs(
        ["👤 Personal Work Log", "👨‍🔧 Crew Task Logging", "🗓️ Crew availability"]
    )

    with tab_personal:
        st.subheader(f"Personal Execution Log ({user_name})")
        render_restricted_work_input(target_worker_name=user_name, is_crew_log=False)

    with tab_crew:
        st.subheader("Manage Active Crew Logs")
        df_workers = read_sheet("Workers_Master")
        
        worker_options = format_worker_dropdown_options(
            df_workers, available_only=True
        )

        if not worker_options:
            st.info("⚠️ No Active Crew Members Found")
        else:
            selected_crew_str = st.selectbox("Select Worker to Log For", worker_options)
            selected_crew = selected_crew_str.split(" (")[0].strip()
            st.divider()
            render_restricted_work_input(target_worker_name=selected_crew, is_crew_log=True)

    with tab_availability:
        st.subheader("Real-time crew availability")
        if df_workers.empty or "worker_id" not in df_workers.columns:
            st.info("Worker records with IDs are required to update crew availability.")
        else:
            crew_rows = df_workers[
                df_workers.get(
                    "role", pd.Series("", index=df_workers.index)
                ).astype(str).str.strip().str.casefold().eq("worker")
            ]
            if crew_rows.empty:
                st.info("No workers are available to assign.")
            else:
                availability_values = crew_rows.get(
                    "availability_status",
                    pd.Series("Available", index=crew_rows.index),
                ).fillna("Available").astype(str).str.strip().str.title()
                designations = crew_rows.get(
                    "designation", pd.Series("Worker", index=crew_rows.index)
                ).fillna("Worker").astype(str).str.strip()
                crew_summary = pd.DataFrame(
                    {
                        "Designation": designations,
                        "Availability": availability_values,
                    }
                ).groupby(["Designation", "Availability"]).size().rename("Count").reset_index()
                total_crew = int(len(crew_rows))
                deployed = int(availability_values.eq("On Site").sum())
                available = int(availability_values.eq("Available").sum())
                with st.container(horizontal=True):
                    st.metric("Total crew", total_crew, border=True)
                    st.metric("Deployed", deployed, border=True)
                    st.metric("Available", available, border=True)
                    st.metric("Other status", total_crew - deployed - available, border=True)
                st.plotly_chart(
                    px.bar(
                        crew_summary,
                        x="Designation",
                        y="Count",
                        color="Availability",
                        barmode="stack",
                    ),
                    width="stretch",
                    alt="Crew availability by worker designation",
                )
                crew_labels = {
                    f"{row.get('name', 'Worker')} ({row.get('worker_id')})": str(
                        row.get("worker_id")
                    )
                    for _, row in crew_rows.iterrows()
                }
                selected_label = st.selectbox(
                    "Crew member", list(crew_labels.keys()), key="crew_availability_member"
                )
                worker_id = crew_labels[selected_label]
                with st.form("crew_availability_form"):
                    availability = st.selectbox(
                        "Availability",
                        ["Available", "On Site", "On Leave", "Unavailable"],
                    )
                    availability_note = st.text_input(
                        "Availability note", placeholder="Optional shift or absence details"
                    )
                    save_availability = st.form_submit_button("Save availability")
                if save_availability:
                    if update_sheet_record(
                        "Workers_Master",
                        "worker_id",
                        worker_id,
                        {
                            "availability_status": availability,
                            "availability_note": availability_note.strip(),
                            "availability_updated_at": datetime.now().isoformat(timespec="seconds"),
                            "availability_updated_by": user_name,
                        },
                        ensure_columns=True,
                    ):
                        st.success(f"Availability saved for {selected_label}.")
                        st.rerun()
                render_data_drawer(
                    "Excel / raw data view · crew availability",
                    crew_rows,
                    "crew_availability_records",
                )


def render_post_handover_ratings(user_name):
    st.header("Site handover quality ratings")
    st.caption("Rate each assigned worker across required performance factors after site handover.")
    sites = read_sheet("Sites_Master")
    if sites.empty or "installation_id" not in sites.columns:
        st.info("No sites are available for quality review.")
        return

    status = (
        sites["status"].astype(str).str.strip().str.casefold()
        if "status" in sites.columns
        else pd.Series("", index=sites.index)
    )
    completed = sites[status.isin(["handovered", "handover", "completed"])]
    if completed.empty:
        st.info("No handed-over or completed sites are ready for a QA rating.")
        return

    site_map = {
        f"{row.get('installation_id')} — {row.get('client_name', 'Client')}": str(
            row.get("installation_id")
        ).strip()
        for _, row in completed.iterrows()
    }
    workers = read_sheet("Workers_Master")
    logs = read_sheet("Worker_Daily_Logs")
    with st.form("post_handover_rating_form"):
        selected_site = st.selectbox("Completed site", list(site_map.keys()))
        site_id = site_map[selected_site]
        site_logs = (
            logs[logs.get(
                "installation_id", pd.Series("", index=logs.index)
            ).astype(str).str.strip().eq(site_id)]
            if not logs.empty
            else pd.DataFrame()
        )
        assigned_names = set(
            site_logs.get(
                "worker_name", pd.Series("", index=site_logs.index)
            ).dropna().astype(str).str.strip()
        )
        worker_names = set()
        if "team_lead" in completed.columns:
            match = completed[completed["installation_id"].astype(str).str.strip().eq(site_id)]
            if not match.empty:
                for column in ("team_lead", "team_members"):
                    worker_names.update(
                        name.strip()
                        for name in str(match.iloc[0].get(column, "")).split(",")
                        if name.strip()
                    )
        worker_names.update(assigned_names)
        if not worker_names and not workers.empty and "name" in workers.columns:
            worker_names.update(workers["name"].dropna().astype(str).str.strip())
        rated_workers = st.multiselect(
            "Workers to rate *",
            sorted(worker_names),
            default=sorted(worker_names),
        )
        metric_columns = st.columns(2)
        efficiency = metric_columns[0].slider("Efficiency · 1–10", 1, 10, 8)
        workmanship = metric_columns[1].slider("Workmanship · 1–10", 1, 10, 8)
        safety = metric_columns[0].slider("Safety · 1–10", 1, 10, 8)
        attendance = metric_columns[1].slider("Attendance · 1–10", 1, 10, 8)
        teamwork = metric_columns[0].slider("Teamwork · 1–10", 1, 10, 8)
        notes = st.text_area("Supervisor notes *")
        save_rating = st.form_submit_button("Save worker performance ratings")
    if save_rating:
        if not rated_workers or not notes.strip():
            st.error("Select at least one worker and enter supervisor notes.")
            return
        rating_values = {
            "efficiency_score": efficiency,
            "workmanship_score": workmanship,
            "safety_score": safety,
            "attendance_score": attendance,
            "teamwork_score": teamwork,
        }
        recorded_at = datetime.now().isoformat(timespec="seconds")
        for worker_name in rated_workers:
            worker_match = (
                workers[workers["name"].astype(str).str.strip().eq(worker_name)]
                if not workers.empty and "name" in workers.columns
                else pd.DataFrame()
            )
            worker_id = (
                str(worker_match.iloc[0].get("worker_id", ""))
                if not worker_match.empty
                else ""
            )
            if not append_to_sheet(
                "Worker_Daily_Logs",
                {
                    "record_type": "Performance",
                    "evaluation_id": f"QA-{site_id}-{worker_id or worker_name}-{datetime.now():%Y%m%d%H%M%S}",
                    "installation_id": site_id,
                    "worker_id": worker_id,
                    "worker_name": worker_name,
                    "evaluation_date": str(datetime.now().date()),
                    "evaluated_by": user_name,
                    "evaluated_at": recorded_at,
                    **rating_values,
                    "performance_score": sum(rating_values.values()) / len(rating_values),
                    "evaluation_notes": notes.strip(),
                },
                ensure_columns=True,
            ):
                st.error(f"Could not save the performance rating for {worker_name}.")
                return
        site_rating = sum(rating_values.values()) / len(rating_values)
        if update_sheet_record(
            "Sites_Master",
            "installation_id",
            site_id,
            {
                "post_handover_rating": site_rating,
                "post_handover_feedback": notes.strip(),
                "post_handover_rated_by": user_name,
                "post_handover_rated_at": recorded_at,
            },
            ensure_columns=True,
        ):
            st.success(f"Worker ratings saved for {site_id}.")
            st.rerun()