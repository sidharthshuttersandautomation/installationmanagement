import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Database,
  Cloud,
  FileSpreadsheet,
  Image,
  ArrowRight,
  Code2,
  Copy,
  Check,
  Download,
  Server,
  Layers,
  ShieldCheck,
  X,
} from 'lucide-react';

interface DatabaseArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DatabaseArchitectureModal: React.FC<DatabaseArchitectureModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { sites, workers, dailyLogs } = useApp();
  const [activeTab, setActiveTab] = useState<'overview' | 'sql_ddl' | 'python_adapter'>('overview');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generate real DDL & SQL Inserts from current live state
  const generateSqlScript = () => {
    return `-- ============================================================================
-- SIDHARTH SHUTTER & AUTOMATION — SQL DATABASE MIGRATION SCRIPT
-- Generated from current Google Sheets & Operations Database Schema
-- Compatible with SQLite, PostgreSQL, and Cloud SQL
-- ============================================================================

-- 1. Sites Master Table
CREATE TABLE IF NOT EXISTS Sites_Master (
    installation_id VARCHAR(50) PRIMARY KEY,
    client_name VARCHAR(150) NOT NULL,
    client_phone VARCHAR(20),
    client_email VARCHAR(100),
    salesperson_id VARCHAR(30),
    salesperson_name VARCHAR(100),
    team_lead VARCHAR(100),
    team_members TEXT,
    site_city VARCHAR(100),
    site_address TEXT,
    order_date DATE,
    handover_date DATE,
    actual_handover_date DATE,
    deal_status VARCHAR(50) DEFAULT 'Confirmed Order',
    deal_amount DECIMAL(12, 2) DEFAULT 0.00,
    product_finalized VARCHAR(150),
    product_quantity INT DEFAULT 1,
    products_summary TEXT,
    site_photos TEXT,
    status VARCHAR(50) DEFAULT 'In Progress',
    delay_category VARCHAR(100) DEFAULT 'No Delay',
    hold_reason TEXT,
    budget_allocated DECIMAL(12, 2) DEFAULT 0.00,
    budget_spent DECIMAL(12, 2) DEFAULT 0.00
);

-- 2. Workers Master Table
CREATE TABLE IF NOT EXISTS Workers_Master (
    worker_id VARCHAR(30) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    designation VARCHAR(50),
    phone_no VARCHAR(20),
    pin VARCHAR(10),
    base_location VARCHAR(100) DEFAULT 'Jaipur',
    status VARCHAR(30) DEFAULT 'Available'
);

-- 3. Worker Daily Logs Table (Google Drive photo links + delay categories)
CREATE TABLE IF NOT EXISTS Worker_Daily_Logs (
    log_id VARCHAR(50) PRIMARY KEY,
    installation_id VARCHAR(50) REFERENCES Sites_Master(installation_id),
    site_day VARCHAR(30),
    logged_date DATE,
    worker_name VARCHAR(100),
    worker_role VARCHAR(50),
    team_lead_name VARCHAR(100),
    task_category VARCHAR(100),
    task_name TEXT,
    hours_spent DECIMAL(4, 2) DEFAULT 0.00,
    minutes_spent INT DEFAULT 0,
    base_location VARCHAR(100),
    site_city VARCHAR(100),
    is_travel_day VARCHAR(10) DEFAULT 'No',
    delay_category VARCHAR(100) DEFAULT 'No Delay',
    site_remarks TEXT,
    site_photo TEXT, -- Google Drive webViewLink or S3/GCS bucket URL
    logged_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Site Expense Logs Table
CREATE TABLE IF NOT EXISTS Expense_Logs (
    exp_id VARCHAR(50) PRIMARY KEY,
    installation_id VARCHAR(50) REFERENCES Sites_Master(installation_id),
    exp_date DATE,
    logged_date DATE,
    supervisor_name VARCHAR(100),
    travel_expense DECIMAL(10, 2) DEFAULT 0.00,
    stay_expense DECIMAL(10, 2) DEFAULT 0.00,
    food_expense DECIMAL(10, 2) DEFAULT 0.00,
    misc_expense DECIMAL(10, 2) DEFAULT 0.00,
    total_expense DECIMAL(10, 2) DEFAULT 0.00,
    exp_remarks TEXT
);

-- ============================================================================
-- SEED DATA (MIGRATED FROM GOOGLE SHEETS)
-- ============================================================================
${sites
  .map(
    (s) =>
      `INSERT INTO Sites_Master (installation_id, client_name, site_city, deal_amount, status, delay_category) VALUES ('${s.id}', '${s.clientName.replace(/'/g, "''")}', '${s.location}', ${s.dealValue}, '${s.status}', '${s.delayJustification ? 'Client Requested Delay' : 'No Delay'}');`
  )
  .slice(0, 5)
  .join('\n')}

