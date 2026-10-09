import os
from datetime import date, datetime, timedelta
import re
import pandas as pd
import streamlit as st

from installation_app.config import PRODUCT_CATALOG
from installation_app.services.drive import upload_file_to_drive
from installation_app.services.sheets import (
    append_to_sheet,
    read_sheet,
    update_sheet_record,
)
from installation_app.components.ui import render_data_drawer, validate_email


DEAL_OPTIONS = [
    "Confirmed Order",
    "Under Negotiation / Lead",
    "Lost / Cancelled",
]


def _sales_dates(values):
    raw = values.astype(str).str.strip()
    parsed = pd.to_datetime(raw, errors="coerce", format="mixed")
    day_first = raw.str.match(r"^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$")
    if day_first.any():
        parsed.loc[day_first] = pd.to_datetime(
            raw.loc[day_first], errors="coerce", format="mixed", dayfirst=True
        )
    return parsed


def _sales_amounts(values):
    return pd.to_numeric(
        values.astype(str).str.replace(r"[₹,\s]", "", regex=True),
        errors="coerce",
    ).fillna(0)


def _current_month_range(today=None):
    today = today or date.today()
    start = today.replace(day=1)
    next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    return start, next_month - timedelta(days=1)


def _sales_period_range(period, today=None, custom_range=None):
    today = today or date.today()
    current_start, current_end = _current_month_range(today)
    if period == "Current Month":
        return current_start, current_end
    if period == "Last 15 Days":
        return today - timedelta(days=14), today
    if period == "Last 1 Month":
        return today - timedelta(days=29), today
    if period == "Last 3 Months":
        return today - timedelta(days=89), today
    if period == "Last 6 Months":
        return today - timedelta(days=179), today
    if period == "Last 1 Year":
        return today - timedelta(days=364), today
    if period == "Current Quarter":
        quarter_month = ((today.month - 1) // 3) * 3 + 1
        quarter_start = date(today.year, quarter_month, 1)
        next_quarter = (quarter_start.replace(day=28) + timedelta(days=4)).replace(day=1)
        if next_quarter.month not in (1, 4, 7, 10):
            next_quarter = date(next_quarter.year, ((next_quarter.month - 1) // 3 + 1) * 3 + 1, 1)
        return quarter_start, next_quarter - timedelta(days=1)
    if period == "Previous Quarter":
        quarter_month = ((today.month - 1) // 3) * 3 + 1
        current_quarter_start = date(today.year, quarter_month, 1)
        previous_quarter_end = current_quarter_start - timedelta(days=1)
        previous_month = previous_quarter_end.month
        previous_quarter_start = date(
            previous_quarter_end.year,
            ((previous_month - 1) // 3) * 3 + 1,
            1,
        )
        return previous_quarter_start, previous_quarter_end
    if period == "Custom Date Range" and custom_range:
        return custom_range
    return current_start, current_end


def _sales_owner_mask(sites, user_name, user_id, user_role):
    if user_role != "Salesperson":
        return pd.Series(True, index=sites.index)
    owner_id = str(user_id).strip().casefold()
    owner_name = str(user_name).strip().casefold()
    matches = pd.Series(False, index=sites.index)
    for column in ("salesperson_id", "salesperson_name", "salesperson"):
        if column in sites.columns:
            values = sites[column].fillna("").astype(str).str.strip().str.casefold()
            matches |= values.eq(owner_id) | values.eq(owner_name)
    return matches


def _sales_confirmed_mask(sites):
    deal_status = (
        sites["deal_status"].astype(str).str.strip().str.casefold()
        if "deal_status" in sites.columns
        else pd.Series("", index=sites.index)
    )
    confirmed = deal_status.eq("confirmed order")
    if not deal_status.ne("").any() and "status" in sites.columns:
        confirmed = sites["status"].astype(str).str.strip().str.casefold().isin(
            ["in progress", "handovered", "handover", "completed"]
        )
    return confirmed


def _sales_pending_mask(sites):
    deal_status = (
        sites["deal_status"].astype(str).str.strip().str.casefold()
        if "deal_status" in sites.columns
        else pd.Series("", index=sites.index)
    )
    if deal_status.ne("").any():
        pending = deal_status.isin(
            ["under negotiation / lead", "under negotiation", "lead"]
        )
        pending &= ~deal_status.isin(
            ["lost", "lost / cancelled", "cancelled", "confirmed order"]
        )
    else:
        status = (
            sites["status"].astype(str).str.strip().str.casefold()
            if "status" in sites.columns
            else pd.Series("", index=sites.index)
        )
        pending = status.isin(["on hold", "hold", "paused", "blocked"])
    return pending & ~_sales_confirmed_mask(sites)


def _site_completion(site, site_logs):
    status = str(site.get("status", "")).strip().casefold()
    if status in ("handovered", "handover", "completed"):
        return 100, "Handover complete", ["Handover complete"]
    if status in ("cancelled", "lost", "lost / cancelled"):
        return 0, "Cancelled", []

    confirmed = bool(_sales_confirmed_mask(pd.DataFrame([site])).iloc[0])
    checkpoints = []
    if confirmed:
        checkpoints.append((10, "Order confirmed"))
    if not site_logs.empty:
        checkpoints.append((20, "Field activity"))
        task_text = " ".join(
            site_logs[column].fillna("").astype(str).str.casefold().str.cat(sep=" ")
            for column in ("task_category", "task_name", "site_remarks")
            if column in site_logs.columns
        )
        if "measur" in task_text:
            checkpoints.append((35, "Measurement"))
        if any(word in task_text for word in ("production", "material", "fabricat")):
            checkpoints.append((50, "Production / materials"))
        if any(word in task_text for word in ("dispatch", "delivery")):
            checkpoints.append((65, "Dispatch / delivery"))
        if any(word in task_text for word in ("install", "fitting", "assembly")):
            checkpoints.append((85, "Installation"))

    if checkpoints:
        progress, stage = max(checkpoints)
    else:
        progress, stage = 0, "Deal / lead"
    if status in ("on hold", "hold", "paused", "blocked"):
        stage = f"On hold · {stage}"
    return progress, stage, [label for _, label in checkpoints]


def _show_negotiation_reminders(pending_deals, user_id):
    today_key = f"negotiation_reminders_{str(user_id).strip()}_{date.today().isoformat()}"
    dismissed = set(st.session_state.get(today_key, []))
    pending_deals = pending_deals[
        ~pending_deals["installation_id"].astype(str).isin(dismissed)
    ]
    if pending_deals.empty:
        return

    @st.dialog("Negotiation follow-up required")
    def show_dialog(deals):
        st.warning("These negotiation deals need a follow-up today.")
        site_ids = deals["installation_id"].astype(str).tolist()
        selected_id = st.selectbox(
            "Select a deal to update",
            site_ids,
            format_func=lambda site_id: (
                f"{site_id} — "
                f"{deals.loc[deals['installation_id'].astype(str).eq(site_id), 'client_name'].iloc[0]}"
            ),
            key="negotiation_followup_selected",
        )
        selected = deals[deals["installation_id"].astype(str).eq(selected_id)].iloc[0]
        st.write(f"**Client:** {selected.get('client_name', 'N/A')}")
        st.write(f"**Deal value:** ₹{_sales_amounts(pd.Series([selected.get('deal_amount', 0)])).iloc[0]:,.2f}")
        st.write(f"**Salesperson:** {selected.get('salesperson_name', user_id)}")
        st.write("**Status:** Under Negotiation")

        new_status = st.selectbox(
            "Update deal status",
            DEAL_OPTIONS,
            index=1,
            key=f"negotiation_status_{selected_id}",
        )
        loss_reason = ""
        if new_status == "Lost / Cancelled":
            loss_reason = st.text_area(
                "Reason for loss *",
                key=f"negotiation_loss_reason_{selected_id}",
            )
        update_col, later_col = st.columns(2)
        if update_col.button("Update deal", key=f"negotiation_update_{selected_id}"):
            if new_status == "Lost / Cancelled" and not loss_reason.strip():
                st.error("Enter a reason before marking this deal as lost.")
                return
            site_status = {
                "Confirmed Order": "In Progress",
                "Under Negotiation / Lead": "On Hold",
                "Lost / Cancelled": "Cancelled",
            }[new_status]
            success = update_sheet_record(
                "Sites_Master",
                "installation_id",
                selected_id,
                {
                    "deal_status": new_status,
                    "status": site_status,
                    "deal_updated_at": datetime.now().isoformat(timespec="seconds"),
                    "deal_lost_reason": (
                        loss_reason.strip()
                        if new_status == "Lost / Cancelled"
                        else ""
                    ),
                },
                ensure_columns=True,
            )
            if success:
                todays_dismissed = set(st.session_state.get(today_key, []))
                todays_dismissed.add(selected_id)
                st.session_state[today_key] = sorted(todays_dismissed)
                st.session_state["deal_update_notice"] = (
                    f"Deal {selected_id} updated to {new_status}."
                )
                st.rerun()
        if later_col.button("Remind me later", key=f"negotiation_later_{selected_id}"):
            todays_dismissed = set(st.session_state.get(today_key, []))
            todays_dismissed.add(selected_id)
            st.session_state[today_key] = sorted(todays_dismissed)
            st.rerun()

    show_dialog(pending_deals)


def render_sales_dashboard(user_name, user_id, user_role):
    st.header(f"💼 Salesperson Project Portal — {user_name} ({user_id})")
    st.caption("Live monitoring of ongoing site installations, site statuses, and field team updates.")

    df_sites = read_sheet("Sites_Master")
    df_logs = read_sheet("Worker_Daily_Logs")
    my_sites = (
        df_sites[_sales_owner_mask(df_sites, user_name, user_id, user_role)].copy()
        if not df_sites.empty
        else pd.DataFrame()
    )
    if "deal_update_notice" in st.session_state:
        st.success(st.session_state.pop("deal_update_notice"))

    today = date.today()
    month_start, month_end = _current_month_range(today)
    if not my_sites.empty:
        order_dates = _sales_dates(
            my_sites["order_date"]
            if "order_date" in my_sites.columns
            else pd.Series("", index=my_sites.index)
        )
        normalized_order_dates = order_dates.dt.normalize()
        date_mask = normalized_order_dates.ge(pd.Timestamp(month_start)) & normalized_order_dates.le(
            pd.Timestamp(month_end)
        )
        current_month_sites = my_sites[date_mask]
        month_confirmed = _sales_confirmed_mask(current_month_sites)
        month_sales = _sales_amounts(
            current_month_sites["deal_amount"]
            if "deal_amount" in current_month_sites.columns
            else pd.Series(0, index=current_month_sites.index)
        )[month_confirmed].sum()
    else:
        order_dates = pd.Series(dtype="datetime64[ns]")
        current_month_sites = my_sites
        month_confirmed = pd.Series(dtype=bool)
        month_sales = 0

    st.subheader(f"💰 My Sales — {today.strftime('%B %Y')}")
    monthly_orders = int(month_confirmed.sum())
    st.metric("Confirmed order value this month", f"₹{month_sales:,.2f}", delta=f"{monthly_orders} confirmed order(s)")

    if not my_sites.empty:
        pending_deals = my_sites.loc[_sales_pending_mask(my_sites)].copy()
        if user_role == "Salesperson" and not pending_deals.empty:
            _show_negotiation_reminders(pending_deals, user_id)

    st.divider()
    st.subheader("📋 My Acquired Sites & Progress Breakdown")
    period_options = [
        "Current Month",
        "Last 15 Days",
        "Last 1 Month",
        "Last 3 Months",
        "Last 6 Months",
        "Last 1 Year",
        "Current Quarter",
        "Previous Quarter",
        "Custom Date Range",
    ]
    month_key = today.strftime("%Y_%m")
    period = st.selectbox(
        "Reporting period",
        period_options,
        key=f"sales_reporting_period_{month_key}",
    )
    custom_range = None
    if period == "Custom Date Range":
        start_col, end_col = st.columns(2)
        custom_range = (
            start_col.date_input(
                "From date",
                value=month_start,
                key=f"sales_custom_start_{month_key}",
            ),
            end_col.date_input(
                "To date",
                value=today,
                key=f"sales_custom_end_{month_key}",
            ),
        )
    selected_start, selected_end = _sales_period_range(
        period, today=today, custom_range=custom_range
    )
    if selected_start > selected_end:
        st.error("The start date must be on or before the end date.")
        return

    if my_sites.empty:
        st.info("No sites found for this salesperson.")
        report_sites = my_sites
    else:
        normalized_order_dates = order_dates.dt.normalize()
        date_mask = normalized_order_dates.ge(pd.Timestamp(selected_start)) & normalized_order_dates.le(
            pd.Timestamp(selected_end)
        )
        report_sites = my_sites[date_mask].copy()

    report_status = (
        report_sites["status"].astype(str).str.strip().str.casefold()
        if "status" in report_sites.columns
        else pd.Series("", index=report_sites.index)
    )
    report_deal_status = (
        report_sites["deal_status"].astype(str).str.strip().str.casefold()
        if "deal_status" in report_sites.columns
        else pd.Series("", index=report_sites.index)
    )
    confirmed_mask = _sales_confirmed_mask(report_sites)
    negotiation_mask = report_deal_status.isin(
        ["under negotiation / lead", "under negotiation", "lead"]
    )
    if not report_deal_status.ne("").any():
        negotiation_mask = report_status.eq("on hold")
    lost_mask = report_deal_status.isin(["lost", "lost / cancelled", "cancelled"])
    if not report_deal_status.ne("").any():
        lost_mask = report_status.eq("cancelled")
    deal_values = _sales_amounts(
        report_sites["deal_amount"]
        if "deal_amount" in report_sites.columns
        else pd.Series(0, index=report_sites.index)
    )
    kpis = st.columns(5)
    kpis[0].metric("Sites acquired", len(report_sites))
    kpis[1].metric("Confirmed orders", int(confirmed_mask.sum()))
    kpis[2].metric("Confirmed order value", f"₹{deal_values[confirmed_mask].sum():,.2f}")
    kpis[3].metric("Pending / negotiation", int(negotiation_mask.sum()))
    kpis[4].metric("Lost deals", int(lost_mask.sum()))

    lost_deals = report_sites.loc[lost_mask]
    if not lost_deals.empty:
        st.subheader("Lost deal reasons")
        lost_reason_report = pd.DataFrame(
            {
                "Site": lost_deals.get(
                    "installation_id", pd.Series("", index=lost_deals.index)
                ),
                "Client": lost_deals.get(
                    "client_name",
                    lost_deals.get("client", pd.Series("", index=lost_deals.index)),
                ),
                "Reason": lost_deals.get(
                    "deal_lost_reason", pd.Series("", index=lost_deals.index)
                ),
                "Updated": lost_deals.get(
                    "deal_updated_at", pd.Series("", index=lost_deals.index)
                ),
            }
        )
        for _, lost_deal in lost_reason_report.iterrows():
            with st.container(border=True):
                st.markdown(
                    f"**{lost_deal['Client']} · {lost_deal['Site']}**"
                )
                st.caption(f"Updated: {lost_deal['Updated']}")
                st.write(
                    lost_deal["Reason"]
                    if str(lost_deal["Reason"]).strip()
                    else "No lost-deal reason was recorded."
                )
        render_data_drawer(
            "Inspect and export lost-deal analysis",
            lost_reason_report,
            "sales_lost_deal_analysis",
        )

    if report_sites.empty:
        st.info(f"No acquired sites from {selected_start:%d %b %Y} to {selected_end:%d %b %Y}.")
        return

    st.caption(f"Showing order dates from {selected_start:%d %b %Y} through {selected_end:%d %b %Y}.")
    st.divider()
    st.subheader("Site progress")
    logs = df_logs.copy()
    if not logs.empty:
        logs.columns = [re.sub(r"[\s\-]+", "_", str(col).strip().lower()) for col in logs.columns]
    else:
        logs = pd.DataFrame()

    def site_logs_for(site_id):
        if logs.empty or "installation_id" not in logs.columns:
            return pd.DataFrame()
        site_logs = logs[
            logs["installation_id"].astype(str).str.strip().eq(str(site_id).strip())
        ].copy()
        if "record_type" in site_logs.columns:
            site_logs = site_logs[
                ~site_logs["record_type"].astype(str).str.strip().str.casefold().isin(
                    ["attendance", "performance"]
                )
            ]
        return site_logs

    for _, site in report_sites.iterrows():
        site_id = str(site.get("installation_id", "N/A")).strip()
        client_name = str(site.get("client_name", "N/A"))
        status_text = str(site.get("status", "Not recorded")).strip()
        normalized_status = status_text.casefold()
        site_logs = site_logs_for(site_id)
        if not site_logs.empty:
            log_dates = _sales_dates(
                site_logs["logged_date"]
                if "logged_date" in site_logs.columns
                else site_logs.get("date", pd.Series("", index=site_logs.index))
            )
            site_logs["_progress_date"] = log_dates
            site_logs = site_logs.sort_values("_progress_date", na_position="last")
            if "site_day" in site_logs.columns and site_logs["site_day"].astype(str).str.strip().ne("").any():
                site_logs["_day_label"] = site_logs["site_day"].astype(str).str.strip()
            else:
                unique_dates = sorted(site_logs["_progress_date"].dropna().dt.date.unique())
                day_by_date = {value: f"Day {i + 1}" for i, value in enumerate(unique_dates)}
                site_logs["_day_label"] = site_logs["_progress_date"].apply(
                    lambda value: day_by_date.get(value.date(), "Undated") if pd.notna(value) else "Undated"
                )
        else:
            site_logs["_day_label"] = pd.Series(dtype="object")

        progress, current_stage, completed_stages = _site_completion(site, site_logs)
        with st.container(border=True):
            st.markdown(f"### {client_name}")
            st.caption(f"Site / order: {site_id} · {status_text} · Current stage: {current_stage}")
            st.progress(progress / 100, text=f"Overall site completion: {progress}%")
            if completed_stages:
                st.write(" → ".join(f"✓ {label}" for label in completed_stages))

            if site_logs.empty:
                st.info("No daily field activities have been logged for this site yet.")
                continue
            day_labels = list(dict.fromkeys(site_logs["_day_label"].astype(str).tolist()))
            selected_day = st.selectbox(
                "Select site day",
                day_labels,
                key=f"sales_site_day_{re.sub(r'[^A-Za-z0-9_]', '_', site_id)}",
            )
            day_logs = site_logs[site_logs["_day_label"].eq(selected_day)]
            st.markdown(f"**{selected_day} activities**")
            for _, log in day_logs.iterrows():
                task = log.get("task_name", log.get("task_category", "Field activity"))
                worker = log.get("worker_name", "Worker not recorded")
                st.write(f"✓ {task} · {worker}")
                remarks = str(log.get("site_remarks", "")).strip()
                if remarks and remarks.lower() not in ("nan", "none"):
                    st.caption(remarks)
            all_tasks = max(1, len(site_logs))
            day_progress = min(100, round(100 * len(day_logs) / all_tasks))
            st.progress(day_progress / 100, text=f"{selected_day} activity share: {day_progress}%")
            if "site_photo" in day_logs.columns:
                photo_links = day_logs["site_photo"].dropna().astype(str)
                for photo_url in photo_links:
                    if photo_url.startswith("http"):
                        st.link_button("Open site progress photo", photo_url)
    render_data_drawer(
        "Inspect and export this period's site records",
        report_sites,
        f"sales_site_records_{user_id}",
    )


def render_log_visit_and_order(user_name, user_id, user_base_location):
    st.header(f"📝 Log Sales Field Visit & Order Deal — {user_name}")
    st.caption("Record site visits, update deal confirmation statuses, set agreed pricing, and create new order deals.")

    existing_sites = read_sheet("Sites_Master")
    if not existing_sites.empty:
        my_sites = existing_sites[
            _sales_owner_mask(existing_sites, user_name, user_id, "Salesperson")
        ]
        pending_deals = my_sites.loc[_sales_pending_mask(my_sites)].copy()
        if not pending_deals.empty:
            _show_negotiation_reminders(pending_deals, user_id)

    if "sales_form_version" not in st.session_state:
        st.session_state["sales_form_version"] = 0
    if "sales_form_success" in st.session_state:
        st.success(st.session_state.pop("sales_form_success"))
    form_version = st.session_state["sales_form_version"]
    form_key = f"sales_form_{user_id}_{form_version}"
    order_id_key = f"sales_order_id_{user_id}_{form_version}"
    if order_id_key not in st.session_state:
        st.session_state[order_id_key] = (
            f"INST-{datetime.now().strftime('%Y')}-{os.urandom(3).hex().upper()}"
        )
    new_visit_id = st.session_state[order_id_key]
    st.info(f"🆔 **Automated Site / Order ID:** `{new_visit_id}`")

    st.subheader("🤝 Deal & order status")
    order_confirmed = st.selectbox(
        "Order Status *",
        DEAL_OPTIONS,
        key=f"{form_key}_deal_status",
    )
    loss_reason = ""
    if order_confirmed == "Lost / Cancelled":
        loss_reason = st.text_area(
            "Reason for loss *",
            key=f"{form_key}_loss_reason",
        )

    with st.form(form_key):
        st.subheader("🏢 Client & Site Details")
        c1, c2 = st.columns(2)
        with c1:
            client_name = st.text_input(
                "Client / Business Name *",
                placeholder="e.g. Apex Warehousing",
                key=f"{form_key}_client_name",
            )
            client_phone = st.text_input(
                "Client Mobile Number *",
                max_chars=10,
                placeholder="e.g. 9876543210",
                key=f"{form_key}_client_phone",
            )
            client_email = st.text_input(
                "Client Email Address",
                placeholder="e.g. client@company.com",
                key=f"{form_key}_client_email",
            )
            visit_date = st.date_input(
                "Visit Date",
                value=datetime.now().date(),
                key=f"{form_key}_visit_date",
            )
        with c2:
            site_city = st.text_input(
                "Site City *",
                value=user_base_location,
                key=f"{form_key}_site_city",
            )
            site_address = st.text_area(
                "Site Address *",
                placeholder="Complete site address details...",
                key=f"{form_key}_site_address",
            )

        st.divider()
        st.subheader("Deal details")

        col_d1, col_d2 = st.columns(2)
        with col_d1:
            deal_amount = st.number_input(
                "Agreed Deal Amount (₹) *",
                min_value=0.0,
                step=1000.0,
                format="%.2f",
                key=f"{form_key}_deal_amount",
            )
        with col_d2:
            expected_handover = st.date_input(
                "Expected Handover Date",
                value=datetime.now().date() + timedelta(days=20),
                key=f"{form_key}_expected_handover",
            )

        st.markdown("### 📦 Product Requirements & Visit Notes")
        product_options = ["Select / custom"] + PRODUCT_CATALOG
        finalized_product = st.selectbox(
            "Finalized product",
            product_options,
            key=f"{form_key}_finalized_product",
        )
        product_quantity = st.number_input(
            "Product quantity",
            min_value=1,
            value=1,
            step=1,
            key=f"{form_key}_product_quantity",
        )
        custom_product = ""
        if finalized_product == "Select / custom":
            custom_product = st.text_input(
                "Product name",
                placeholder="Enter finalized product",
                key=f"{form_key}_custom_product",
            )
        product_notes = st.text_area(
            "Product Specifications / Deal Terms",
            placeholder="Mention shutter sizes, quantity, automation type, motor specs, etc.",
            key=f"{form_key}_product_notes",
        )
        visit_remarks = st.text_area(
            "Sales Visit Remarks / Meeting Notes",
            placeholder="Detail discussion takeaways, pending approvals, or payment schedules...",
            key=f"{form_key}_visit_remarks",
        )
        uploaded_photos = st.file_uploader(
            "Site / client photos (optional)",
            type=["jpg", "jpeg", "png"],
            accept_multiple_files=True,
            key=f"{form_key}_site_photos",
        )
        submit_deal = st.form_submit_button("💾 Save Sales Visit & Sync Order Deal", width="stretch")

        if submit_deal:
            clean_phone = str(client_phone).strip()
            clean_email = str(client_email).strip()
            product_name = (
                custom_product.strip()
                if finalized_product == "Select / custom"
                else finalized_product
            )

            if not client_name.strip() or not clean_phone or not site_city.strip():
                st.error("Please fill in Client Name, Mobile Number, and Site City.")
            elif len(clean_phone) != 10 or not clean_phone.isdigit():
                st.error("Please enter a valid 10-digit mobile number.")
            elif clean_email and not validate_email(clean_email):
                st.error("Please enter a valid email address (e.g. name@domain.com).")
            elif order_confirmed == "Confirmed Order" and not product_name:
                st.error("Enter or select the finalized product.")
            elif order_confirmed == "Lost / Cancelled" and not loss_reason.strip():
                st.error("Enter a reason before marking this deal as lost.")
            else:
                order_status_mapped = "In Progress" if order_confirmed == "Confirmed Order" else ("On Hold" if order_confirmed == "Under Negotiation / Lead" else "Cancelled")
                photo_links = []
                upload_failed = False
                for index, photo in enumerate(uploaded_photos or [], start=1):
                    photo_name = (
                        f"{new_visit_id}_{index}_{photo.name}"
                    )
                    photo_link = upload_file_to_drive(photo, photo_name)
                    if not photo_link or photo_link == "Upload Failed":
                        upload_failed = True
                    else:
                        photo_links.append(photo_link)
                if upload_failed:
                    st.error("One or more photos could not be uploaded. The deal was not saved; retry the upload or remove the failed photos and submit again.")
                else:
                    products_summary = (
                        f"Finalized product: {product_name} | Quantity: {int(product_quantity)}"
                        if product_name
                        else ""
                    )
                    if product_notes.strip():
                        products_summary += (
                            f"\nSpecifications: {product_notes.strip()}"
                            if products_summary
                            else product_notes.strip()
                        )
                    if photo_links:
                        products_summary += (
                            "\nSite photos: " if products_summary else "Site photos: "
                        ) + " | ".join(photo_links)

                    order_payload = {
                        "installation_id": new_visit_id,
                        "client_name": client_name.strip(),
                        "client_phone": clean_phone,
                        "client_email": clean_email,
                        "salesperson_id": user_id,
                        "salesperson_name": user_name,
                        "team_lead": "",
                        "team_members": "",
                        "site_city": site_city.strip(),
                        "site_address": site_address.strip(),
                        "order_date": str(visit_date),
                        "handover_date": str(expected_handover),
                        "deal_status": order_confirmed,
                        "deal_amount": str(deal_amount),
                        "product_finalized": product_name,
                        "product_quantity": int(product_quantity),
                        "products_summary": products_summary,
                        "site_photos": " | ".join(photo_links),
                        "site_photo": " | ".join(photo_links),
                        "status": order_status_mapped,
                        "hold_reason": f"Sales Remarks: {visit_remarks.strip()}" if visit_remarks.strip() else "",
                        "deal_updated_at": datetime.now().isoformat(timespec="seconds"),
                        "deal_lost_reason": (
                            loss_reason.strip()
                            if order_confirmed == "Lost / Cancelled"
                            else ""
                        ),
                    }
                    if append_to_sheet(
                        "Sites_Master", order_payload, ensure_columns=True
                    ):
                        st.session_state["sales_form_success"] = (
                            f"Visit/deal logged successfully for {client_name.strip()} "
                            f"as {new_visit_id} (₹{deal_amount:,.2f})."
                        )
                        st.session_state["sales_form_version"] += 1
                        st.rerun()
                    else:
                        st.error("The visit/deal could not be saved to Sites_Master. Check the sheet connection and try again.")


def render_track_site_progress(user_name, user_id, user_role):
    st.header(f"🔍 Site Progress & Order Tracker — {user_name}")
    st.caption("Follow site progress by day with activity timelines and completion indicators.")

    df_sites = read_sheet("Sites_Master")
    df_logs = read_sheet("Worker_Daily_Logs")
    if df_sites.empty:
        st.warning("No installation records found in the database.")
        return

    filtered_df = df_sites[
        _sales_owner_mask(df_sites, user_name, user_id, user_role)
    ].copy()
    search_col, status_col = st.columns([2, 1])
    search_query = search_col.text_input(
        "Search by site ID or client",
        placeholder="e.g. INST-2026 or Reliance",
        key="track_site_search",
    ).strip().casefold()
    status_options = ["All statuses"] + sorted(
        filtered_df.get("status", pd.Series("", index=filtered_df.index))
        .astype(str)
        .str.strip()
        .replace("", "Not recorded")
        .unique()
        .tolist()
    )
    status_filter = status_col.selectbox(
        "Filter status",
        status_options,
        key="track_site_status",
    )
    if search_query:
        ids = filtered_df.get(
            "installation_id", pd.Series("", index=filtered_df.index)
        ).astype(str)
        clients = filtered_df.get(
            "client_name", pd.Series("", index=filtered_df.index)
        ).astype(str)
        filtered_df = filtered_df[
            (ids.str.casefold().str.contains(search_query, regex=False))
            | (clients.str.casefold().str.contains(search_query, regex=False))
        ]
    if status_filter != "All statuses":
        statuses = filtered_df.get(
            "status", pd.Series("", index=filtered_df.index)
        ).astype(str).str.strip().replace("", "Not recorded")
        filtered_df = filtered_df[statuses.eq(status_filter)]
    if filtered_df.empty:
        st.info("No matching sites found for your search criteria or assigned user profile.")
        return

    normalized_logs = df_logs.copy()
    if not normalized_logs.empty:
        normalized_logs.columns = [
            re.sub(r"[\s\-]+", "_", str(column).strip().lower())
            for column in normalized_logs.columns
        ]
    st.subheader(f"{len(filtered_df)} matching site(s)")
    for _, site in filtered_df.iterrows():
        site_id = str(site.get("installation_id", "N/A")).strip()
        client_name = str(site.get("client_name", "N/A"))
        status = str(site.get("status", "Not recorded")).strip()
        normalized_status = status.casefold()
        deal_value = _sales_amounts(pd.Series([site.get("deal_amount", 0)])).iloc[0]
        if normalized_logs.empty or "installation_id" not in normalized_logs.columns:
            site_logs = pd.DataFrame()
        else:
            site_logs = normalized_logs[
                normalized_logs["installation_id"].astype(str).str.strip().eq(site_id)
            ].copy()

        with st.container(border=True):
            st.markdown(f"## {client_name}")
            st.caption(
                f"Site ID: {site_id} · {site.get('site_city', 'Location not recorded')} · {status}"
            )
            st.metric("Deal value", f"₹{deal_value:,.2f}")
            detail_cols = st.columns(3)
            detail_cols[0].write(f"**Order date:** {site.get('order_date', 'Not recorded')}")
            detail_cols[1].write(f"**Target handover:** {site.get('handover_date', 'Not recorded')}")
            detail_cols[2].write(f"**Team lead:** {site.get('team_lead', 'Unassigned')}")
            if site.get("hold_reason"):
                st.warning(f"Hold remarks: {site.get('hold_reason')}")

            overall_progress, current_stage, completed_stages = _site_completion(
                site, site_logs
            )
            st.progress(
                overall_progress / 100,
                text=f"Overall site completion: {overall_progress}% · Current stage: {current_stage}",
            )
            fulfillment_status = str(site.get("production_status", "")).strip()
            if fulfillment_status:
                st.subheader("Production and delivery milestones")
                stage_labels = [
                    "Production started",
                    "Production completed",
                    "Dispatched",
                    "Delivered",
                ]
                stage_timestamps = [
                    site.get("production_started_at", ""),
                    site.get("production_completed_at", ""),
                    site.get("dispatched_at", ""),
                    site.get("delivered_at", ""),
                ]
                fulfillment_rank = {
                    "in production": 1,
                    "production complete": 2,
                    "dispatched": 3,
                    "delivered": 4,
                }.get(fulfillment_status.casefold(), 0)
                st.progress(
                    fulfillment_rank / len(stage_labels),
                    text=f"Fulfillment stage: {fulfillment_status}",
                )
                milestone_columns = st.columns(2)
                for index, (label, timestamp) in enumerate(
                    zip(stage_labels, stage_timestamps)
                ):
                    milestone_columns[index % 2].write(
                        f"**{label}:** {timestamp or 'Not recorded'}"
                    )
                st.caption(
                    f"Target dispatch: {site.get('target_dispatch_date', 'Not recorded')} · "
                    f"Estimated arrival: {site.get('estimated_arrival_at', 'Not recorded')}"
                )
                tracking = str(site.get("tracking_reference", "")).strip()
                if tracking.startswith(("https://", "http://")):
                    st.link_button("Track delivery", tracking)
                elif tracking:
                    st.write(f"**Tracking reference:** {tracking}")
                dispatch_photo = str(site.get("loaded_vehicle_photo_url", "")).strip()
                if dispatch_photo.startswith("http"):
                    st.link_button("View loaded vehicle photo", dispatch_photo)
            if completed_stages:
                st.write(" → ".join(f"✓ {stage}" for stage in completed_stages))

            if site_logs.empty:
                st.info("No daily field activities have been logged for this site yet.")
            else:
                log_dates = _sales_dates(
                    site_logs.get(
                        "logged_date",
                        site_logs.get("date", pd.Series("", index=site_logs.index)),
                    )
                )
                site_logs["_date"] = log_dates
                if "site_day" in site_logs.columns and site_logs["site_day"].astype(str).str.strip().ne("").any():
                    site_logs["_day"] = site_logs["site_day"].astype(str).str.strip()
                else:
                    unique_dates = sorted(log_dates.dropna().dt.date.unique())
                    day_by_date = {
                        value: f"Day {index + 1}"
                        for index, value in enumerate(unique_dates)
                    }
                    site_logs["_day"] = log_dates.apply(
                        lambda value: day_by_date.get(value.date(), "Undated")
                        if pd.notna(value)
                        else "Undated"
                    )
                day_options = list(dict.fromkeys(site_logs["_day"].tolist()))
                selected_day = st.selectbox(
                    "Select site day",
                    day_options,
                    key=f"track_day_{re.sub(r'[^A-Za-z0-9_]', '_', site_id)}",
                )
                day_logs = site_logs[site_logs["_day"].eq(selected_day)]
                st.markdown(f"### {selected_day} activities")
                for _, activity in day_logs.iterrows():
                    task = activity.get(
                        "task_name",
                        activity.get("task_category", "Field activity"),
                    )
                    worker = activity.get("worker_name", "Worker not recorded")
                    st.write(f"✓ {task} · {worker}")
                    category_text = (
                        f"{activity.get('task_category', '')} {task}".casefold()
                    )
                    if "measur" in category_text:
                        st.caption("Milestone: Measurement")
                    elif any(word in category_text for word in ("production", "material", "fabricat")):
                        st.caption("Milestone: Production / materials")
                    elif any(word in category_text for word in ("dispatch", "delivery")):
                        st.caption("Milestone: Dispatch / delivery")
                    elif any(word in category_text for word in ("install", "fitting", "assembly")):
                        st.caption("Milestone: Installation")
                    remarks = str(activity.get("site_remarks", "")).strip()
                    if remarks and remarks.lower() not in ("nan", "none"):
                        st.caption(f"Remarks: {remarks}")
                    photo_urls = []
                    for photo_column in ("site_photo", "site_photos"):
                        photo_value = str(activity.get(photo_column, "")).strip()
                        photo_urls.extend(
                            url.strip()
                            for url in photo_value.split("|")
                            if url.strip().startswith("http")
                        )
                    for photo_url in dict.fromkeys(photo_urls):
                        st.link_button("Open site photo", photo_url)
                total_days = max(1, len(day_options))
                day_progress = min(
                    100,
                    round(100 * (day_options.index(selected_day) + 1) / total_days),
                )
                st.progress(
                    day_progress / 100,
                    text=f"{selected_day} timeline: {day_progress}%",
                )

            summary = str(site.get("products_summary", "")).strip()
            photo_links = re.findall(r"https?://[^\s|]+", summary)
            for photo_url in dict.fromkeys(photo_links):
                st.link_button("Open order / site photo", photo_url)