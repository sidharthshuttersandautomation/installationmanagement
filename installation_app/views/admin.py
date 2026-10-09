from datetime import datetime, timedelta
import re
import pandas as pd
import plotly.express as px
import streamlit as st

from installation_app.config import SYSTEM_ROLES, WORKER_DESIGNATIONS
from installation_app.services.sheets import (
    read_sheet,
    append_to_sheet,
    update_sheet_row,
    update_sheet_record,
    delete_sheet_row,
    generate_excel_download,
)
from installation_app.components.ui import (
    generate_work_id,
    render_data_drawer,
    validate_email,
)


def _report_frame(sheet_name):
    """Read a sheet and normalize its headers for optional-column-safe reports."""
    frame = read_sheet(sheet_name)
    if frame.empty:
        return frame
    frame = frame.copy()
    frame.columns = [
        re.sub(r"[\s\-]+", "_", str(column).strip().lower())
        for column in frame.columns
    ]
    return frame.loc[:, ~frame.columns.duplicated()]


def _report_column(frame, *names):
    for name in names:
        normalized = re.sub(r"[\s\-]+", "_", name.strip().lower())
        if normalized in frame.columns:
            return frame[normalized]
    return pd.Series("", index=frame.index, dtype="object")


def _report_amounts(values):
    cleaned = values.astype(str).str.replace(r"[₹,\s]", "", regex=True)
    return pd.to_numeric(cleaned, errors="coerce").fillna(0)


def _report_first_amount(frame, *names):
    for name in names:
        normalized = re.sub(r"[\s\-]+", "_", name.strip().lower())
        if normalized in frame.columns:
            return _report_amounts(frame[normalized])
    return pd.Series(0.0, index=frame.index, dtype="float64")


def _report_date(values):
    raw = values.astype(str).str.strip()
    parsed = pd.to_datetime(raw, errors="coerce", format="mixed")
    day_first = raw.str.match(r"^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$")
    if day_first.any():
        parsed.loc[day_first] = pd.to_datetime(
            raw.loc[day_first], errors="coerce", format="mixed", dayfirst=True
        )
    return parsed


def _report_expenses_by_site(expenses):
    if expenses.empty:
        return pd.Series(dtype="float64")

    site_ids = _report_column(expenses, "installation_id").astype(str).str.strip()
    total = _report_amounts(_report_column(expenses, "total_expense"))
    if not total.any():
        category_columns = []
        for aliases in (
            ("travel_expense", "travel_exp"),
            ("stay_expense", "stay_exp"),
            ("food_expense", "food_exp"),
            ("misc_expense", "misc_exp"),
        ):
            column = next((name for name in aliases if name in expenses.columns), None)
            if column:
                category_columns.append(_report_amounts(expenses[column]))
        if category_columns:
            total = sum(category_columns)
    return pd.DataFrame({"site_id": site_ids, "spent": total}).groupby(
        "site_id"
    )["spent"].sum()


def _report_budget_columns(sites, expenses):
    budgets = _report_amounts(
        _report_column(
            sites,
            "budget_allowed",
            "allocated_budget",
            "approved_budget",
            "site_budget",
            "budget",
        )
    )
    spent = _report_amounts(
        _report_column(sites, "budget_spent", "actual_spent", "actual_cost")
    )
    expense_totals = _report_expenses_by_site(expenses)
    if "installation_id" in sites.columns and not expense_totals.empty:
        mapped_expenses = _report_column(sites, "installation_id").astype(str).str.strip().map(expense_totals)
        spent = spent + mapped_expenses.fillna(0)
    return budgets, spent


def _report_refresh(key):
    if st.button("Refresh data", key=key):
        st.rerun()


def render_executive_dashboard():
    st.header("Executive dashboard")
    st.caption("Company-wide revenue, delivery momentum, operating spend, and upcoming work.")
    _report_refresh("executive_dashboard_refresh")

    sites = _report_frame("Sites_Master")
    expenses = _report_frame("Expense_Logs")
    if sites.empty:
        st.info("No site records are available in Sites_Master.")
        return

    status = _report_column(sites, "status").astype(str).str.strip().str.lower()
    order_dates = _report_date(_report_column(sites, "order_date"))
    deal_status = _report_column(sites, "deal_status").astype(str).str.strip().str.lower()
    confirmed = deal_status.eq("confirmed order")
    if not deal_status.astype(bool).any():
        confirmed = status.isin(["in progress", "on hold", "handovered", "completed"])
    sales_values = _report_amounts(_report_column(sites, "deal_amount"))
    sales_total = float(sales_values[confirmed].sum())
    in_progress = int(status.eq("in progress").sum())
    on_hold = int(status.isin(["on hold", "hold", "paused", "blocked"]).sum())
    completed_mask = status.isin(["handovered", "handover", "completed"])
    completed = int(completed_mask.sum())
    unassigned = (
        _report_column(sites, "team_lead")
        .astype(str)
        .str.strip()
        .str.casefold()
        .isin(["", "nan", "none", "unassigned"])
    )
    upcoming_mask = (
        status.isin(["new", "requested", "queued", "pending", "confirmed"])
        | (unassigned & ~completed_mask & ~status.isin(["cancelled", "lost"]))
    )
    upcoming = int(upcoming_mask.sum())
    _, site_spend = _report_budget_columns(sites, expenses)
    total_spend = float(site_spend.sum())

    with st.container(horizontal=True):
        st.metric("Total sales", f"₹{sales_total:,.0f}", border=True)
        st.metric("Sites in progress", in_progress, border=True)
        st.metric("Sites on hold", on_hold, border=True)
        st.metric("Total site spend", f"₹{total_spend:,.0f}", border=True)
        st.metric("Sites completed", completed, border=True)
        st.metric("Upcoming sites", upcoming, border=True)

    recorded_site_spend = _report_amounts(
        _report_column(sites, "budget_spent", "actual_spent", "actual_cost")
    )
    if expenses.empty and not recorded_site_spend.any():
        st.caption("Spend is zero because no site expense records or actual-spend fields are available.")
    chart_col, alert_col = st.columns([1.1, 1])
    with chart_col:
        st.subheader("Portfolio distribution")
        site_statuses = pd.DataFrame(
            {
                "Status": ["In progress", "On hold", "Completed", "Upcoming"],
                "Sites": [in_progress, on_hold, completed, upcoming],
            }
        )
        site_statuses = site_statuses[site_statuses["Sites"].gt(0)]
        if not site_statuses.empty:
            st.plotly_chart(
                px.pie(
                    site_statuses,
                    names="Status",
                    values="Sites",
                    hole=0.62,
                    title=f"{len(sites)} total site(s)",
                ),
                width="stretch",
                alt="Portfolio distribution across active, held, completed, and upcoming sites",
            )
    with alert_col:
        st.subheader("Dispatch & pre-arrival reminders")
        dispatch_dates = _report_date(_report_column(sites, "target_dispatch_date"))
        today = pd.Timestamp.now().normalize()
        due_soon = dispatch_dates.notna() & dispatch_dates.le(today + pd.Timedelta(days=3))
        dispatched = _report_column(sites, "production_status").astype(str).str.casefold().eq("dispatched")
        alert_sites = sites.loc[due_soon | dispatched]
        if alert_sites.empty:
            st.success("No dispatch reminders are currently due.")
        else:
            for _, alert_site in alert_sites.iterrows():
                site_id = alert_site.get("installation_id", "Site")
                if str(alert_site.get("production_status", "")).casefold() == "dispatched":
                    st.error(
                        f"🚚 {site_id} dispatched — urgent team alignment required. "
                        f"Vehicle: {alert_site.get('dispatch_vehicle', 'not recorded')} · "
                        f"ETA: {alert_site.get('estimated_arrival_at', 'not recorded')}"
                    )
                    tracking = str(alert_site.get("tracking_reference", "")).strip()
                    if tracking.startswith("http"):
                        st.link_button(f"Track {site_id}", tracking)
                else:
                    st.warning(
                        f"Dispatch within three days: {site_id} · "
                        f"{alert_site.get('target_dispatch_date', 'date not recorded')}"
                    )

    st.divider()
    st.subheader("Open sites by status")
    status_choices = ["In progress", "On hold", "Completed", "Upcoming"]
    status_masks = {
        "In progress": status.eq("in progress"),
        "On hold": status.isin(["on hold", "hold", "paused", "blocked"]),
        "Completed": completed_mask,
        "Upcoming": upcoming_mask,
    }
    if "executive_site_filter" not in st.session_state:
        st.session_state["executive_site_filter"] = "In progress"
    filter_columns = st.columns(len(status_choices))
    for column, choice in zip(filter_columns, status_choices):
        if column.button(
            f"{choice} · {int(status_masks[choice].sum())}",
            key=f"executive_filter_{choice.lower().replace(' ', '_')}",
            width="stretch",
        ):
            st.session_state["executive_site_filter"] = choice
    chosen_status = st.session_state["executive_site_filter"]
    selected_sites = sites.loc[status_masks[chosen_status]]
    if selected_sites.empty:
        st.info(f"No {chosen_status.lower()} sites to display.")
    else:
        logs = _report_frame("Worker_Daily_Logs")
        for _, site in selected_sites.iterrows():
            site_id = str(site.get("installation_id", "Site"))
            site_logs = (
                logs[_report_column(logs, "installation_id").astype(str).str.strip().eq(site_id)]
                if not logs.empty
                else pd.DataFrame()
            )
            with st.container(border=True):
                site_col, meta_col = st.columns([2, 1])
                site_col.markdown(f"**{site.get('client_name', 'Client')} · {site_id}**")
                site_col.caption(
                    f"{site.get('status', 'Status not recorded')} · "
                    f"{site.get('site_city', site.get('city', 'Location not recorded'))}"
                )
                progress = int(
                    min(100, max(0, _report_amounts(
                        pd.Series([site.get("site_progress", 0)])
                    ).iloc[0]))
                )
                if progress == 0 and str(site.get("status", "")).casefold() == "in progress":
                    progress = min(95, len(site_logs) * 15)
                site_col.progress(progress, text=f"Progress indicator · {progress}%")
                spent_value = float(site_spend.loc[site.name])
                meta_col.metric("Site spend", f"₹{spent_value:,.0f}")
                meta_col.caption(
                    f"Expected launch / handover: "
                    f"{site.get('handover_date', site.get('expected_handover_date', 'Not recorded'))}"
                )
                with st.expander("Visit history, workforce, notes, and photos"):
                    if site_logs.empty:
                        st.info("No site visit or worker activity has been logged.")
                    else:
                        names = _report_column(site_logs, "worker_name", "worker").astype(str).drop_duplicates()
                        st.write("**Workers:** " + (", ".join(names.tolist()) or "Not recorded"))
                        activity_columns = [
                            name for name in
                            ("logged_date", "worker_name", "task_name", "task_category", "site_remarks")
                            if name in site_logs.columns
                        ]
                        for _, activity in site_logs[activity_columns].iterrows():
                            st.write(
                                f"**{activity.get('logged_date', '')} · "
                                f"{activity.get('worker_name', 'Worker')}** — "
                                f"{activity.get('task_name', activity.get('task_category', 'Activity'))}"
                            )
                            note = str(activity.get("site_remarks", "")).strip()
                            if note and note.casefold() not in ("nan", "none"):
                                st.caption(note)
                        for photo_number, photo in enumerate(
                            _report_column(site_logs, "site_photo", "photo_url").astype(str),
                            start=1,
                        ):
                            if photo.startswith("http"):
                                st.link_button(f"Open site photo {photo_number}", photo)
    render_data_drawer("Inspect and export site records", sites, "executive_site_records")


