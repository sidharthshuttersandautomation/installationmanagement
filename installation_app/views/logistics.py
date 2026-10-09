import re
from datetime import datetime, timedelta

import pandas as pd
import streamlit as st

from installation_app.services.sheets import read_sheet, update_sheet_record
from installation_app.components.ui import render_header, render_data_drawer
from installation_app.services.drive import upload_file_to_drive


def _display_value(value, fallback="Not recorded"):
    text = str(value).strip()
    return fallback if text.casefold() in ("", "nan", "none") else text


def render_logistics_dashboard():
    st.header("🚚 Logistics & Supply Chain Portal")
    render_logistics_view()


def render_logistics_view(menu=None, user=None):
    render_header(
        "🚚 Logistics & Material Dispatch",
        "Review confirmed orders and their finalized products for production and fulfillment.",
    )
    sites = read_sheet("Sites_Master")
    if sites.empty:
        st.info("No order records are available in Sites_Master.")
        return

    orders = sites.copy()
    orders.columns = [
        re.sub(r"[\s\-]+", "_", str(column).strip().lower())
        for column in orders.columns
    ]
    orders = orders.loc[:, ~orders.columns.duplicated()]
    deal_status = (
        orders["deal_status"].astype(str).str.strip().str.casefold()
        if "deal_status" in orders.columns
        else pd.Series("", index=orders.index)
    )
    if deal_status.ne("").any():
        confirmed = orders[deal_status.eq("confirmed order")].copy()
    else:
        status = (
            orders["status"].astype(str).str.strip().str.casefold()
            if "status" in orders.columns
            else pd.Series("", index=orders.index)
        )
        confirmed = orders[
            status.isin(["in progress", "handovered", "handover", "completed"])
        ].copy()

    total_confirmed = len(confirmed)
    missing_product = 0
    if total_confirmed:
        product_values = confirmed.get(
            "product_finalized",
            confirmed.get("products_summary", pd.Series("", index=confirmed.index)),
        )
        missing_product = product_values.astype(str).str.strip().eq("").sum()

    kpi_order, kpi_product = st.columns(2)
    kpi_order.metric("Confirmed orders available", total_confirmed)
    kpi_product.metric("Orders missing product details", int(missing_product))

    confirmed_tab, dispatch_tab, workflow_tab = st.tabs(
        ["Confirmed orders", "Dispatch tracking", "Update production / delivery"]
    )
    with confirmed_tab:
        st.subheader("Ready for logistics / production")
        if confirmed.empty:
            st.info("No confirmed orders are currently available.")
        else:
            display = pd.DataFrame(
                {
                    "Order ID": confirmed.get(
                        "installation_id", pd.Series("", index=confirmed.index)
                    ),
                    "Client": confirmed.get(
                        "client_name",
                        confirmed.get("company_name", pd.Series("", index=confirmed.index)),
                    ),
                    "Finalized product": confirmed.get(
                        "product_finalized",
                        confirmed.get(
                            "products_summary",
                            pd.Series("Product details not recorded", index=confirmed.index),
                        ),
                    ),
                    "Quantity": confirmed.get(
                        "product_quantity", pd.Series("", index=confirmed.index)
                    ),
                    "Salesperson": confirmed.get(
                        "salesperson_name", pd.Series("", index=confirmed.index)
                    ),
                    "Order date": confirmed.get(
                        "order_date", pd.Series("", index=confirmed.index)
                    ),
                    "Delivery location": confirmed.get(
                        "site_city",
                        confirmed.get("site_address", pd.Series("", index=confirmed.index)),
                    ),
                    "Status": confirmed.get(
                        "production_status",
                        confirmed.get("status", pd.Series("Confirmed Order", index=confirmed.index)),
                    ),
                },
                index=confirmed.index,
            )
            display["Finalized product"] = display["Finalized product"].where(
                display["Finalized product"].astype(str).str.strip().ne(""),
                confirmed.get(
                    "products_summary",
                    pd.Series("Product details not recorded", index=confirmed.index),
                ),
            )
            for _, order in display.iterrows():
                with st.container(border=True):
                    st.markdown(
                        f"**{_display_value(order['Order ID'])} · "
                        f"{_display_value(order['Client'], 'Client')}**"
                    )
                    st.write(
                        f"**Product specifications:** "
                        f"{_display_value(order['Finalized product'], 'Product details not recorded')}"
                    )
                    st.caption(
                        f"Quantity: {_display_value(order['Quantity'])} · "
                        f"Salesperson: {_display_value(order['Salesperson'])} · "
                        f"Order date: {_display_value(order['Order date'])}"
                    )
                    st.write(f"**Delivery location:** {_display_value(order['Delivery location'])}")
                    st.caption(f"Fulfillment status: {_display_value(order['Status'])}")
                    product = str(order["Finalized product"]).strip()
                    if not product or product.lower() == "nan":
                        st.warning(
                            f"Order {order['Order ID']} is confirmed but its product details are not recorded."
                        )
            render_data_drawer(
                "Inspect and export confirmed orders",
                confirmed,
                "logistics_confirmed_orders",
            )

    with dispatch_tab:
        st.subheader("Dispatch and delivery milestones")
        milestone_columns = [
            column
            for column in (
                "production_started_at",
                "production_completed_at",
                "dispatched_at",
                "delivered_at",
                "dispatch_date",
                "delivery_date",
            )
            if column in confirmed.columns
        ]
        if confirmed.empty:
            st.info("There are no confirmed orders to track.")
        elif not milestone_columns:
            st.info(
                "Confirmed orders flow into this list automatically from Sites_Master. "
                "Production, dispatch, and delivery timestamps are not captured in the current sheet, "
                "so milestone tracking will appear once those fields are added to the existing order sheet."
            )
        else:
            columns = [
                column
                for column in (
                    "installation_id",
                    "client_name",
                    "product_finalized",
                    "products_summary",
                    "production_status",
                    "target_production_days",
                    "target_dispatch_date",
                    "site_address",
                    "estimated_arrival_at",
                    "dispatch_vehicle",
                    "tracking_reference",
                    *milestone_columns,
                )
                if column in confirmed.columns
            ]
            for _, milestone in confirmed[columns].iterrows():
                with st.container(border=True):
                    st.markdown(
                        f"**{milestone.get('installation_id', 'Order')} · "
                        f"{milestone.get('client_name', 'Client')}**"
                    )
                    st.caption(str(milestone.get("production_status", "Not started")))
                    for timestamp in milestone_columns:
                        st.write(
                            f"**{timestamp.replace('_', ' ').title()}:** "
                            f"{milestone.get(timestamp, 'Not recorded')}"
                        )
                    for field_name, label in (
                        ("target_production_days", "Target production days"),
                        ("target_dispatch_date", "Target dispatch"),
                        ("site_address", "Delivery address"),
                        ("estimated_arrival_at", "Estimated arrival"),
                        ("dispatch_vehicle", "Vehicle / courier"),
                    ):
                        value = str(milestone.get(field_name, "")).strip()
                        if value and value.casefold() != "nan":
                            st.write(f"**{label}:** {value}")
                    tracking = str(milestone.get("tracking_reference", "")).strip()
                    if tracking.startswith(("http://", "https://")):
                        st.link_button("Open tracking", tracking)
                    elif tracking:
                        st.write(f"**Tracking reference:** {tracking}")
                    for photo_field in (
                        "pre_dispatch_photo_url",
                        "loaded_vehicle_photo_url",
                    ):
                        photo_url = str(confirmed.loc[milestone.name].get(photo_field, "")).strip()
                        if photo_url.startswith("http"):
                            st.link_button(photo_field.replace("_", " ").title(), photo_url)
            render_data_drawer(
                "Inspect and export dispatch milestones",
                confirmed,
                "logistics_dispatch_milestones",
            )
        if not confirmed.empty and "target_dispatch_date" in confirmed.columns:
            targets = pd.to_datetime(
                confirmed["target_dispatch_date"], errors="coerce"
            ).dt.normalize()
            today = datetime.now().date()
            due = confirmed[
                targets.notna()
                & targets.le(pd.Timestamp(today + timedelta(days=3)))
            ]
            for _, order in due.iterrows():
                due_date = pd.to_datetime(order["target_dispatch_date"]).date()
                message = (
                    f"Order {order.get('installation_id')} target dispatch is overdue "
                    f"({due_date})."
                    if due_date < today
                    else f"Order {order.get('installation_id')} is due to dispatch by {due_date}."
                )
                if due_date < today:
                    st.error(message)
                else:
                    st.warning(message)

    with workflow_tab:
        st.subheader("Record production and fulfillment milestones")
        if confirmed.empty:
            st.info("No confirmed orders are available for tracking.")
        else:
            order_ids = confirmed.get(
                "installation_id", pd.Series("", index=confirmed.index)
            ).astype(str).str.strip()
            order_options = {
                f"{row.get('installation_id')} — {row.get('client_name', 'Client')}": str(
                    row.get("installation_id")
                ).strip()
                for _, row in confirmed.iterrows()
                if str(row.get("installation_id", "")).strip()
            }
            if order_options:
                selected_label = st.selectbox(
                    "Confirmed order",
                    list(order_options.keys()),
                    key="logistics_order_selection",
                )
                selected_id = order_options[selected_label]
                order = confirmed[order_ids.eq(selected_id)].iloc[0]
                status_options = [
                    "Not Started",
                    "In Production",
                    "Production Complete",
                    "Dispatched",
                    "Delivered",
                ]
                existing_status = str(order.get("production_status", "Not Started")).strip()
                if existing_status not in status_options:
                    existing_status = "Not Started"
                raw_target_days = pd.to_numeric(
                    pd.Series([order.get("target_production_days", 0)]),
                    errors="coerce",
                ).fillna(0).iloc[0]
                current_dispatch_date = pd.to_datetime(
                    order.get("target_dispatch_date"), errors="coerce"
                )
                dispatch_date_default = (
                    current_dispatch_date.date()
                    if pd.notna(current_dispatch_date)
                    else datetime.now().date() + timedelta(days=7)
                )
                with st.form(f"fulfillment_form_{selected_id}"):
                    production_status = st.selectbox(
                        "Fulfillment stage",
                        status_options,
                        index=status_options.index(existing_status),
                    )
                    target_days = st.number_input(
                        "Target production days",
                        min_value=1,
                        value=max(1, int(raw_target_days)),
                        step=1,
                    )
                    target_dispatch_date = st.date_input(
                        "Target dispatch date",
                        value=dispatch_date_default,
                    )
                    dispatch_vehicle = st.text_input(
                        "Dispatch vehicle / courier",
                        value=str(order.get("dispatch_vehicle", "")),
                    )
                    delivery_address = st.text_input(
                        "Target delivery address",
                        value=str(order.get("site_address", "")),
                    )
                    estimated_arrival = st.text_input(
                        "Estimated arrival (date/time)",
                        value=str(order.get("estimated_arrival_at", "")),
                        placeholder="YYYY-MM-DD HH:MM",
                    )
                    tracking_reference = st.text_input(
                        "Tracking reference or URL",
                        value=str(order.get("tracking_reference", "")),
                    )
                    milestone_notes = st.text_area(
                        "Production / delivery notes",
                        value=str(order.get("fulfillment_notes", "")),
                    )
                    completed_product_photo = st.file_uploader(
                        "Completed product photo",
                        type=["jpg", "jpeg", "png"],
                        key=f"completed_product_photo_{selected_id}",
                    )
                    pre_dispatch_photo = st.file_uploader(
                        "Pre-dispatch photo (required before dispatch)",
                        type=["jpg", "jpeg", "png"],
                        key=f"pre_dispatch_photo_{selected_id}",
                    )
                    loaded_vehicle_photo = st.file_uploader(
                        "Loaded vehicle photo (required before dispatch)",
                        type=["jpg", "jpeg", "png"],
                        key=f"loaded_vehicle_photo_{selected_id}",
                    )
                    save_milestone = st.form_submit_button("Save fulfillment update")

                if save_milestone:
                    now = datetime.now().isoformat(timespec="seconds")
                    stage_rank = status_options.index(production_status)
                    updates = {
                        "production_status": production_status,
                        "target_production_days": int(target_days),
                        "target_dispatch_date": str(target_dispatch_date),
                        "dispatch_vehicle": dispatch_vehicle.strip(),
                        "site_address": delivery_address.strip(),
                        "estimated_arrival_at": estimated_arrival.strip(),
                        "tracking_reference": tracking_reference.strip(),
                        "fulfillment_notes": milestone_notes.strip(),
                        "fulfillment_updated_at": now,
                        "fulfillment_updated_by": (
                            str(user.get("name", ""))
                            if isinstance(user, dict)
                            else ""
                        ),
                    }
                    timestamp_fields = (
                        (1, "production_started_at"),
                        (2, "production_completed_at"),
                        (3, "dispatched_at"),
                        (4, "delivered_at"),
                    )
                    for minimum_rank, field_name in timestamp_fields:
                        if stage_rank >= minimum_rank and not str(
                            order.get(field_name, "")
                        ).strip():
                            updates[field_name] = now

                    photo_inputs = (
                        (
                            completed_product_photo,
                            "completed_product_photo_url",
                            "completed_product",
                        ),
                        (pre_dispatch_photo, "pre_dispatch_photo_url", "pre_dispatch"),
                        (loaded_vehicle_photo, "loaded_vehicle_photo_url", "loaded_vehicle"),
                    )
                    required_dispatch_photos = (
                        production_status in ("Dispatched", "Delivered")
                    )
                    missing_dispatch_photos = [
                        label
                        for upload, field_name, label in photo_inputs[1:]
                        if required_dispatch_photos
                        and upload is None
                        and not str(order.get(field_name, "")).strip().startswith("http")
                    ]
                    if missing_dispatch_photos:
                        st.error(
                            "Upload both dispatch evidence photos before marking the order "
                            "dispatched: " + ", ".join(missing_dispatch_photos) + "."
                        )
                        continue_save = False
                    else:
                        continue_save = True

                    if continue_save:
                        for upload, field_name, label in photo_inputs:
                            if upload is None:
                                continue
                            photo_url = upload_file_to_drive(
                                upload,
                                f"{selected_id}_{label}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{upload.name}",
                            )
                            if not photo_url or photo_url == "Upload Failed":
                                st.error(
                                    f"The {label.replace('_', ' ')} photo could not be uploaded; "
                                    "no fulfillment changes were saved."
                                )
                                continue_save = False
                                break
                            updates[field_name] = photo_url

                    if continue_save:
                        if update_sheet_record(
                            "Sites_Master",
                            "installation_id",
                            selected_id,
                            updates,
                            ensure_columns=True,
                        ):
                            st.success(f"Fulfillment update saved for {selected_id}.")
                            st.rerun()
                render_data_drawer(
                    "Inspect and export this order's raw data",
                    pd.DataFrame([order]),
                    f"logistics_order_{selected_id}",
                )
