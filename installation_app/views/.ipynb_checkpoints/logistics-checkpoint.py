import streamlit as st
import pandas as pd
from installation_app.services.sheets import load_sheet_data, update_cell_in_sheet, append_row_to_sheet
from installation_app.components.ui import render_header, render_kpi_card

import streamlit as st

def render_logistics_dashboard():
    """
    Logistics View Module Placeholder.
    Keep blank for now as per requirements.
    """
    st.header("🚚 Logistics & Supply Chain Portal")
    st.info("Logistics module under active development.")
    
def render_logistics_view():
    render_header("🚚 Logistics & Material Dispatch", "Manage shutter factory dispatches, component tracking, and delivery schedules")

    df_sites = load_sheet_data("Sites_Master")
        
    c1, c2, c3 = st.columns(3)
    with c1:
        render_kpi_card("Pending Dispatches", "4 Sites")
    with c2:
        render_kpi_card("In Transit", "2 Vehicles")
    with c3:
        render_kpi_card("Delivered Today", "1 Site")

    tab1, tab2 = st.tabs(["Dispatch Dispatcher", "Material Tracking"])

    with tab1:
        st.subheader("Dispatch Materials to Active Site")
        if not df_sites.empty:
            site_id = st.selectbox("Select Target Site for Dispatch", df_sites['installation_id'].tolist(), key="log_site_select")
            
            with st.form("logistics_dispatch_form"):
                transporter_name = st.text_input("Transporter / Driver Name")
                vehicle_no = st.text_input("Vehicle Registration No (e.g., RJ-14-GA-1234)")
                lr_number = st.text_input("LR / Bilty Number")
                dispatch_items = st.text_area("Dispatched Items List", placeholder="e.g., 20ft Slat Panels, Guide Channels, 1x Motor Box")
                
                if st.form_submit_button("Record Material Dispatch"):
                    st.success(f"Dispatch recorded for {site_id}! Driver: {transporter_name} ({vehicle_no})")

    with tab2:
        st.subheader("Active Shipments & Delivery Status")
        sample_logistics_data = pd.DataFrame([
            {"Dispatch ID": "DISP-101", "Site ID": "INST-2026-0012", "Transporter": "Jaipur Freight", "Status": "In Transit", "ETA": "2026-10-02"},
            {"Dispatch ID": "DISP-102", "Site ID": "INST-2026-0015", "Transporter": "Express Logistics", "Status": "Delivered", "ETA": "2026-09-30"}
        ])
        st.dataframe(sample_logistics_data, use_container_width=True)