def render_sites_overview():
    st.header("Active sites")
    st.caption("Completed and handed-over projects are archived in the Master Database.")
    _report_refresh("sites_overview_refresh")
    sites = _report_frame("Sites_Master")
    logs = _report_frame("Worker_Daily_Logs")
    expenses = _report_frame("Expense_Logs")
    if sites.empty:
        st.info("No site records are available in Sites_Master.")
        return

    completed_mask = _report_column(sites, "status").astype(str).str.strip().str.casefold().isin(
        ["handovered", "handover", "completed", "cancelled"]
    )
    sites = sites.loc[~completed_mask].copy()
    if sites.empty:
        st.success("No active sites remain. Completed projects are available in the Master Database.")
        return
    site_ids = _report_column(sites, "installation_id").astype(str).str.strip()
    clients = _report_column(sites, "client_name", "client", "company_name").astype(str)
    statuses = _report_column(sites, "status").astype(str).str.strip()
    search_col, filter_col = st.columns([2, 1])
    query = search_col.text_input("Search sites", placeholder="Site ID, client, or city")
    available_statuses = ["All statuses"] + sorted(statuses[statuses.ne("")].unique().tolist())
    selected_status = filter_col.selectbox("Status", available_statuses, key="site_overview_status")
    city = _report_column(sites, "site_city", "city").astype(str)
    searchable = (site_ids + " " + clients + " " + city).str.casefold()
    visible = sites[searchable.str.contains(query.strip().casefold(), regex=False)] if query.strip() else sites
    if selected_status != "All statuses":
        visible = visible[statuses.loc[visible.index].eq(selected_status)]
    render_data_drawer("Inspect and export filtered site records", visible, "site_detail_records")
    if visible.empty:
        st.info("No sites match the selected search and status.")
        return

    labels = {}
    for index, row in visible.iterrows():
        site_id = str(row.get("installation_id", "")).strip()
        label = f"{site_id} · {row.get('client_name', row.get('client', 'Client'))} · {row.get('status', 'Status')}"
        labels[label] = index
    selected_label = st.selectbox("Open site details", list(labels), key="site_detail_select")
    site = visible.loc[labels[selected_label]]
    site_id = str(site.get("installation_id", "")).strip()

    st.subheader(f"{site_id} · {site.get('client_name', site.get('client', 'Client'))}")
    progress = int(min(100, max(0, _report_amounts(
        pd.Series([site.get("site_progress", 0)])
    ).iloc[0])))
    if progress == 0 and str(site.get("status", "")).casefold() == "in progress":
        progress = 15
    st.progress(progress, text=f"Site execution progress · {progress}%")
    info_col, team_col, budget_col = st.columns(3)
    with info_col:
        st.write(f"**Status:** {site.get('status', 'Not recorded')}")
        st.write(f"**Start / order date:** {site.get('start_date', site.get('installation_start_date', site.get('order_date', 'Not recorded')))}")
        st.write(f"**Expected handover:** {site.get('handover_date', site.get('expected_handover_date', 'Not recorded'))}")
        st.write(f"**Actual handover:** {site.get('actual_handover_date', site.get('completion_date', 'Not recorded'))}")
        st.write(f"**Location:** {site.get('site_city', site.get('city', 'Not recorded'))}")
        rating = site.get("post_handover_rating", site.get("qa_score", ""))
        if str(rating).strip() not in ("", "nan", "None"):
            st.write(f"**Handover quality:** {rating} / 5")
            feedback = str(site.get("post_handover_feedback", "")).strip()
            if feedback and feedback.lower() != "nan":
                st.write(f"**QA feedback:** {feedback}")
    with team_col:
        personnel = []
        for field in ("team_lead", "supervisor", "logistics_contact", "logistics_coordinator"):
            value = str(site.get(field, "")).strip()
            if value and value.lower() not in ("nan", "none"):
                personnel.append(f"{field.replace('_', ' ').title()}: {value}")
        if not logs.empty and "installation_id" in logs.columns:
            site_logs = logs[_report_column(logs, "installation_id").astype(str).str.strip().eq(site_id)]
            worker_column = _report_column(site_logs, "worker_name", "worker")
            if not site_logs.empty:
                logged_at = _report_date(_report_column(site_logs, "logged_date", "date"))
                recent_names = worker_column[logged_at.ge(pd.Timestamp.now() - pd.Timedelta(days=30))].dropna().astype(str).str.strip().unique()
                personnel.extend(f"Active worker: {name}" for name in recent_names if name)
        st.write("**Assigned personnel**")
        st.write("\n\n".join(personnel) if personnel else "Team assignments are not recorded.")
    budgets, spent = _report_budget_columns(sites, expenses)
    allocated = float(budgets.loc[site.name]) if site.name in budgets.index else 0.0
    actual = float(spent.loc[site.name]) if site.name in spent.index else 0.0
    with budget_col:
        st.write("**Financials**")
        st.write(f"Budget allowed: {'₹{:,.0f}'.format(allocated) if allocated else 'Not recorded'}")
        has_site_spend = (
            site_id in _report_expenses_by_site(expenses).index
            or any(column in sites.columns for column in ("budget_spent", "actual_spent", "actual_cost"))
        )
        st.write(f"Budget spent: ₹{actual:,.0f}" if has_site_spend else "Budget spent: Not recorded")
        if allocated > 0:
            st.progress(min(actual / allocated, 1.0), text=f"{actual / allocated:.0%} of allocated budget")

    st.subheader("Site progress photos")
    if not logs.empty and "installation_id" in logs.columns:
        site_logs = logs[_report_column(logs, "installation_id").astype(str).str.strip().eq(site_id)]
        photo_links = _report_column(site_logs, "site_photo", "photo_url", "photo").astype(str)
        photo_dates = _report_column(site_logs, "logged_date", "date").astype(str)
        photos = [(date, url.strip()) for date, url in zip(photo_dates, photo_links) if url.strip().startswith("http")]
        for photo_field in ("arrival_photo_url", "departure_photo_url"):
            if photo_field in site_logs.columns:
                photos.extend(
                    (photo_field.replace("_", " ").title(), url.strip())
                    for url in site_logs[photo_field].astype(str)
                    if url.strip().startswith("http")
                )
    else:
        photos = []
    for photo_field in ("dispatch_photo_url", "delivery_photo_url"):
        photo_url = str(site.get(photo_field, "")).strip()
        if photo_url.startswith("http"):
            photos.append((photo_field.replace("_", " ").title(), photo_url))
    if photos:
        photo_columns = st.columns(min(3, len(photos)))
        for index, (photo_date, url) in enumerate(photos):
            with photo_columns[index % len(photo_columns)]:
                st.link_button(f"Open photo · {photo_date}", url)
    else:
        st.info("No site photos have been logged.")


