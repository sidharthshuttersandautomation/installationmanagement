import pandas as pd
import plotly.express as px
import streamlit as st

from installation_app.config import COLOR_PRIMARY
from installation_app.services.sheets import read_sheet, update_sheet_row, generate_excel_download

def render_worker_dashboard(user_name, user_designation):
    st.header(f"⚡ Daily Workspace & Task Pipeline — {user_name} ({user_designation})")
    st.caption("Track your assigned site duties, update live task progress, and view performance metrics.")

    df_sites = read_sheet("Sites_Master")
    df_logs = read_sheet("Worker_Daily_Logs")

    st.markdown("### 🏆 Performance & Metrics Scorecard")

    my_logs = pd.DataFrame()
    if not df_logs.empty and "worker_name" in df_logs.columns:
        my_logs = df_logs[df_logs["worker_name"].astype(str).str.strip().str.lower() == user_name.strip().lower()]

    days_worked = my_logs["logged_date"].nunique() if not my_logs.empty and "logged_date" in my_logs.columns else 0
    days_travelled = len(my_logs[my_logs["is_travel_day"] == "Yes"]) if not my_logs.empty and "is_travel_day" in my_logs.columns else 0
    total_hours = my_logs["hours_spent"].sum() if not my_logs.empty and "hours_spent" in my_logs.columns else 0

    avg_handover_days = "N/A"
    if not df_sites.empty and "installation_id" in df_sites.columns:
        my_site_ids = my_logs["installation_id"].unique() if not my_logs.empty else []
        my_sites = df_sites[df_sites["installation_id"].isin(my_site_ids)].copy()

        if not my_sites.empty and "order_date" in my_sites.columns and "handover_date" in my_sites.columns:
            my_sites["order_dt"] = pd.to_datetime(my_sites["order_date"], errors="coerce")
            my_sites["handover_dt"] = pd.to_datetime(my_sites["handover_date"], errors="coerce")
            my_sites["duration"] = (my_sites["handover_dt"] - my_sites["order_dt"]).dt.days
            valid_durations = my_sites["duration"].dropna()
            if not valid_durations.empty:
                avg_handover_days = f"{round(valid_durations.mean(), 1)} Days"

    perf_score = int((total_hours * 2) + (days_travelled * 15) + (days_worked * 10))

    k1, k2, k3, k4, k5 = st.columns(5)
    with k1:
        st.markdown(f'<div class="kpi-card"><div class="kpi-number">{days_worked}</div><div class="kpi-label">Days Worked</div></div>', unsafe_allow_html=True)
    with k2:
        st.markdown(f'<div class="kpi-card"><div class="kpi-number">{days_travelled}</div><div class="kpi-label">Travel Days</div></div>', unsafe_allow_html=True)
    with k3:
        st.markdown(f'<div class="kpi-card"><div class="kpi-number">{total_hours} hrs</div><div class="kpi-label">Total Hours</div></div>', unsafe_allow_html=True)
    with k4:
        st.markdown(f'<div class="kpi-card"><div class="kpi-number">{avg_handover_days}</div><div class="kpi-label">Avg Handover Speed</div></div>', unsafe_allow_html=True)
    with k5:
        st.markdown(f'<div class="kpi-card"><div class="kpi-number" style="color:#00A859;">{perf_score} pts</div><div class="kpi-label">Performance Score</div></div>', unsafe_allow_html=True)


