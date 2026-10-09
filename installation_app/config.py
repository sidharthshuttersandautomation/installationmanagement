import os
from pathlib import Path
from PIL import Image
import streamlit as st

# -----------------------------------------------------------------------------
# Paths & Directories
# -----------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
LOGO_PATH = BASE_DIR / "Company Logo.jpeg"

# Google Drive Constants
DRIVE_FOLDER_ID = "0ADjIFMwZGB62Uk9PVA"

# -----------------------------------------------------------------------------
# UI Theme & Color Palette Constants
# -----------------------------------------------------------------------------
COLOR_PRIMARY = "#1E3A8A"     # Primary Navy Blue
COLOR_ACCENT = "#2563EB"      # Accent Blue
COLOR_BG_LIGHT = "#F8FAFC"    # Light Background / Card Fill
COLOR_SECONDARY = "#64748B"   # Muted Slate
COLOR_TEXT_DARK = "#1E293B"   # Charcoal Text
COLOR_SUCCESS = "#16A34A"     # Success Green
COLOR_WARNING = "#D97706"     # Warning Amber

# -----------------------------------------------------------------------------
# Validation & Regex
# -----------------------------------------------------------------------------
EMAIL_REGEX = r"^[\w\.-]+@[\w\.-]+\.\w+$"

# -----------------------------------------------------------------------------
# Options & Catalogs
# -----------------------------------------------------------------------------
WORKER_DESIGNATIONS = ["Installer", "Helper", "Manager", "Painter", "Electrician"]

SYSTEM_ROLES = [
    "Worker",
    "Supervisor",
    "Salesperson",
    "Admin",
    "Logistics Coordinator",
    "Logistics Manager",
    "Production Manager",
    "Budget Manager",
]

STATUS_OPTIONS = [
    "In Progress",
    "On Hold",
    "Handovered",
    "Completed",
    "Cancelled",
]

HOLD_REASONS = [
    "Client Payment Pending",
    "Site Not Ready / Civil Work Pending",
    "Material Delivery Delayed",
    "Power Supply Issue at Site",
    "Client Requested Delay",
    "Other",
]

TASK_CATEGORIES = [
    "Shutter Installation",
    "Automation & Motor Fixing",
    "Track Leveling & Alignment",
    "Electrical Wiring & Testing",
    "Painting & Finishing",
    "Site Inspection / Measurement",
    "Maintenance / Repair",
    "Travel & Transport",
    "Other",
]

DELAY_REASONS = [
    "No Delay",
    "Client Site Unavailability",
    "Material Shortage",
    "Power Failure",
    "Weather Delay",
    "Technical Complexity",
    "Other",
]

PRODUCT_CATALOG = [
    "Motorized Rolling Shutter",
    "Manual Rolling Shutter",
    "High-Speed Door",
    "Sectional Overhead Door",
    "Automatic Sliding Door",
    "Fire Rated Shutter",
    "Accessories & Control Panels",
]

# -----------------------------------------------------------------------------
# Page Setup & CSS
# -----------------------------------------------------------------------------
def init_page():
    """Applies the default Streamlit page metadata and layout."""
    st.set_page_config(
        page_title="Sidharth Shutter & Automation",
        page_icon="🏭",
        layout="wide",
        initial_sidebar_state="expanded",
    )


def apply_custom_css():
    """Applies a compact, professional dashboard style shared across app pages."""
    st.markdown(
        """
        <style>
        :root {
            --primary: #1E3A8A;
            --accent: #2563EB;
            --bg: #F4F7FC;
            --card: #FFFFFF;
            --muted: #64748B;
            --text: #1E293B;
        }
        html, body, [data-testid="stAppViewContainer"] {
            background: var(--bg);
            color: var(--text);
        }
        .stApp {
            background: var(--bg);
        }
        section[data-testid="stSidebar"] {
            background: #EBF1F8;
        }
        h1, h2, h3, h4 {
            color: var(--primary) !important;
            font-weight: 700 !important;
        }
        .stButton>button {
            background: var(--accent) !important;
            color: white !important;
            border: none !important;
            border-radius: 8px !important;
            font-weight: 700 !important;
        }
        .stButton>button:hover {
            background: #1d4ed8 !important;
        }
        .block-container {
            padding-top: 1.5rem !important;
            padding-bottom: 2rem !important;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


# -----------------------------------------------------------------------------
# UI Helper Functions
# -----------------------------------------------------------------------------
def render_sidebar_logo():
    """
    Locates and displays the logo image from the root directory into 
    the Streamlit sidebar navigation, falling back to styled title text if missing.
    """
    config_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(config_dir, ".."))

    logo_names = [
        "Company Logo.jpeg", 
        "Company Logo.jpg", 
        "Company Logo.png", 
        "logo.png", 
        "logo.jpeg", 
        "logo.jpg"
    ]
    logo_path = None

    for name in logo_names:
        full_path = os.path.join(project_root, name)
        if os.path.exists(full_path):
            logo_path = full_path
            break

    if logo_path:
        try:
            image = Image.open(logo_path)
            st.sidebar.image(image, width="stretch")
        except Exception:
            st.sidebar.image(logo_path, width="stretch")
    else:
        st.sidebar.title("🚪 Sidharth Shutter")
        st.sidebar.caption("Automation & Installation")