def _render_sales_department_detail():
    st.header("Sales reports")
    st.caption("Revenue, site status, hold reasons, geographic coverage, and recorded product notes by representative.")
    _report_refresh("sales_reports_refresh")
    sites = _report_frame("Sites_Master")
    if sites.empty:
        st.info("No site or sales records are available.")
        return
    rep_names = _report_column(sites, "salesperson_name", "salesperson", "salesperson_id").astype(str).str.strip()
    names = ["All representatives"] + sorted(name for name in rep_names.unique() if name and name.lower() != "nan")
    rep_col, dates_col = st.columns([1, 2])
    selected_rep = rep_col.selectbox("Sales representative", names, key="sales_report_rep")
    period = dates_col.selectbox(
        "Sales period",
        ["15 Days", "1 Month", "3 Months", "Quarterly", "6 Months", "1 Year", "Custom range"],
        key="sales_report_period",
    )
    today = datetime.now().date()
    period_days = {
        "15 Days": 15,
        "1 Month": 30,
        "3 Months": 90,
        "Quarterly": 90,
        "6 Months": 180,
        "1 Year": 365,
    }
    if period == "Custom range":
        date_range = dates_col.date_input(
            "Order date range",
            value=(today - timedelta(days=30), today),
            key="sales_report_custom_range",
        )
    else:
        date_range = (today - timedelta(days=period_days[period] - 1), today)
    filtered = sites.copy()
    if selected_rep != "All representatives":
        filtered = filtered[rep_names.loc[filtered.index].eq(selected_rep)]
    date_values = _report_date(_report_column(filtered, "order_date"))
    if isinstance(date_range, (tuple, list)) and len(date_range) == 2:
        start, end = pd.Timestamp(date_range[0]), pd.Timestamp(date_range[1]) + pd.Timedelta(days=1)
        filtered = filtered[date_values.ge(start) & date_values.lt(end)]
    if filtered.empty:
        st.info("No sales records match these filters.")
        return
    status = _report_column(filtered, "status").astype(str).str.strip().str.lower()
    deal_stage = _report_column(filtered, "deal_status", "deal_stage").astype(str).str.strip().str.lower()
    confirmed = deal_stage.eq("confirmed order")
    if not deal_stage.astype(bool).any():
        confirmed = status.isin(["in progress", "on hold", "handovered", "completed"])
    sales_amount = _report_amounts(_report_column(filtered, "deal_amount"))
    closed_amount = sales_amount[confirmed].sum()
    held = int(status.isin(["on hold", "hold", "paused", "blocked"]).sum())
    conversion = int(round(100 * int(confirmed.sum()) / max(1, len(filtered))))
    with st.container(horizontal=True):
        st.metric("Confirmed revenue", f"₹{closed_amount:,.0f}", border=True)
        st.metric("Confirmed deals", int(confirmed.sum()), border=True)
        st.metric("In-progress sites", int(status.eq("in progress").sum()), border=True)
        st.metric("Held sites", held, border=True)
        st.metric("Deal conversion", f"{conversion}%", border=True)
    first, second = st.columns(2)
    with first:
        st.subheader("Hold reasons")
        hold_mask = status.isin(["on hold", "hold", "paused", "blocked"])
        reasons = _report_column(filtered, "hold_reason").astype(str).str.strip()
        reason_data = pd.DataFrame({"Reason": reasons[hold_mask & reasons.ne("")]})
        if reason_data.empty:
            st.info("Hold reasons have not been recorded.")
        else:
            st.plotly_chart(px.bar(reason_data["Reason"].value_counts().rename_axis("Reason").reset_index(name="Sites"), x="Reason", y="Sites"), width="stretch", alt="Site counts by hold reason")
    with second:
        st.subheader("Geographical reach")
        locations = _report_column(filtered, "site_city", "city").astype(str).str.strip()
        location_data = pd.DataFrame({"City": locations[locations.ne("")].replace("nan", "Not recorded")})
        if location_data.empty:
            st.info("Site locations have not been recorded.")
        else:
            city_summary = location_data["City"].value_counts().rename_axis("City").reset_index(name="Sites")
            selected_city = st.selectbox(
                "Drill into city",
                ["All cities"] + city_summary["City"].tolist(),
                key="sales_geo_city",
            )
            if selected_city != "All cities":
                filtered = filtered[
                    _report_column(filtered, "site_city", "city").astype(str).eq(selected_city)
                ]
                location_data = location_data[location_data["City"].eq(selected_city)]
                city_summary = city_summary[city_summary["City"].eq(selected_city)]
            st.plotly_chart(
                px.bar(city_summary, x="City", y="Sites"),
                width="stretch",
                alt="Sales coverage by city",
            )
    st.subheader("Products and deal values")
    closed_sites = filtered.loc[confirmed]
    product_notes = _report_column(closed_sites, "products_summary", "product_summary", "product_notes")
    product_table = pd.DataFrame({
        "Site": _report_column(closed_sites, "installation_id"),
        "Representative": rep_names.loc[closed_sites.index],
        "Deal status": deal_stage.loc[closed_sites.index],
        "Product notes": product_notes,
        "Deal value (₹)": sales_amount.loc[closed_sites.index],
        "Loss reason": _report_column(closed_sites, "deal_lost_reason"),
    })
    product_summary = pd.DataFrame(
        {
            "Product": _report_column(closed_sites, "product_finalized", "products_summary"),
            "Quantity": _report_amounts(_report_column(closed_sites, "product_quantity")),
            "Deal value (₹)": sales_amount.loc[closed_sites.index],
        }
    ).groupby("Product", dropna=False).agg(
        Quantity=("Quantity", "sum"),
        Revenue=("Deal value (₹)", "sum"),
    ).reset_index()
    if not product_summary.empty:
        st.plotly_chart(
            px.bar(product_summary, x="Product", y="Revenue"),
            width="stretch",
            alt="Confirmed revenue by product category",
        )
    with st.expander("Closed deal cards"):
        for _, deal in product_table.iterrows():
            with st.container(border=True):
                st.markdown(
                    f"**{deal.get('Site', 'Site')} · {deal.get('Representative', 'Salesperson')}**"
                )
                st.write(
                    f"{deal.get('Product notes', 'Product not recorded')} · "
                    f"₹{float(deal.get('Deal value (₹)', 0)):,.0f}"
                )
                reason = str(deal.get("Loss reason", "")).strip()
                if reason and reason.lower() != "nan":
                    st.caption(f"Deal loss: {reason}")
    st.caption("Product descriptions are free text in the current data source; product quantities and per-product prices cannot be calculated until those fields are captured separately.")
    render_data_drawer("Inspect and export filtered sales records", filtered, "sales_report_records")