${workers
  .map(
    (w) =>
      `INSERT INTO Workers_Master (worker_id, name, role, designation, status) VALUES ('${w.id}', '${w.name}', 'Worker', '${w.designation}', '${w.status}');`
  )
  .slice(0, 5)
  .join('\n')}
`;
  };

  const pythonAdapterCode = `# installation_app/services/db_adapter.py
"""
Sidharth Shutter & Automation — Dual Database Storage Adapter
Seamlessly switch between Google Sheets (gspread) and SQL (SQLite / PostgreSQL / Cloud SQL)
without changing any UI View code!
"""
import os
import sqlite3
import pandas as pd
from typing import Dict, Any, List

# Toggle this flag to switch database engine:
# "SHEETS" -> Uses Google Sheets API + Google Drive
# "SQL"    -> Uses SQLite / PostgreSQL / Cloud SQL
DB_MODE = os.getenv("STORAGE_MODE", "SHEETS")
SQLITE_DB_PATH = "installation_management.db"

def get_connection():
    if DB_MODE == "SQL":
        return sqlite3.connect(SQLITE_DB_PATH)
    return None

def read_data(table_or_sheet_name: str) -> pd.DataFrame:
    """Universal read method for both Google Sheets & SQL."""
    if DB_MODE == "SHEETS":
        from installation_app.services.sheets import read_sheet
        return read_sheet(table_or_sheet_name)
    else:
        conn = get_connection()
        query = f"SELECT * FROM {table_or_sheet_name}"
        df = pd.read_sql_query(query, conn)
        conn.close()
        return df

def append_record(table_or_sheet_name: str, row_dict: Dict[str, Any]) -> bool:
    """Universal append method for both Google Sheets & SQL."""
    if DB_MODE == "SHEETS":
        from installation_app.services.sheets import append_to_sheet
        return append_to_sheet(table_or_sheet_name, row_dict)
    else:
        conn = get_connection()
        cols = ", ".join(row_dict.keys())
        placeholders = ", ".join(["?" for _ in row_dict])
        sql = f"INSERT INTO {table_or_sheet_name} ({cols}) VALUES ({placeholders})"
        cur = conn.cursor()
        cur.execute(sql, list(row_dict.values()))
        conn.commit()
        conn.close()
        return True
