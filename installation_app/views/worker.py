from datetime import datetime
import uuid

import pandas as pd
import plotly.express as px
import streamlit as st

from installation_app.config import COLOR_PRIMARY
from installation_app.services.sheets import (
    read_sheet,
    update_sheet_row,
    update_sheet_record,
    generate_excel_download,
    append_to_sheet,
)
from installation_app.components.ui import render_data_drawer
from installation_app.services.drive import upload_file_to_drive


def _exclude_attendance_rows(frame):
    if not frame.empty and "record_type" in frame.columns:
        return frame[
            ~frame["record_type"].astype(str).str.strip().str.casefold().isin(
                ["attendance", "performance"]
            )
        ].copy()
    return frame


@st.fragment(run_every="60s")
def _render_shift_timer(site_id, punch_in_at, attendance_id):
    started_at = pd.to_datetime(punch_in_at, errors="coerce", utc=True)
    elapsed = (
        max(0, int((pd.Timestamp.now(tz="UTC") - started_at).total_seconds() // 60))
        if pd.notna(started_at)
        else 0
    )
    st.info(
        f"Open shift at {site_id or 'site'} · started {punch_in_at or 'unknown time'} · "
        f"{elapsed // 60}h {elapsed % 60}m elapsed."
    )
    if st.button("Refresh site timer", key=f"worker_timer_refresh_{attendance_id}"):
        st.rerun()


def render_worker_attendance(user_name, user_id):
    st.subheader("Site attendance and photo check-in")
    sites = read_sheet("Sites_Master")
    logs = read_sheet("Worker_Daily_Logs")
    if logs.empty:
        attendance = pd.DataFrame()
    else:
        attendance = logs[
            logs.get(
                "record_type", pd.Series("", index=logs.index)
            ).astype(str).str.strip().str.casefold().eq("attendance")
        ].copy()

    identity_column = (
        "worker_id"
        if user_id and "worker_id" in attendance.columns
        else "worker_name"
    )
    identity = str(user_id if identity_column == "worker_id" else user_name).strip()
    today = datetime.now().date()
    mine = pd.DataFrame()
    if not attendance.empty:
        attendance_dates = pd.to_datetime(
            attendance.get("logged_date", pd.Series("", index=attendance.index)),
            errors="coerce",
        ).dt.normalize()
        mine = attendance[
            attendance.get(
                identity_column, pd.Series("", index=attendance.index)
            ).astype(str).str.strip().str.casefold().eq(identity.casefold())
            & attendance_dates.eq(pd.Timestamp(today))
        ]
        open_shifts = mine[
            mine.get(
                "punch_out_at", pd.Series("", index=mine.index)
            ).astype(str).str.strip().eq("")
        ]
    else:
        open_shifts = pd.DataFrame()

    if not open_shifts.empty:
        shift = open_shifts.iloc[-1]
        attendance_id = str(shift.get("attendance_id", "")).strip()
        site_id = str(shift.get("installation_id", "")).strip()
        _render_shift_timer(site_id, shift.get("punch_in_at"), attendance_id)
        departure_photo = st.file_uploader(
            "Departure photo *",
            type=["jpg", "jpeg", "png"],
            key=f"worker_departure_photo_{attendance_id}",
        )
        if st.button(
            "Punch out and save shift",
            key=f"worker_punch_out_{attendance_id}",
            disabled=departure_photo is None,
        ):
            photo_url = upload_file_to_drive(
                departure_photo,
                f"{attendance_id}_departure_{departure_photo.name}",
            )
            if not photo_url or photo_url == "Upload Failed":
                st.error("Departure photo upload failed; the shift is still open.")
            else:
                ended_at = pd.Timestamp.now(tz="UTC")
                punch_in_utc = pd.to_datetime(
                    shift.get("punch_in_at"), errors="coerce", utc=True
                )
                elapsed_minutes = max(
                    0, int((ended_at - punch_in_utc).total_seconds() // 60)
                ) if pd.notna(punch_in_utc) else 0
                if update_sheet_record(
                    "Worker_Daily_Logs",
                    "attendance_id",
                    attendance_id,
                    {
                        "punch_out_at": ended_at.isoformat(timespec="seconds"),
                        "departure_photo_url": photo_url,
                        "elapsed_minutes": elapsed_minutes,
                        "shift_status": "Complete",
                    },
                    ensure_columns=True,
                ):
                    st.success("Shift completed and departure photo recorded.")
                    st.rerun()
    else:
        if not mine.empty:
            completed_shifts = mine[
                mine.get(
                    "punch_out_at", pd.Series("", index=mine.index)
                ).astype(str).str.strip().ne("")
            ]
            if not completed_shifts.empty:
                shift = completed_shifts.iloc[-1]
                st.success(
                    f"Latest shift at {shift.get('installation_id', 'site')}: "
                    f"{shift.get('elapsed_minutes', 0)} minutes recorded."
                )
                for photo_label, photo_column in (
                    ("Arrival photo", "arrival_photo_url"),
                    ("Departure photo", "departure_photo_url"),
                ):
                    photo_url = str(shift.get(photo_column, "")).strip()
                    if photo_url.startswith("http"):
                        st.link_button(photo_label, photo_url)
        if sites.empty or "installation_id" not in sites.columns:
            st.info("No active site is available for attendance check-in.")
            return
        site_status = (
            sites["status"].astype(str).str.strip().str.casefold()
            if "status" in sites.columns
            else pd.Series("", index=sites.index)
        )
        active_sites = sites[
            ~site_status.isin(["handovered", "handover", "completed", "cancelled"])
        ]
        site_options = {
            f"{row.get('installation_id')} — {row.get('client_name', 'Client')}": str(
                row.get("installation_id")
            ).strip()
            for _, row in active_sites.iterrows()
            if str(row.get("installation_id", "")).strip()
        }
        if not site_options:
            st.info("No active site is available for attendance check-in.")
            return
        selected_site = st.selectbox(
            "Active site",
            list(site_options.keys()),
            key=f"worker_attendance_site_{user_id}",
        )
        arrival_photo = st.file_uploader(
            "Arrival photo *",
            type=["jpg", "jpeg", "png"],
            key=f"worker_arrival_photo_{user_id}_{today}",
        )
        if st.button(
            "Punch in and start site timer",
            key=f"worker_punch_in_{user_id}_{today}",
            disabled=arrival_photo is None,
        ):
            attendance_id = f"ATT-{today:%Y%m%d}-{uuid.uuid4().hex[:8].upper()}"
            photo_url = upload_file_to_drive(
                arrival_photo,
                f"{attendance_id}_arrival_{arrival_photo.name}",
            )
            if not photo_url or photo_url == "Upload Failed":
                st.error("Arrival photo upload failed; check-in was not recorded.")
            else:
                started_at = pd.Timestamp.now(tz="UTC")
                record = {
                    "record_type": "Attendance",
                    "attendance_id": attendance_id,
                    "worker_id": user_id,
                    "worker_name": user_name,
                    "installation_id": site_options[selected_site],
                    "logged_date": str(today),
                    "punch_in_at": started_at.isoformat(timespec="seconds"),
                    "arrival_photo_url": photo_url,
                    "shift_status": "Open",
                }
                if append_to_sheet(
                    "Worker_Daily_Logs", record, ensure_columns=True
                ):
                    st.success("Checked in; the site timer has started.")
                    st.rerun()
                else:
                    st.error("Check-in could not be saved to Worker_Daily_Logs.")

def render_worker_dashboard(user_name, user_designation, user_id=""):
    st.header(f"⚡ Daily Workspace & Task Pipeline — {user_name} ({user_designation})")
    st.caption("Track your assigned site duties, update live task progress, and view performance metrics.")

    df_sites = read_sheet("Sites_Master")
    df_logs = read_sheet("Worker_Daily_Logs")
    render_worker_attendance(user_name, user_id)

    st.markdown("### 🏆 Performance & Metrics Scorecard")

    my_logs = pd.DataFrame()
    if not df_logs.empty and "worker_name" in df_logs.columns:
        activity_logs = _exclude_attendance_rows(df_logs)
        my_logs = activity_logs[activity_logs["worker_name"].astype(str).str.strip().str.lower() == user_name.strip().lower()]

    if not my_logs.empty and "hours_spent" in my_logs.columns:
        my_logs = my_logs.copy()
        my_logs["hours_spent"] = pd.to_numeric(
            my_logs["hours_spent"], errors="coerce"
        ).fillna(0)

    days_worked = int(my_logs["logged_date"].nunique()) if not my_logs.empty and "logged_date" in my_logs.columns else 0
    days_travelled = (
        int(my_logs["is_travel_day"].astype(str).str.strip().str.casefold().eq("yes").sum())
        if not my_logs.empty and "is_travel_day" in my_logs.columns
        else 0
    )
    total_hours = float(my_logs["hours_spent"].sum()) if not my_logs.empty and "hours_spent" in my_logs.columns else 0.0
    days_travelled = int(days_travelled or 0)
    days_worked = int(days_worked or 0)
    total_hours = float(total_hours or 0)

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
    df_logs = _exclude_attendance_rows(df_logs)

    if df_logs.empty or "worker_name" not in df_logs.columns:
        st.info("⚠️ No Field Logs Recorded Yet")
    else:
        my_logs = df_logs[df_logs["worker_name"].astype(str).str.strip().str.lower() == user_name.strip().lower()]

        if my_logs.empty:
            st.info("⚠️ You have not submitted any daily work logs yet.")
        else:
            my_logs = my_logs.copy()
            for numeric_column in ("hours_spent", "minutes_spent"):
                if numeric_column in my_logs.columns:
                    my_logs[numeric_column] = pd.to_numeric(
                        my_logs[numeric_column], errors="coerce"
                    ).fillna(0)
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
                st.plotly_chart(fig_hrs, width="stretch")

            with c_g2:
                if "task_category" in my_logs.columns:
                    fig_pie = px.pie(
                        my_logs,
                        names="task_category",
                        values="hours_spent",
                        title="Time Distribution by Task Category",
                    )
                    st.plotly_chart(fig_pie, width="stretch")

            st.divider()
            st.subheader(f"📜 Recent work activity ({len(my_logs)} entries)")
            ordered_logs = my_logs.sort_values(
                by="logged_date", ascending=False
            ) if "logged_date" in my_logs.columns else my_logs
            for _, activity in ordered_logs.iterrows():
                with st.expander(
                    f"{activity.get('logged_date', 'Undated')} · "
                    f"{activity.get('installation_id', 'Site')} · "
                    f"{activity.get('task_name', activity.get('task_category', 'Task'))}"
                ):
                    st.write(f"**Hours:** {activity.get('hours_spent', 0)}")
                    st.write(f"**Travel day:** {activity.get('is_travel_day', 'Not recorded')}")
                    st.write(activity.get("site_remarks", "No notes recorded."))
            render_data_drawer(
                "Inspect and search this employee's raw logs",
                my_logs,
                f"worker_history_{user_name.strip().lower().replace(' ', '_')}",
            )


def render_employee_analytics_reports():
    st.header("👥 Employee Work Analytics & Dynamic Performance Reports")
    st.caption("Comprehensive productivity tracking, time distribution, and individual employee analytics.")

    df_logs = read_sheet("Worker_Daily_Logs")
    df_ratings = df_logs.copy()
    if not df_ratings.empty and "record_type" in df_ratings.columns:
        df_ratings = df_ratings[
            df_ratings["record_type"].astype(str).str.strip().str.casefold().eq("performance")
        ].copy()
    else:
        df_ratings = pd.DataFrame()
    df_logs = _exclude_attendance_rows(df_logs)
    df_workers = read_sheet("Workers_Master")
    if not df_logs.empty:
        df_logs = df_logs.copy()
        for numeric_column in ("hours_spent", "minutes_spent"):
            if numeric_column in df_logs.columns:
                df_logs[numeric_column] = pd.to_numeric(
                    df_logs[numeric_column], errors="coerce"
                ).fillna(0)

    if df_workers.empty:
        st.warning("No workers found in Workers_Master.")
    else:
        all_workers = sorted(df_workers["name"].dropna().unique().tolist())

        total_workers_cnt = len(all_workers)
        total_hours = df_logs["hours_spent"].sum() if not df_logs.empty and "hours_spent" in df_logs.columns else 0
        total_days = df_logs["logged_date"].nunique() if not df_logs.empty and "logged_date" in df_logs.columns else 0
        total_travel_days = int(df_logs["is_travel_day"].astype(str).str.strip().str.casefold().eq("yes").sum()) if not df_logs.empty and "is_travel_day" in df_logs.columns else 0

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
                st.plotly_chart(fig_worker_hrs, width="stretch")

            with g2:
                st.subheader("🛠️️ Task Category Distribution")
                cat_hrs = df_logs.groupby("task_category")["hours_spent"].sum().reset_index()
                fig_cat = px.pie(
                    cat_hrs,
                    names="task_category",
                    values="hours_spent",
                    hole=0.4,
                )
                st.plotly_chart(fig_cat, width="stretch")

        st.divider()

        st.subheader("👤 Dynamic Report per Employee")
        
        selected_emp = st.selectbox("Select Employee to View Dynamic Individual Report *", options=all_workers)
        
        emp_meta = df_workers[df_workers["name"] == selected_emp]
        emp_role = emp_meta.iloc[0].get("role", "N/A") if not emp_meta.empty else "N/A"
        emp_desig = emp_meta.iloc[0].get("designation", "N/A") if not emp_meta.empty else "N/A"
        emp_id = emp_meta.iloc[0].get("worker_id", "N/A") if not emp_meta.empty else "N/A"
        emp_base = emp_meta.iloc[0].get("base_location", "Jaipur") if not emp_meta.empty else "Jaipur"

        emp_logs = df_logs[df_logs["worker_name"] == selected_emp] if not df_logs.empty and "worker_name" in df_logs.columns else pd.DataFrame()
        emp_ratings = (
            df_ratings[
                df_ratings.get(
                    "worker_name", pd.Series("", index=df_ratings.index)
                ).astype(str).str.strip().str.casefold().eq(str(selected_emp).strip().casefold())
            ]
            if not df_ratings.empty
            else pd.DataFrame()
        )

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
        quality_scores = (
            pd.to_numeric(emp_ratings["performance_score"], errors="coerce").dropna()
            if not emp_ratings.empty and "performance_score" in emp_ratings.columns
            else pd.Series(dtype="float64")
        )
        average_quality = float(quality_scores.mean()) if not quality_scores.empty else None

        m1, m2, m3, m4, m5 = st.columns(5)
        with m1:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{w_hrs} hrs</div><div class="kpi-label">Hours Logged</div></div>', unsafe_allow_html=True)
        with m2:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{w_days} Days</div><div class="kpi-label">Days Logged</div></div>', unsafe_allow_html=True)
        with m3:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{w_sites} Sites</div><div class="kpi-label">Sites Assigned</div></div>', unsafe_allow_html=True)
        with m4:
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{w_travels} Days</div><div class="kpi-label">Travel Days</div></div>', unsafe_allow_html=True)
        with m5:
            score_text = f"{average_quality:.1f} / 10" if average_quality is not None else "Not rated"
            st.markdown(f'<div class="kpi-card"><div class="kpi-number">{score_text}</div><div class="kpi-label">Supervisor QA Score</div></div>', unsafe_allow_html=True)

        if not emp_ratings.empty:
            with st.expander("Supervisor performance rating history"):
                for _, rating in emp_ratings.iterrows():
                    st.markdown(
                        f"**{rating.get('logged_date', 'Date not recorded')} · "
                        f"{rating.get('installation_id', 'Site')} · "
                        f"{rating.get('performance_score', 'N/A')} / 10**"
                    )
                    st.caption(
                        f"Efficiency {rating.get('efficiency_score', '—')} · "
                        f"Workmanship {rating.get('workmanship_score', '—')} · "
                        f"Safety {rating.get('safety_score', '—')} · "
                        f"Attendance {rating.get('attendance_score', '—')} · "
                        f"Teamwork {rating.get('teamwork_score', '—')}"
                    )
                    st.write(rating.get("evaluation_notes", "No supervisor notes recorded."))

        if emp_logs.empty:
            st.info(f"No daily activity logs found for {selected_emp} yet.")
        else:
            col_chart1, col_chart2 = st.columns(2)
            with col_chart1:
                st.caption("Daily Logged Hours Timeline")
                fig_emp_daily = px.bar(emp_logs, x="logged_date", y="hours_spent", color="installation_id", title=f"{selected_emp} - Daily Hours per Site")
                st.plotly_chart(fig_emp_daily, width="stretch")
            with col_chart2:
                st.caption("Task Allocation Breakdown")
                if "task_category" in emp_logs.columns:
                    fig_emp_cat = px.pie(emp_logs, names="task_category", values="hours_spent", title=f"{selected_emp} - Time Allocation")
                    st.plotly_chart(fig_emp_cat, width="stretch")

            st.write("#### 📜 Recent field activity for " + selected_emp)
            ordered_logs = emp_logs.sort_values(
                by="logged_date", ascending=False
            ) if "logged_date" in emp_logs.columns else emp_logs
            for _, activity in ordered_logs.iterrows():
                with st.expander(
                    f"{activity.get('logged_date', 'Undated')} · "
                    f"{activity.get('installation_id', 'Site')} · "
                    f"{activity.get('task_name', activity.get('task_category', 'Task'))}"
                ):
                    st.write(f"**Hours:** {activity.get('hours_spent', 0)}")
                    st.write(f"**Travel day:** {activity.get('is_travel_day', 'Not recorded')}")
                    st.write(activity.get("site_remarks", "No notes recorded."))
            render_data_drawer(
                "Inspect and export this employee's raw logs",
                emp_logs,
                f"employee_logs_{str(selected_emp).strip().lower().replace(' ', '_')}",
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

            update_pin_btn = st.form_submit_button("Update Security PIN", width="stretch")

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