def render_sales_department_reports():
    st.header("Sales reports")
    st.caption("Sales, analytics, and operational expense reporting in one place.")
    sales_tab, analytics_tab, expense_tab, operations_tab = st.tabs(
        ["Sales by representative", "Sales analytics", "Site expenses", "Operations analytics"]
    )
    with sales_tab:
        _render_sales_department_detail()
    with analytics_tab:
        render_sales_analytics()
    with expense_tab:
        render_financial_expenses()
    with operations_tab:
        _render_admin_operations_analytics()


def render_logistics_production_reports():
    st.header("Logistics & production reports")
    st.caption("Order-to-fulfillment duration and stage SLAs, based on timestamps captured in site records.")
    _report_refresh("logistics_reports_refresh")
    sites = _report_frame("Sites_Master")
    if sites.empty:
        st.info("No site records are available.")
        return

    stage_pairs = [
        ("Order → production", ("order_date", "order_confirmed_at"), ("production_started_at", "production_start_date")),
        ("Production duration", ("production_started_at", "production_start_date"), ("production_completed_at", "production_completion_date")),
        ("Production → dispatch", ("production_completed_at", "production_completion_date"), ("dispatched_at", "dispatch_date")),
        ("Dispatch → delivery", ("dispatched_at", "dispatch_date"), ("delivered_at", "delivery_date")),
    ]
    report = pd.DataFrame({
        "Site": _report_column(sites, "installation_id"),
        "Client": _report_column(sites, "client_name", "client"),
        "Status": _report_column(sites, "status"),
    })
    captured_pairs = []
    for label, start_names, end_names in stage_pairs:
        start_values = _report_column(sites, *start_names)
        end_values = _report_column(sites, *end_names)
        start_dates, end_dates = _report_date(start_values), _report_date(end_values)
        column_name = f"{label} (days)"
        report[column_name] = (end_dates - start_dates).dt.total_seconds() / 86400
        if start_values.astype(str).str.strip().ne("").any() or end_values.astype(str).str.strip().ne("").any():
            captured_pairs.append(column_name)
    if not captured_pairs:
        st.warning("Production, dispatch, and delivery timestamps are not present in Sites_Master yet. These stage SLAs cannot be measured until those milestones are recorded.")
        for _, site in sites.iterrows():
            site_id = str(site.get("installation_id", "Site"))
            with st.container(border=True):
                st.markdown(f"**{site_id} · {site.get('client_name', 'Client')}**")
                st.caption(
                    f"{site.get('product_finalized', site.get('products_summary', 'Product specs not recorded'))} · "
                    f"{site.get('site_address', site.get('site_city', 'Delivery address not recorded'))}"
                )
                target_days = _report_amounts(
                    pd.Series([site.get("target_production_days", 0)])
                ).iloc[0]
                progress_map = {
                    "not started": 0,
                    "in production": 45,
                    "production complete": 75,
                    "dispatched": 90,
                    "delivered": 100,
                }
                production_status = str(site.get("production_status", "Not Started"))
                percent = progress_map.get(production_status.casefold(), 0)
                st.progress(percent, text=f"{production_status} · {percent}%")
                st.caption(
                    f"Production target: {target_days:g} days · "
                    f"Dispatch target: {site.get('target_dispatch_date', 'Not scheduled')} · "
                    f"Vehicle: {site.get('dispatch_vehicle', 'Not assigned')}"
                )
        render_data_drawer("Excel / raw data view · production orders", sites, "logistics_report_records")
        return
    st.info("Target durations are not currently configured. Durations are shown for visibility; no pass/fail SLA is inferred.")
    for column in captured_pairs:
        report[column] = report[column].round(1)
    target_days = _report_amounts(_report_column(sites, "target_production_days"))
    production_days_column = "Production duration (days)"
    if production_days_column in report.columns:
        production_days = report[production_days_column]
        started = _report_date(
            _report_column(sites, "production_started_at", "production_start_date")
        )
        completed = _report_date(
            _report_column(sites, "production_completed_at", "production_completion_date")
        )
        ongoing_days = (pd.Timestamp.now() - started).dt.total_seconds() / 86400
        observed_days = production_days.where(
            production_days.notna(),
            ongoing_days.where(started.notna() & completed.isna()),
        )
        report["Target production days"] = target_days
        report["Production SLA"] = [
            "Not configured"
            if target <= 0
            else "In progress"
            if pd.isna(actual)
            else "Within target"
            if actual <= target
            else "Over target"
            for actual, target in zip(observed_days, target_days)
        ]
    st.subheader("Order tracking milestones")
    for _, site in sites.iterrows():
        site_id = str(site.get("installation_id", "Site"))
        production_status = str(site.get("production_status", "Not Started"))
        with st.container(border=True):
            left, right = st.columns([2, 1])
            left.markdown(f"**{site_id} · {site.get('client_name', 'Client')}**")
            left.caption(
                f"{site.get('product_finalized', site.get('products_summary', 'Product specs not recorded'))} · "
                f"{site.get('site_address', site.get('site_city', 'Delivery address not recorded'))}"
            )
            status_progress = {
                "not started": 0,
                "in production": 45,
                "production complete": 75,
                "dispatched": 90,
                "delivered": 100,
            }.get(production_status.casefold(), 0)
            left.progress(status_progress, text=f"{production_status} · {status_progress}%")
            right.write(
                f"Target: {site.get('target_production_days', 'Not set')} days · "
                f"Dispatch: {site.get('target_dispatch_date', 'Not set')}"
            )
            right.write(
                f"Vehicle: {site.get('dispatch_vehicle', 'Not recorded')} · "
                f"ETA: {site.get('estimated_arrival_at', 'Not recorded')}"
            )
            tracking_url = str(site.get("tracking_reference", "")).strip()
            if tracking_url.startswith("http"):
                right.link_button("Open tracking link", tracking_url)
            for photo_column in ("completed_product_photo_url", "pre_dispatch_photo_url", "loaded_vehicle_photo_url"):
                photo_url = str(site.get(photo_column, "")).strip()
                if photo_url.startswith("http"):
                    right.link_button(photo_column.replace("_", " ").title(), photo_url)
    render_data_drawer("Excel / raw data view · production SLAs", report, "logistics_sla_records")
    render_data_drawer("Excel / raw data view · all order milestones", sites, "logistics_milestone_records")