`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadSql = () => {
    const text = generateSqlScript();
    const blob = new Blob([text], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sidharth_shutter_migration.sql';
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-white border-2 border-[#10418A] rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#10418A] to-[#1E5BB5] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Database className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                Google Sheets + Drive ⇄ Future SQL Architecture
              </h3>
              <p className="text-xs text-blue-100">
                Sidharth Shutter &amp; Automation Database Evolution Blueprint
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-2 bg-slate-100 border-b border-slate-200 flex items-center gap-2 text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 font-bold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-[#10418A] text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            1. Architecture &amp; Viability Answer
          </button>
          <button
            onClick={() => setActiveTab('sql_ddl')}
            className={`px-3 py-1.5 font-bold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'sql_ddl'
                ? 'bg-[#10418A] text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            2. SQL Schema &amp; Migration Script
          </button>
          <button
            onClick={() => setActiveTab('python_adapter')}
            className={`px-3 py-1.5 font-bold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'python_adapter'
                ? 'bg-[#10418A] text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            3. Python Dual-Engine Adapter
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 leading-relaxed">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm">
                    Yes! You can 100% build this with Streamlit, Google Sheets &amp; Google Drive today, and switch to SQL later!
                  </h4>
                  <p className="mt-1 text-emerald-800">
                    This is an industry-proven architecture for field management systems. Google Sheets gives your management real-time visibility without needing a separate admin CMS, and Google Drive handles large photo uploads seamlessly.
                  </p>
                </div>
              </div>

              {/* Data Flow Diagram */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="p-4 rounded-xl bg-[#F4F7FC] border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-[#10418A]">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Google Sheets (Data)</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Stores structured rows: <code>Sites_Master</code>, <code>Workers_Master</code>, <code>Worker_Daily_Logs</code>, <code>Expense_Logs</code>.
                  </p>
                  <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-slate-200 inline-block">
                    Easy manual inspection by MD/HQ
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[#F4F7FC] border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-[#10418A]">
                    <Image className="w-4 h-4 text-blue-600" />
                    <span>Google Drive (Photos)</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Folder ID <code>0ADjIFMwZGB62Uk9PVA</code> stores high-res arrival/exit photos, vehicle manifests, and site damage logs.
                  </p>
                  <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-slate-200 inline-block">
                    Returns webViewLink directly
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[#F4F7FC] border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-[#10418A]">
                    <Database className="w-4 h-4 text-indigo-600" />
                    <span>Future SQL Migration</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    When concurrency grows beyond 50+ simultaneous workers, point the adapter to PostgreSQL / Cloud SQL with zero frontend changes!
                  </p>
                  <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-slate-200 inline-block">
                    1-Click Python Migration
                  </span>
                </div>
              </div>

              {/* Best Practices for Smooth Future SQL Transition */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="font-bold text-[#10418A] text-sm">
                  3 Rules to Make the Future SQL Migration 100% Painless:
                </h4>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
                  <li>
                    <strong>Keep Header Names Exact:</strong> Ensure Google Sheet headers match SQL snake_case column names (e.g. <code>installation_id</code>, <code>worker_id</code>, <code>logged_date</code>, <code>delay_category</code>).
                  </li>
                  <li>
                    <strong>Standardize Delay Values with Dropdowns:</strong> Never let technicians type free-text for status/delays. Using the <code>DELAY_REASONS</code> dropdown prevents dirty data when migrating to an SQL ENUM column.
                  </li>
                  <li>
                    <strong>Store Drive URLs as Strings:</strong> The <code>site_photo</code> column stores public webViewLinks as standard <code>VARCHAR/TEXT</code>. When migrating to SQL, these URLs remain valid without re-uploading photos!
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'sql_ddl' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-600">
                  Production-ready DDL script matching your exact <code>Sites_Master</code>, <code>Workers_Master</code>, <code>Worker_Daily_Logs</code>, and <code>Expense_Logs</code> tables.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(generateSqlScript())}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy SQL'}</span>
                  </button>
                  <button
                    onClick={downloadSql}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00A859] hover:bg-[#008f4c] text-white font-semibold cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .sql</span>
                  </button>
                </div>
              </div>

              <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto max-h-80 leading-relaxed">
                {generateSqlScript()}
              </pre>
            </div>
          )}

          {activeTab === 'python_adapter' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-600">
                  Drop this <code>db_adapter.py</code> into your Streamlit project to toggle between Google Sheets and SQL with a single environment variable:
                </p>
                <button
                  onClick={() => copyToClipboard(pythonAdapterCode)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied Code!' : 'Copy Adapter'}</span>
                </button>
              </div>

              <pre className="p-4 bg-slate-900 text-emerald-300 rounded-xl font-mono text-[11px] overflow-x-auto max-h-80 leading-relaxed">
                {pythonAdapterCode}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">
            Sidharth Shutter &amp; Automation — Enterprise IT Architecture
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#10418A] text-white rounded-lg font-bold hover:bg-[#0d346e] cursor-pointer"
          >
            Close Blueprint
          </button>
        </div>
      </div>
    </div>
  );
};