def render_worker_history_report(user_name):
    st.header(f"📊 Detailed Performance Report — {user_name}")

    df_logs = read_sheet("Worker_Daily_Logs")

    if df_logs.empty or "worker_name" not in df_logs.columns:
        st.info("⚠️ No Field Logs Recorded Yet")
    else:
        my_logs = df_logs[df_logs["worker_name"].astype(str).str.strip().str.lower() == user_name.strip().lower()]

        if my_logs.empty:
            st.info("⚠️ You have not submitted any daily work logs yet.")
        else:
            excel_bytes = generate_excel_download(my_logs, f"{user_name}_Performance_Report.xlsx")
            st.download_button(
                "📥 Download Performance Excel Report",
                data=excel_bytes,
                file_name=f"{user_name}_Performance_Report.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )

            st.write("##")
            st.subheader("📈 Execution Breakdown")
            c_g1, c_g2 = st.columns(2)

            with c_g1:
                fig_hrs = px.bar(
                    my_logs,
                    x="logged_date",
                    y="hours_spent",
                    color="installation_id",
                    title="Daily Hours Logged per Site",
                )
                st.plotly_chart(fig_hrs, use_container_width=True)

            with c_g2:
                if "task_category" in my_logs.columns:
                    fig_pie = px.pie(
                        my_logs,
                        names="task_category",
                        values="hours_spent",
                        title="Time Distribution by Task Category",
                    )
                    st.plotly_chart(fig_pie, use_container_width=True)

            st.divider()
            st.subheader(f"📜 Submitted Work Logs ({len(my_logs)} Entries)")
            disp_cols = [
                c
                for c in [
                    "log_id",
                    "site_day",
                    "logged_date",
                    "installation_id",
                    "worker_role",
                    "team_lead_name",
                    "task_category",
                    "task_name",
                    "hours_spent",
                    "minutes_spent",
                    "is_travel_day",
                    "site_remarks",
                ]
                if c in my_logs.columns
            ]
            st.dataframe(my_logs[disp_cols].sort_values(by="logged_date", ascending=False), use_container_width=True)


def render_employee_analytics_reports():
    st.header("👥 Employee Work Analytics & Dynamic Performance Reports")
    st.caption("Comprehensive productivity tracking, time distribution, and individual employee analytics.")

    df_logs = read_sheet("Worker_Daily_Logs")
    df_workers = read_sheet("Workers_Master")

    if df_workers.empty:
        st.warning("No workers found in Workers_Master.")
    else:
        all_workers = sorted(df_workers["name"].dropna().unique().tolist())

        total_workers_cnt = len(all_workers)
        total_hours = df_logs["hours_spent"].sum() if not df_logs.empty and "hours_spent" in df_logs.columns else 0
        total_days = df_logs["logged_date"].nunique() if not df_logs.empty and "logged_date" in df_logs.columns else 0
        total_travel_days = len(df_logs[df_logs["is_travel_day"].astype(str).str.title() == "Yes"]) if not df_logs.empty and "is_travel_day" in df_logs.columns else 0

        e1, e2, e3, e4 = st.columns(4)
        with e1:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{total_workers_cnt}</div><div class="kpi-label">Total System Personnel</div></div>', unsafe_allow_html=True)
        with e2:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{total_hours} hrs</div><div class="kpi-label">Total Field Work Hours</div></div>', unsafe_allow_html=True)
        with e3:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{total_days}</div><div class="kpi-label">Unique Active Days</div></div>', unsafe_allow_html=True)
        with e4:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{total_travel_days}</div><div class="kpi-label">Outstation Travel Days</div></div>', unsafe_allow_html=True)

        st.divider()

        if not df_logs.empty:
            g1, g2 = st.columns(2)
            with g1:
                st.subheader("⏳ Work Hours per Employee")
                worker_hrs = df_logs.groupby("worker_name")["hours_spent"].sum().reset_index()
                fig_worker_hrs = px.bar(
                    worker_hrs,
                    x="worker_name",
                    y="hours_spent",
                    color="hours_spent",
                    labels={"worker_name": "Worker Name", "hours_spent": "Total Hours"},
                )
                st.plotly_chart(fig_worker_hrs, use_container_width=True)

            with g2:
                st.subheader("🛠️️ Task Category Distribution")
                cat_hrs = df_logs.groupby("task_category")["hours_spent"].sum().reset_index()
                fig_cat = px.pie(
                    cat_hrs,
                    names="task_category",
                    values="hours_spent",
                    hole=0.4,
                )
                st.plotly_chart(fig_cat, use_container_width=True)

        st.divider()

        st.subheader("👤 Dynamic Report per Employee")
        
        selected_emp = st.selectbox("Select Employee to View Dynamic Individual Report *", options=all_workers)
        
        emp_meta = df_workers[df_workers["name"] == selected_emp]
        emp_role = emp_meta.iloc[0].get("role", "N/A") if not emp_meta.empty else "N/A"
        emp_desig = emp_meta.iloc[0].get("designation", "N/A") if not emp_meta.empty else "N/A"
        emp_id = emp_meta.iloc[0].get("worker_id", "N/A") if not emp_meta.empty else "N/A"
        emp_base = emp_meta.iloc[0].get("base_location", "Jaipur") if not emp_meta.empty else "Jaipur"

        emp_logs = df_logs[df_logs["worker_name"] == selected_emp] if not df_logs.empty and "worker_name" in df_logs.columns else pd.DataFrame()

        st.markdown(
            f"""
            <div class="card-box">
                <h3 style="margin:0; color:{COLOR_PRIMARY};">{selected_emp} ({emp_id})</h3>
                <p style="margin:5px 0;"><b>Role:</b> {emp_role} | <b>Designation:</b> {emp_desig} | <b>Base Station:</b> {emp_base}</p>
            </div>
            """,
            unsafe_allow_html=True,
        )

        w_hrs = emp_logs["hours_spent"].sum() if not emp_logs.empty and "hours_spent" in emp_logs.columns else 0
        w_days = emp_logs["logged_date"].nunique() if not emp_logs.empty and "logged_date" in emp_logs.columns else 0
        w_sites = emp_logs["installation_id"].nunique() if not emp_logs.empty and "installation_id" in emp_logs.columns else 0
        w_travels = len(emp_logs[emp_logs["is_travel_day"].astype(str).str.title() == "Yes"]) if not emp_logs.empty and "is_travel_day" in emp_logs.columns else 0

        m1, m2, m3, m4 = st.columns(4)
        with m1:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{w_hrs} hrs</div><div class="kpi-label">Hours Logged</div></div>', unsafe_allow_html=True)
        with m2:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{w_days} Days</div><div class="kpi-label">Days Logged</div></div>', unsafe_allow_html=True)
        with m3:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{w_sites} Sites</div><div class="kpi-label">Sites Assigned</div></div>', unsafe_allow_html=True)
        with m4:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{w_travels} Days</div><div class="kpi-label">Travel Days</div></div>', unsafe_allow_html=True)

        if emp_logs.empty:
            st.info(f"No daily activity logs found for {selected_emp} yet.")
        else:
            col_chart1, col_chart2 = st.columns(2)
            with col_chart1:
                st.caption("Daily Logged Hours Timeline")
                fig_emp_daily = px.bar(emp_logs, x="logged_date", y="hours_spent", color="installation_id", title=f"{selected_emp} - Daily Hours per Site")
                st.plotly_chart(fig_emp_daily, use_container_width=True)
            with col_chart2:
                st.caption("Task Allocation Breakdown")
                if "task_category" in emp_logs.columns:
                    fig_emp_cat = px.pie(emp_logs, names="task_category", values="hours_spent", title=f"{selected_emp} - Time Allocation")
                    st.plotly_chart(fig_emp_cat, use_container_width=True)

            st.write("#### 📜 Submitted Field Logs for " + selected_emp)
            disp_cols = [c for c in ["logged_date", "site_day", "installation_id", "task_category", "task_name", "hours_spent", "minutes_spent", "is_travel_day", "site_remarks"] if c in emp_logs.columns]
            st.dataframe(emp_logs[disp_cols].sort_values(by="logged_date", ascending=False), use_container_width=True)

            excel_emp = generate_excel_download(emp_logs, f"{selected_emp}_Analytics.xlsx")
            st.download_button(
                f"📥 Download {selected_emp}'s Report Excel",
                data=excel_emp,
                file_name=f"{selected_emp}_Analytics_Report.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )


def render_user_profile_settings(user, user_name, user_id, user_role, user_designation, user_base_location):
    st.header("👤 Profile & Security Settings")

    col_l, col_center, col_r = st.columns([0.1, 0.8, 0.1])
    with col_center:
        st.markdown(
            f"""
            <div class="card-box">
                <h3 style="margin:0;">{user_name}</h3>
                <p style="margin:5px 0;"><b>Designation:</b> {user_designation}</p>
                <p style="margin:5px 0;"><b>Access Role:</b> {user_role}</p>
                <p style="margin:5px 0;"><b>Work ID:</b> {user_id}</p>
                <p style="margin:5px 0;"><b>Phone:</b> {user.get('phone_no', 'N/A')}</p>
                <p style="margin:5px 0;"><b>Base Station:</b> {user_base_location}</p>
            </div>
        """,
            unsafe_allow_html=True,
        )

        st.subheader("🔑 Change Security PIN")
        with st.form("change_pin_form"):
            curr_pin = st.text_input("Current PIN", type="password")
            new_pin1 = st.text_input("New 4-Digit PIN", type="password", max_chars=4)
            new_pin2 = st.text_input("Confirm New PIN", type="password", max_chars=4)

            update_pin_btn = st.form_submit_button("Update Security PIN", use_container_width=True)

            if update_pin_btn:
                if str(curr_pin).strip() != str(user.get("pin", "")).strip():
                    st.error("Incorrect current PIN!")
                elif not new_pin1 or len(new_pin1) < 4:
                    st.error("New PIN must be at least 4 digits.")
                elif new_pin1 != new_pin2:
                    st.error("New PINs do not match!")
                else:
                    success = update_sheet_row("Workers_Master", "name", user_name, {"pin": new_pin1.strip()})
                    if success:
                        st.session_state.authenticated_user["pin"] = new_pin1.strip()
                        st.success("PIN updated successfully!")
                        st.rerun()