def render_management_reports():
    st.header("Management reports")
    st.caption("Site-filtered activity feed, production milestones, and installation progress.")
    _report_refresh("management_reports_refresh")
    logs = _report_frame("Worker_Daily_Logs")
    sites = _report_frame("Sites_Master")
    if logs.empty and sites.empty:
        st.info("No daily activity logs are available.")
        return

    site_ids = (
        _report_column(sites, "installation_id").astype(str).str.strip()
        if not sites.empty
        else pd.Series(dtype="object")
    )
    options = ["All sites"] + sorted(site_id for site_id in site_ids.unique() if site_id and site_id.lower() != "nan")
    chosen_site = st.selectbox("Filter activity by site", options, key="management_site_filter")
    selected_site = (
        sites[site_ids.eq(chosen_site)].iloc[0]
        if chosen_site != "All sites" and not sites.empty and site_ids.eq(chosen_site).any()
        else None
    )
    if not logs.empty and chosen_site != "All sites":
        logs = logs[_report_column(logs, "installation_id").astype(str).str.strip().eq(chosen_site)]

    feed_tab, production_tab, installation_tab, workforce_tab = st.tabs(
        ["Daily activity feed", "Production details", "Installation details", "Workforce scorecards"]
    )
    with feed_tab:
        if logs.empty:
            st.info("No field or management activity is logged for this site.")
        else:
            log_dates = _report_date(_report_column(logs, "logged_date", "date"))
            feed = logs.copy()
            feed["activity_date"] = log_dates
            feed = feed.sort_values("activity_date", ascending=False, na_position="last")
            for _, log in feed.iterrows():
                if str(log.get("record_type", "")).casefold() in ("attendance", "performance"):
                    continue
                with st.container(border=True):
                    st.markdown(
                        f"**{log.get('logged_date', 'Date not recorded')} · "
                        f"{log.get('worker_name', 'Worker')} · "
                        f"{log.get('task_name', log.get('task_category', 'Activity'))}**"
                    )
                    st.caption(
                        f"{log.get('installation_id', 'Site')} · "
                        f"{log.get('worker_role', log.get('designation', 'Role not recorded'))}"
                    )
                    note = str(log.get("site_remarks", "")).strip()
                    if note and note.casefold() not in ("nan", "none"):
                        st.write(note)
                    for photo_field in ("site_photo", "arrival_photo_url", "departure_photo_url"):
                        photo_url = str(log.get(photo_field, "")).strip()
                        if photo_url.startswith("http"):
                            st.link_button(photo_field.replace("_", " ").title(), photo_url)
        render_data_drawer("Excel / raw data view · daily activity", logs, "management_activity_records")

    with production_tab:
        if selected_site is None:
            st.info("Select a specific site above to see its production details.")
        else:
            fields = (
                ("Product specifications", ("product_finalized", "products_summary")),
                ("Production status", ("production_status",)),
                ("Production started", ("production_started_at",)),
                ("Production completed", ("production_completed_at",)),
                ("Target production days", ("target_production_days",)),
                ("Target dispatch", ("target_dispatch_date",)),
                ("Delivery address", ("site_address", "site_city")),
                ("Vehicle registration", ("dispatch_vehicle",)),
                ("Tracking reference", ("tracking_reference",)),
                ("Estimated arrival", ("estimated_arrival_at",)),
            )
            with st.container(border=True):
                for label, aliases in fields:
                    value = next(
                        (selected_site.get(name) for name in aliases if str(selected_site.get(name, "")).strip()),
                        "Not recorded",
                    )
                    st.write(f"**{label}:** {value}")
                for photo_field in (
                    "completed_product_photo_url",
                    "pre_dispatch_photo_url",
                    "loaded_vehicle_photo_url",
                ):
                    photo_url = str(selected_site.get(photo_field, "")).strip()
                    if photo_url.startswith("http"):
                        st.link_button(photo_field.replace("_", " ").title(), photo_url)
            render_data_drawer("Excel / raw data view · production details", pd.DataFrame([selected_site]), "management_production_records")

    with installation_tab:
        if selected_site is None:
            st.info("Select a specific site above to see installation progress.")
        else:
            current_status = str(selected_site.get("status", "In Progress")).casefold()
            milestones = ["Request received", "Team assigned", "Installation in progress", "Quality check", "Handover"]
            team_assigned = bool(str(selected_site.get("team_lead", "")).strip())
            progress_index = (
                4 if current_status in ("handovered", "handover", "completed")
                else 2 if current_status == "in progress"
                else 1 if team_assigned
                else 0
            )
            st.progress(progress_index / (len(milestones) - 1), text=f"Current stage: {milestones[progress_index]}")
            for _, log in logs.iterrows():
                if str(log.get("record_type", "")).casefold() in ("attendance", "performance"):
                    continue
                with st.expander(
                    f"{log.get('logged_date', 'Undated')} · "
                    f"{log.get('worker_name', 'Worker')} · "
                    f"{log.get('task_name', log.get('task_category', 'Activity'))}"
                ):
                    st.write(log.get("site_remarks", "No supervisor remarks recorded."))
                    photo = str(log.get("site_photo", "")).strip()
                    if photo.startswith("http"):
                        st.link_button("Open daily site photo", photo)
            render_data_drawer("Excel / raw data view · installation logs", logs, "management_installation_records")

    with workforce_tab:
        if logs.empty:
            st.info("No worker logs are available for scorecards.")
        else:
            worker_names = _report_column(logs, "worker_name").astype(str)
            hours = _report_amounts(_report_column(logs, "hours_spent")) + _report_amounts(_report_column(logs, "minutes_spent")) / 60
            if "record_type" in logs.columns:
                performance = logs[logs["record_type"].astype(str).str.casefold().eq("performance")]
            else:
                performance = pd.DataFrame()
            scores = _report_amounts(_report_column(performance, "performance_score"))
            score_map = pd.DataFrame(
                {"Worker": _report_column(performance, "worker_name"), "Score": scores}
            ).groupby("Worker")["Score"].mean() if not performance.empty else pd.Series(dtype="float64")
            summary = pd.DataFrame(
                {
                    "Worker": worker_names,
                    "Hours": hours,
                    "Site": _report_column(logs, "installation_id").astype(str),
                    "Date": _report_column(logs, "logged_date", "date").astype(str),
                }
            ).groupby("Worker").agg(
                Hours=("Hours", "sum"),
                Sites=("Site", "nunique"),
                Workdays=("Date", "nunique"),
            )
            summary["QA / performance score"] = score_map
            summary = summary.reset_index()
            st.plotly_chart(
                px.bar(summary, x="Worker", y="Hours", color="QA / performance score"),
                width="stretch",
                alt="Worker hours and recorded performance scores",
            )
            for _, worker_summary in summary.iterrows():
                with st.container(border=True):
                    st.markdown(f"**{worker_summary['Worker']}**")
                    st.caption(
                        f"{worker_summary['Hours']:.1f} hours · {worker_summary['Sites']} sites · "
                        f"{worker_summary['Workdays']} workdays · "
                        f"QA score: {worker_summary['QA / performance score'] if pd.notna(worker_summary['QA / performance score']) else 'Not rated'}"
                    )
            render_data_drawer("Excel / raw data view · workforce scorecards", summary, "management_workforce_records")


def render_worker_reports():
    st.header("Worker reports")
    st.caption("Field productivity, site outcomes, hours logged on travel days, and supervisor quality ratings.")
    _report_refresh("worker_reports_refresh")
    all_logs = _report_frame("Worker_Daily_Logs")
    ratings = all_logs.copy()
    logs = all_logs
    if not logs.empty and "record_type" in logs.columns:
        logs = logs[
            ~logs["record_type"].astype(str).str.strip().str.casefold().isin(
                ["attendance", "performance"]
            )
        ].copy()
    sites = _report_frame("Sites_Master")
    if logs.empty or "worker_name" not in logs.columns:
        st.info("Worker daily logs are required to build worker scorecards.")
        return

    worker_names = _report_column(logs, "worker_name").astype(str).str.strip()
    options = ["All workers"] + sorted(name for name in worker_names.unique() if name and name.lower() != "nan")
    selected = st.selectbox("Worker", options, key="worker_report_selection")
    filtered = logs if selected == "All workers" else logs[worker_names.eq(selected)]
    durations = _report_amounts(_report_column(filtered, "hours_spent")) + _report_amounts(_report_column(filtered, "minutes_spent")) / 60
    travel = _report_column(filtered, "is_travel_day", "travel_required").astype(str).str.lower().isin(["yes", "true", "1"])
    worker_sites = _report_column(filtered, "installation_id").astype(str).str.strip().unique().tolist()
    related_sites = sites[_report_column(sites, "installation_id").astype(str).str.strip().isin(worker_sites)] if not sites.empty else pd.DataFrame()
    site_status = _report_column(related_sites, "status").astype(str).str.lower()
    completed = site_status.isin(["handovered", "handover", "completed"]).sum()
    delayed = site_status.isin(["on hold", "hold", "paused", "blocked"]).sum()
    if not ratings.empty and "record_type" in ratings.columns:
        ratings = ratings[
            ratings["record_type"].astype(str).str.casefold().eq("performance")
        ]
        if selected != "All workers":
            ratings = ratings[
                _report_column(ratings, "worker_name").astype(str).str.strip().eq(selected)
            ]
    else:
        ratings = pd.DataFrame()
    quality_scores = _report_amounts(_report_column(ratings, "performance_score"))
    recorded_quality = quality_scores[quality_scores.gt(0)]
    complete_days = []
    if not related_sites.empty:
        start = _report_date(_report_column(related_sites, "order_date", "start_date"))
        finish = _report_date(_report_column(related_sites, "actual_handover_date", "completion_date"))
        complete_days = ((finish - start).dt.total_seconds() / 86400).dropna().tolist()
    with st.container(horizontal=True):
        st.metric("Sites logged", len(worker_sites), border=True)
        st.metric("Sites handed over", int(completed), border=True)
        st.metric("Sites on hold", int(delayed), border=True)
        st.metric("Logged travel time", f"{durations[travel].sum():.1f} hrs", border=True)
        st.metric(
            "Average supervisor score",
            f"{recorded_quality.mean():.1f} / 10" if not recorded_quality.empty else "Not rated",
            border=True,
        )
    if complete_days:
        st.metric("Average order-to-handover time", f"{sum(complete_days) / len(complete_days):.1f} days")
    st.subheader("Worker task and site scorecard")
    summary = pd.DataFrame({
        "Worker": _report_column(filtered, "worker_name"),
        "Site": _report_column(filtered, "installation_id"),
        "Date": _report_column(filtered, "logged_date", "date"),
        "Task": _report_column(filtered, "task_name", "task_description"),
        "Hours": durations,
        "Travel day": travel.map({True: "Yes", False: "No"}),
        "Delay": _report_column(filtered, "delay_category"),
    })
    if not summary.empty:
        st.plotly_chart(
            px.bar(summary.groupby("Task")["Hours"].sum().reset_index(), x="Task", y="Hours"),
            width="stretch",
            alt="Worker time by assigned task",
        )
    for _, activity in summary.sort_values("Date", ascending=False).iterrows():
        with st.expander(
            f"{activity['Date']} · {activity['Worker']} · {activity['Task']}"
        ):
            st.write(f"**Site:** {activity['Site']}")
            st.write(f"**Time:** {activity['Hours']:.2f} hours")
            st.write(f"**Travel:** {activity['Travel day']}")
            st.write(f"**Delay:** {activity['Delay']}")
    if not ratings.empty:
        st.subheader("Supervisor rating history")
        for _, evaluation in ratings.iterrows():
            with st.container(border=True):
                st.markdown(
                    f"**{evaluation.get('worker_name', 'Worker')} · "
                    f"{evaluation.get('installation_id', 'Site')} · "
                    f"{evaluation.get('performance_score', 'N/A')} / 10**"
                )
                st.caption(
                    f"Efficiency {evaluation.get('efficiency_score', '—')} · "
                    f"Workmanship {evaluation.get('workmanship_score', '—')} · "
                    f"Safety {evaluation.get('safety_score', '—')} · "
                    f"Attendance {evaluation.get('attendance_score', '—')} · "
                    f"Teamwork {evaluation.get('teamwork_score', '—')}"
                )
                st.write(evaluation.get("evaluation_notes", "No supervisor notes recorded."))
    st.caption("Travel distance and task-level budget consumption are not stored in the current field logs and are therefore not scored.")
    render_data_drawer("Inspect and export worker activity records", filtered, "worker_scorecard_records")


def render_budget_reports():
    st.header("Budget reports")
    st.caption("Compare each site's recorded allocation and actual expense; alert at 80% and 100%.")
    _report_refresh("budget_reports_refresh")
    sites = _report_frame("Sites_Master")
    expenses = _report_frame("Expense_Logs")
    if sites.empty:
        st.info("No site records are available.")
        return
    budgets, spent = _report_budget_columns(sites, expenses)
    sales_status = _report_column(sites, "deal_status").astype(str).str.casefold()
    total_sales = float(
        _report_amounts(_report_column(sites, "deal_amount"))[
            sales_status.eq("confirmed order")
        ].sum()
    )
    site_ids = _report_column(sites, "installation_id").astype(str).str.strip()
    valid_site_ids = site_ids[site_ids.ne("") & site_ids.ne("nan")].drop_duplicates().tolist()
    if valid_site_ids:
        st.subheader("Allocate or update a site budget")
        current_budget_by_site = pd.Series(
            budgets.to_numpy(), index=site_ids
        ).groupby(level=0).first()
        budget_site = st.selectbox(
            "Site",
            valid_site_ids,
            format_func=lambda site_id: (
                f"{site_id} — {current_budget_by_site.get(site_id, 0):,.2f} allocated"
            ),
        )
        budget_row = sites.loc[site_ids.eq(budget_site)].iloc[0]
        budget_row_frame = pd.DataFrame([budget_row])
        current_categories = sum(
            float(_report_first_amount(budget_row_frame, *aliases).iloc[0])
            for aliases in (
                ("travel_budget",),
                ("lodging_budget", "stay_budget"),
                ("food_budget",),
                ("contingency_budget",),
            )
        )
        legacy_allocation = float(current_budget_by_site.get(budget_site, 0))
        other_budget_default = max(0.0, legacy_allocation - current_categories)
        budget_column = next(
            (
                column
                for column in (
                    "budget_allowed",
                    "allocated_budget",
                    "approved_budget",
                    "site_budget",
                    "budget",
                )
                if column in sites.columns
            ),
            "allocated_budget",
        )
        with st.form("budget_allocation_form"):
            travel_budget = st.number_input(
                "Travel allocation (₹)",
                min_value=0.0,
                value=float(_report_first_amount(budget_row_frame, "travel_budget").iloc[0]),
                step=500.0,
            )
            lodging_budget = st.number_input(
                "Lodging allocation (₹)",
                min_value=0.0,
                value=float(_report_first_amount(budget_row_frame, "lodging_budget", "stay_budget").iloc[0]),
                step=500.0,
            )
            food_budget = st.number_input(
                "Food / TA-DA allocation (₹)",
                min_value=0.0,
                value=float(_report_first_amount(budget_row_frame, "food_budget").iloc[0]),
                step=500.0,
            )
            contingency_budget = st.number_input(
                "Emergency contingency pool (₹)",
                min_value=0.0,
                value=float(_report_first_amount(budget_row_frame, "contingency_budget").iloc[0]),
                step=1000.0,
                key=f"budget_contingency_{budget_site}",
            )
            other_budget = st.number_input(
                "Other / existing allocation (₹)",
                min_value=0.0,
                value=other_budget_default,
                step=1000.0,
                key=f"budget_amount_{budget_site}",
            )
            save_budget = st.form_submit_button("Save site budget")
        if save_budget:
            if update_sheet_record(
                "Sites_Master",
                "installation_id",
                budget_site,
                {
                    budget_column: travel_budget + lodging_budget + food_budget + contingency_budget + other_budget,
                    "travel_budget": travel_budget,
                    "lodging_budget": lodging_budget,
                    "food_budget": food_budget,
                    "contingency_budget": contingency_budget,
                    "budget_updated_at": datetime.now().isoformat(timespec="seconds"),
                },
                ensure_columns=True,
            ):
                st.success(f"Budget for {budget_site} was saved.")
                st.rerun()

    overrun_count = int((spent > budgets).where(budgets.gt(0), False).sum())
    installation_spend = float(
        _report_amounts(_report_column(sites, "installation_spend", "labor_spend")).sum()
    )
    with st.container(horizontal=True):
        st.metric("Total sales", f"₹{total_sales:,.0f}", border=True)
        st.metric("Installation spend", f"₹{installation_spend:,.0f}", border=True)
        st.metric("Total site expenses", f"₹{float(spent.sum()):,.0f}", border=True)
        st.metric("Budget overrun flags", overrun_count, border=True)

    report = pd.DataFrame({
        "Site": _report_column(sites, "installation_id"),
        "Client": _report_column(sites, "client_name", "client"),
        "Status": _report_column(sites, "status"),
        "Allocated (₹)": budgets,
        "Spent (₹)": spent,
        "Variance (₹)": budgets - spent,
    })
    report["Spend %"] = report.apply(
        lambda row: row["Spent (₹)"] / row["Allocated (₹)"] * 100 if row["Allocated (₹)"] > 0 else float("nan"),
        axis=1,
    )
    budgeted = report[report["Allocated (₹)"].gt(0)]
    if budgeted.empty:
        st.warning("Budget allocation fields are not present or have no values in Sites_Master. Use the allocation form above to start tracking budgets and threshold notifications.")
        render_data_drawer("Inspect and export budget records", report, "budget_report_records")
        return
    alerts = report[report["Spend %"].ge(80)]
    if not alerts.empty:
        for _, row in alerts.iterrows():
            if row["Spend %"] >= 100:
                st.error(f"{row['Site']}: {row['Spend %']:.0f}% of allocated budget has been spent.")
            else:
                st.warning(f"{row['Site']}: {row['Spend %']:.0f}% of allocated budget has been spent.")
    chart_data = budgeted.melt(
        id_vars=["Site"],
        value_vars=["Allocated (₹)", "Spent (₹)"],
        var_name="Budget type",
        value_name="Amount (₹)",
    )
    st.plotly_chart(px.bar(chart_data, x="Site", y="Amount (₹)", color="Budget type", barmode="group"), width="stretch", alt="Allocated and spent budget by site")
    expense_site_ids = _report_column(expenses, "installation_id").astype(str).str.strip()
    for row_index, row in report.iterrows():
        if not row["Allocated (₹)"]:
            continue
        with st.container(border=True):
            st.markdown(f"**{row['Site']} · {row['Client']}**")
            left, right = st.columns(2)
            left.metric("Allocated", f"₹{row['Allocated (₹)']:,.0f}")
            right.metric("Spent", f"₹{row['Spent (₹)']:,.0f}")
            burn = max(0.0, min(float(row["Spend %"]) / 100, 1.0))
            st.progress(burn, text=f"Budget utilization · {row['Spend %']:.0f}%")
            itemized = expenses[expense_site_ids.eq(str(row["Site"]).strip())]
            with st.expander("Itemized site expenses and overrun justification"):
                allocation = sites.loc[row_index]
                allocated_categories = {
                    "Travel": _report_amounts(pd.Series([allocation.get("travel_budget", 0)])).iloc[0],
                    "Lodging": _report_amounts(pd.Series([allocation.get("lodging_budget", allocation.get("stay_budget", 0))])).iloc[0],
                    "Food / TA-DA": _report_amounts(pd.Series([allocation.get("food_budget", 0)])).iloc[0],
                    "Emergency contingency": _report_amounts(pd.Series([allocation.get("contingency_budget", 0)])).iloc[0],
                }
                st.caption(
                    "Allocated by category · "
                    + " · ".join(
                        f"{label}: ₹{amount:,.0f}"
                        for label, amount in allocated_categories.items()
                    )
                )
                if itemized.empty:
                    st.info("No daily expense lines have been submitted.")
                else:
                    categories = {
                        "Travel": _report_amounts(_report_column(itemized, "travel_expense", "travel_exp")).sum(),
                        "Lodging": _report_amounts(_report_column(itemized, "stay_expense", "stay_exp")).sum(),
                        "Food / TA-DA": _report_amounts(_report_column(itemized, "food_expense", "food_exp")).sum(),
                        "Miscellaneous": _report_amounts(_report_column(itemized, "misc_expense", "misc_exp")).sum(),
                    }
                    st.plotly_chart(
                        px.pie(
                            pd.DataFrame({"Category": categories.keys(), "Amount": categories.values()}),
                            names="Category",
                            values="Amount",
                            hole=0.55,
                        ),
                        width="stretch",
                        alt=f"Itemized expense allocation for {row['Site']}",
                    )
                current_justification = str(allocation.get("budget_overrun_justification", ""))
                justification = st.text_area(
                    "Over-budget justification / approval request",
                    value="" if current_justification.lower() == "nan" else current_justification,
                    key=f"budget_justification_{row_index}",
                )
                if st.button("Submit approval request", key=f"budget_approval_{row_index}"):
                    if not justification.strip():
                        st.error("Add a justification before requesting approval.")
                    elif update_sheet_record(
                        "Sites_Master",
                        "installation_id",
                        str(row["Site"]),
                        {
                            "budget_overrun_justification": justification.strip(),
                            "budget_approval_status": "Requested",
                            "budget_approval_requested_at": datetime.now().isoformat(timespec="seconds"),
                        },
                        ensure_columns=True,
                    ):
                        st.success("Budget approval request was recorded.")
                        st.rerun()
    render_data_drawer("Inspect and export budget records", report, "budget_report_records")


def _render_admin_operations_analytics():
    st.header("📊 Admin Operations & Dynamic Expense Analytics")

    df_logs = read_sheet("Worker_Daily_Logs")
    df_expenses = read_sheet("Expense_Logs")
    df_sites = read_sheet("Sites_Master")
    if not df_expenses.empty:
        df_expenses = df_expenses.copy()
        df_expenses.columns = [
            re.sub(r"[\s\-]+", "_", str(column).strip().lower())
            for column in df_expenses.columns
        ]
        df_expenses = df_expenses.loc[:, ~df_expenses.columns.duplicated()]

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

        travel_exp = _report_first_amount(
            active_expenses, "travel_expense", "travel_exp"
        ).sum()
        stay_exp = _report_first_amount(
            active_expenses, "stay_expense", "stay_exp"
        ).sum()
        food_exp = _report_first_amount(
            active_expenses, "food_expense", "food_exp"
        ).sum()
        misc_exp = _report_first_amount(
            active_expenses, "misc_expense", "misc_exp"
        ).sum()
        recorded_total = _report_first_amount(active_expenses, "total_expense")
        total_site_expenses = (
            recorded_total.sum()
            if recorded_total.any()
            else travel_exp + stay_exp + food_exp + misc_exp
        )

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
                    st.plotly_chart(fig_delay, width="stretch")
                else:
                    st.success("No delays or problems reported across running sites!")

        with g2:
            st.subheader("💰 Dynamic Everyday Site Expenses Breakdown")
            if not active_expenses.empty and "installation_id" in active_expenses.columns:
                expense_chart = pd.DataFrame({
                    "installation_id": active_expenses["installation_id"],
                    "Travel": _report_first_amount(
                        active_expenses, "travel_expense", "travel_exp"
                    ),
                    "Stay": _report_first_amount(
                        active_expenses, "stay_expense", "stay_exp"
                    ),
                    "Food": _report_first_amount(
                        active_expenses, "food_expense", "food_exp"
                    ),
                    "Misc": _report_first_amount(
                        active_expenses, "misc_expense", "misc_exp"
                    ),
                }).melt(
                    id_vars=["installation_id"],
                    var_name="Expense category",
                    value_name="Expense (₹)",
                )
                fig_exp = px.bar(
                    expense_chart,
                    x="installation_id",
                    y="Expense (₹)",
                    color="Expense category",
                    title="Active Site Expense Breakdown (Dynamic Daily Tracker)",
                    barmode="stack",
                )
                st.plotly_chart(fig_exp, width="stretch")
            else:
                st.info("No active site expenses recorded yet.")


def render_financial_expenses():
    st.subheader("Financial & Expenses")
    st.caption("Review recorded site expenses, inspect itemized costs, and export financial and labor logs.")
    _report_refresh("financial_expenses_refresh")
    expenses = _report_frame("Expense_Logs")
    logs = _report_frame("Worker_Daily_Logs")

    if expenses.empty:
        st.info("No expense entries available.")
        total_spent = 0.0
    else:
        if "total_expense" in expenses.columns:
            expense_totals = _report_amounts(expenses["total_expense"])
        else:
            expense_totals = pd.Series(0.0, index=expenses.index)
            for aliases in (
                ("travel_expense", "travel_exp"),
                ("stay_expense", "stay_exp"),
                ("food_expense", "food_exp"),
                ("misc_expense", "misc_exp"),
            ):
                column = next(
                    (name for name in aliases if name in expenses.columns), None
                )
                if column:
                    expense_totals += _report_amounts(expenses[column])
        total_spent = float(expense_totals.sum())
    st.metric("Total Site Expenses (₹)", f"₹{total_spent:,.2f}")

    if not expenses.empty:
        expense_view = expenses.copy()
        expense_view["calculated_total"] = expense_totals
        site_ids = _report_column(expense_view, "installation_id").astype(str).str.strip()
        site_options = ["All sites"] + sorted(
            site_id for site_id in site_ids.unique() if site_id and site_id.lower() != "nan"
        )
        selected_site = st.selectbox(
            "Filter by site",
            site_options,
            key="finance_expense_site_filter",
        )
        if selected_site != "All sites":
            expense_view = expense_view[site_ids.eq(selected_site)]
        date_values = _report_date(
            _report_column(expense_view, "logged_date", "exp_date", "expense_date")
        )
        dated_values = date_values.dropna()
        if not dated_values.empty:
            start_default = dated_values.min().date()
            end_default = dated_values.max().date()
            date_range = st.date_input(
                "Filter by expense date",
                value=(start_default, end_default),
                min_value=start_default,
                max_value=end_default,
                key="finance_expense_date_filter",
            )
            if isinstance(date_range, (tuple, list)) and len(date_range) == 2:
                current_dates = _report_date(
                    _report_column(expense_view, "logged_date", "exp_date", "expense_date")
                )
                expense_view = expense_view[
                    current_dates.ge(pd.Timestamp(date_range[0]))
                    & current_dates.lt(pd.Timestamp(date_range[1]) + pd.Timedelta(days=1))
                ]
        filtered_total = float(expense_view["calculated_total"].sum())
        st.metric("Expenses in current view", f"₹{filtered_total:,.2f}")
        render_data_drawer(
            "Inspect and search raw expense entries",
            expense_view,
            "financial_expense_records",
        )
        expense_export = generate_excel_download(
            expense_view, "Financial_Expense_Logs.xlsx"
        )
        st.download_button(
            "Download financial expense logs",
            data=expense_export,
            file_name="Financial_Expense_Logs.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            key="download_financial_expenses",
        )

        categories = []
        for label, aliases in (
            ("Travel", ("travel_expense", "travel_exp")),
            ("Stay / lodging", ("stay_expense", "stay_exp")),
            ("Food / allowance", ("food_expense", "food_exp")),
            ("Misc / local purchase", ("misc_expense", "misc_exp")),
        ):
            column = next(
                (name for name in aliases if name in expense_view.columns), None
            )
            if column:
                categories.append(
                    {
                        "Expense category": label,
                        "Amount (₹)": _report_amounts(expense_view[column]).sum(),
                    }
                )
        if categories:
            categories = pd.DataFrame(categories)
            st.plotly_chart(
                px.bar(categories, x="Expense category", y="Amount (₹)"),
                width="stretch",
                alt="Recorded expense totals by category",
            )
    else:
        expense_view = expenses

    st.divider()
    st.subheader("Labor and field activity export")
    if logs.empty:
        st.info("No labor or field log entries available.")
    else:
        render_data_drawer(
            "Inspect and export raw labor and field activity",
            logs,
            "admin_labor_activity_records",
        )
        labor_export = generate_excel_download(logs, "Labor_Field_Logs.xlsx")
        st.download_button(
            "Download labor and field logs",
            data=labor_export,
            file_name="Labor_Field_Logs.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            key="download_labor_logs",
        )


def render_admin_analytics():
    operations_tab, finance_tab = st.tabs(
        ["Operations analytics", "Financial & Expenses"]
    )
    with operations_tab:
        _render_admin_operations_analytics()
    with finance_tab:
        render_financial_expenses()


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
                st.plotly_chart(fig_orders, width="stretch")

            with c_chart2:
                st.subheader("🎯 Site Status Share")
                fig_pie = px.pie(
                    filtered_sites,
                    names="status",
                    title=f"Site Execution Distribution ({time_filter})",
                    hole=0.4,
                )
                st.plotly_chart(fig_pie, width="stretch")

            st.subheader("📜 Detailed Salesperson Order Records")
            disp_cols = [c for c in ["installation_id", "client_name", sp_col, "order_date", "deal_amount", "site_city", "status", "hold_reason"] if c in filtered_sites.columns]
            for _, deal in filtered_sites[disp_cols].iterrows():
                with st.container(border=True):
                    st.markdown(
                        f"**{deal.get('client_name', 'Client')} · "
                        f"{deal.get('installation_id', 'Site')}**"
                    )
                    st.caption(
                        f"{deal.get(sp_col, 'Salesperson')} · "
                        f"{deal.get('status', 'Status not recorded')} · "
                        f"{deal.get('site_city', 'Location not recorded')}"
                    )
                    st.write(f"Deal value: ₹{_report_amounts(pd.Series([deal.get('deal_amount', 0)])).iloc[0]:,.0f}")
            render_data_drawer(
                "Inspect and export salesperson order records",
                filtered_sites[disp_cols],
                "sales_analytics_order_records",
            )
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
            travel_logs = travel_logs.copy()
            for numeric_column in ("hours_spent", "minutes_spent"):
                if numeric_column in travel_logs.columns:
                    travel_logs[numeric_column] = _report_amounts(
                        travel_logs[numeric_column]
                    )
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
                st.plotly_chart(fig_ta, width="stretch")
            with c2:
                fig_allowance = px.bar(
                    summary,
                    x="worker_name",
                    y="Estimated_TADA_Allowance",
                    title="Calculated TA/DA Allowance (₹)",
                    color="Estimated_TADA_Allowance",
                )
                st.plotly_chart(fig_allowance, width="stretch")

            for _, worker in summary.iterrows():
                with st.container(border=True):
                    st.markdown(f"**{worker['worker_name']}**")
                    c1, c2, c3 = st.columns(3)
                    c1.metric("Travel days", int(worker["Travel_Days"]))
                    c2.metric("Sites covered", int(worker["Sites_Covered"]))
                    c3.metric("Estimated TA/DA", f"₹{worker['Estimated_TADA_Allowance']:,.0f}")
            render_data_drawer(
                "Inspect and export TA/DA payroll records",
                summary,
                "tada_payroll_records",
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
        st.subheader(f"Activity timeline ({len(inspect_df)} entries)")
        date_values = _report_date(_report_column(inspect_df, "logged_date", "date"))
        timeline = inspect_df.assign(_activity_date=date_values).sort_values(
            "_activity_date", ascending=False, na_position="last"
        )
        for _, activity in timeline.iterrows():
            with st.expander(
                f"{activity.get('logged_date', 'Undated')} · "
                f"{activity.get('installation_id', 'Site')} · "
                f"{activity.get('worker_name', 'Worker')}"
            ):
                st.write(activity.get("task_name", activity.get("task_description", "Field activity")))
                st.write(activity.get("site_remarks", "No notes recorded."))
                for photo_field in ("site_photo", "arrival_photo_url", "departure_photo_url"):
                    photo_url = str(activity.get(photo_field, "")).strip()
                    if photo_url.startswith("http"):
                        st.link_button(photo_field.replace("_", " ").title(), photo_url)
        render_data_drawer(
            "Inspect and export filtered field-log records",
            inspect_df,
            "field_logs_inspector_records",
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
                SYSTEM_ROLES,
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

                submit_user = st.form_submit_button("👤 Create User Profile", width="stretch")

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
                current_role = m_row.get("role", "Worker")
                e_role = st.selectbox(
                    "Access Role",
                    SYSTEM_ROLES,
                    index=SYSTEM_ROLES.index(current_role)
                    if current_role in SYSTEM_ROLES
                    else 0,
                )
                e_desig = st.text_input("Designation", value=m_row.get("designation", ""))
                e_phone = st.text_input("Phone Number", value=str(m_row.get("phone_no", "")))
                e_pin = st.text_input("PIN", value=str(m_row.get("pin", "")))
                e_base = st.text_input("Base Location", value=m_row.get("base_location", "Jaipur"))

                btn_update_u = st.form_submit_button("Update User Profile", width="stretch")

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
    search_name = st.text_input("Search users by name, role, or ID", key="user_directory_search")
    directory = df_workers.copy()
    if search_name.strip():
        matches = directory.astype(str).apply(
            lambda column: column.str.contains(search_name.strip(), case=False, regex=False)
        )
        directory = directory.loc[matches.any(axis=1)]
    for _, account in directory.iterrows():
        with st.container(border=True):
            st.markdown(
                f"**{account.get('name', 'User')} · {account.get('worker_id', 'No ID')}**"
            )
            st.caption(
                f"{account.get('role', 'Role not set')} · "
                f"{account.get('designation', 'Designation not set')} · "
                f"{account.get('base_location', 'Location not set')}"
            )
            if str(account.get("phone_no", "")).strip():
                st.write(f"Contact: {account.get('phone_no')}")
    safe_directory = df_workers.drop(
        columns=[
            column for column in df_workers.columns
            if str(column).strip().casefold() in {"pin", "password", "passcode"}
        ],
        errors="ignore",
    )
    render_data_drawer(
        "Inspect and export system user records",
        safe_directory,
        "system_user_directory",
    )


def render_master_database():
    st.header("🛢️ Master Database Tabs Explorer")
    sheet_options = ["Sites_Master", "Workers_Master", "Worker_Daily_Logs", "Expense_Logs", "Task_Assignments"]
    sel_sheet = st.selectbox("Select Database Sheet Tab to Inspect", sheet_options)

    df_data = read_sheet(sel_sheet)
    st.subheader(f"Data Records — {sel_sheet} ({len(df_data)} Records)")
    if sel_sheet == "Workers_Master":
        df_data = df_data.drop(
            columns=[
                column for column in df_data.columns
                if str(column).strip().casefold() in {"pin", "password", "passcode"}
            ],
            errors="ignore",
        )
    render_data_drawer(
        f"Open / export {sel_sheet} raw records",
        df_data,
        f"master_database_{sel_sheet}",
    )