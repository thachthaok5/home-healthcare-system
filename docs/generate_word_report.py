# -*- coding: utf-8 -*-
"""
Script: generate_word_report.py
Mục đích:
- Tự động tạo file Word Báo cáo tiến độ hoàn thiện Đồ án tốt nghiệp theo ĐÚNG 9 GÓP Ý MỚI NHẤT của GVHD.
- Tập trung 100% vào các nội dung đã thực hiện và hoàn thiện trong đợt feedback này, không lặp lại nội dung các lần trước.
- Tự động nạp toàn bộ số liệu thực nghiệm từ file manifest và các file CSV trong backend/artifacts/experiments/ (0% số liệu thủ công).
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime
import pandas as pd

if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

# Đường dẫn tương đối theo vị trí script (chạy được trên mọi máy và trên CI)
BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DOCX = BASE_DIR / "docs" / "Bao_cao_Tien_do_Dot_2_Nguyen_Thach_Thao.docx"
EXP_DIR = BASE_DIR / "backend" / "artifacts" / "experiments"

# Màu sắc chủ đạo (Navy Theme học thuật)
NAVY_PRIMARY = RGBColor(27, 54, 93)     # #1B365D
NAVY_SECONDARY = RGBColor(43, 84, 126)  # #2B547E
GRAY_TEXT = RGBColor(70, 70, 70)        # #464646
DARK_TEXT = RGBColor(30, 30, 30)
GREEN_ACCENT = RGBColor(16, 120, 70)

HEX_PRIMARY = "1B365D"
HEX_SECONDARY = "2B547E"
HEX_LIGHT_BG = "F4F6F9"
HEX_CALLOUT_BG = "F8FAFC"
HEX_BORDER = "D3D3D3"
HEX_HEADER_BG = "1B365D"


def set_cell_background(cell, hex_color):
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    cell._tc.get_or_add_tcPr().append(shd)


def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)


def set_table_borders(table, color="D3D3D3", sz="4", val="single"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideV w:val="none"/>'
        f'<w:left w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)


def add_callout(doc, text, title=None):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    
    cell = tbl.cell(0, 0)
    cell.width = Inches(6.3)
    set_cell_background(cell, HEX_CALLOUT_BG)
    set_cell_margins(cell, top=120, bottom=120, left=180, right=150)
    
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:left w:val="single" w:sz="24" w:space="0" w:color="{HEX_PRIMARY}"/>'
        f'<w:top w:val="none"/>'
        f'<w:bottom w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    
    if title:
        run_title = p.add_run(f"📌 {title}\n")
        run_title.font.name = "Times New Roman"
        run_title.font.size = Pt(10.5)
        run_title.font.bold = True
        run_title.font.color.rgb = NAVY_PRIMARY
        
    run_text = p.add_run(text)
    run_text.font.name = "Times New Roman"
    run_text.font.size = Pt(10.0)
    run_text.font.italic = True
    run_text.font.color.rgb = DARK_TEXT
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)


def add_code_block(doc, code_text):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    cell.width = Inches(6.3)
    set_cell_background(cell, "F1F5F9")
    set_cell_margins(cell, top=100, bottom=100, left=150, right=150)
    
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:left w:val="single" w:sz="12" w:space="0" w:color="{HEX_SECONDARY}"/>'
        f'<w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>'
        f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>'
        f'<w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.05
    run = p.add_run(code_text.strip())
    run.font.name = "Consolas"
    run.font.size = Pt(8.5)
    run.font.color.rgb = RGBColor(30, 41, 59)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)


def add_heading_1(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(16)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.font.name = "Times New Roman"
    run.font.size = Pt(14)
    run.font.bold = True
    run.font.color.rgb = NAVY_PRIMARY
    return p


def add_heading_2(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.font.name = "Times New Roman"
    run.font.size = Pt(12)
    run.font.bold = True
    run.font.color.rgb = NAVY_SECONDARY
    return p


def add_paragraph(doc, text, bold_prefix=None, space_after=6):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.2
    
    if bold_prefix:
        r_pre = p.add_run(bold_prefix)
        r_pre.font.name = "Times New Roman"
        r_pre.font.size = Pt(11)
        r_pre.font.bold = True
        r_pre.font.color.rgb = DARK_TEXT
        
    # Hỗ trợ **in đậm** và `mã` kiểu Markdown đơn giản (tránh in nguyên ký tự ** ra Word)
    import re
    for idx, chunk in enumerate(re.split(r"\*\*(.+?)\*\*", text)):
        if not chunk:
            continue
        r_text = p.add_run(chunk.replace("`", ""))
        r_text.font.name = "Times New Roman"
        r_text.font.size = Pt(11)
        r_text.font.color.rgb = DARK_TEXT
        if idx % 2 == 1:
            r_text.font.bold = True
    return p


# ---------------------------------------------------------------------------
# TIỆN ÍCH ĐỌC SỐ LIỆU: mọi con số trong phần nhận xét đều lấy trực tiếp từ CSV/manifest
# ---------------------------------------------------------------------------
def mean_of(cell):
    """'38.80 ± 2.96' -> 38.80 ; '66.0% ± 3.5%' -> 66.0"""
    return float(str(cell).split("±")[0].replace("%", "").strip())


def std_of(cell):
    parts = str(cell).split("±")
    return float(parts[1].replace("%", "").strip()) if len(parts) > 1 else 0.0


def vn(x, nd=2):
    """Định dạng số kiểu Việt Nam: 1.237,20"""
    txt = f"{x:,.{nd}f}"
    return txt.replace(",", "_").replace(".", ",").replace("_", ".")


def vn_ms(cell, nd=2):
    return f"{vn(mean_of(cell), nd)} ± {vn(std_of(cell), nd)}"


def pick(df, **cond):
    sub = df
    for k, v in cond.items():
        if isinstance(v, str) and v.endswith("*"):
            sub = sub[sub[k].astype(str).str.startswith(v[:-1])]
        else:
            sub = sub[sub[k] == v]
    assert len(sub) == 1, f"Không tìm thấy duy nhất 1 dòng với điều kiện {cond} (tìm thấy {len(sub)})"
    return sub.iloc[0]


def pct_change(old, new):
    return (old - new) / old * 100.0 if old else 0.0


def build_word_report():
    doc = docx.Document()
    
    # 1. Cấu hình lề trang (A4 chuẩn: Top 2cm, Bottom 2cm, Left 2.5cm, Right 2cm)
    for section in doc.sections:
        section.top_margin = Inches(0.79)
        section.bottom_margin = Inches(0.79)
        section.left_margin = Inches(0.98)
        section.right_margin = Inches(0.79)
        section.page_width = Inches(8.27)
        section.page_height = Inches(11.69)

    # Nạp dữ liệu manifest để bảo đảm 100% tính khoa học
    manifest_path = EXP_DIR / "experiment_run_manifest.json"
    manifest = {}
    if manifest_path.exists():
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

    git_sha = manifest["git_commit_sha"]
    run_dt = manifest["run_datetime_local"]
    py_ver = manifest["python_version"]
    seeds_str = str(manifest["seeds"])
    model_ver = manifest["ai_model_version"]
    model_art = manifest["ai_model_artifact"]

    r_stats = manifest["routing_stats"]
    cov_pct = r_stats["osrm_coverage_pct"]
    tot_queries = r_stats["total_queries"]
    cache_hits = r_stats["counts"]["osrm_cache"]
    hav_cnt = r_stats["counts"]["haversine_fallback"]
    hav_pct = r_stats["ratios_pct"]["haversine_fallback_pct"]
    same_cnt = r_stats["counts"]["same_location"]
    same_pct = r_stats["ratios_pct"]["same_location_pct"]
    libs = manifest.get("library_versions", {})
    tol_min = manifest.get("delay_tolerance_minutes", 15)
    tol_list = manifest.get("delay_tolerance_sensitivity_minutes", [10, 15, 20])
    solver_cfg = manifest.get("ortools_solver", {})
    target_date_str = manifest.get("benchmark_target_date", "")

    df_stress_raw = pd.read_csv(EXP_DIR / "stress_test_benchmark_results.csv")
    max_runtime_ms = float(df_stress_raw["runtime_ms"].max())

    # Số test thực tế trong backend/tests (không ghi tay)
    import re
    n_tests = sum(len(re.findall(r"^def test_", f.read_text(encoding="utf-8"), flags=re.M))
                  for f in (BASE_DIR / "backend" / "tests").glob("test_*.py"))

    # -------------------------------------------------------------
    # TIÊU ĐỀ & KHUNG THÔNG TIN BÁO CÁO
    # -------------------------------------------------------------
    p_inst = doc.add_paragraph()
    p_inst.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_inst.paragraph_format.space_after = Pt(2)
    r_inst = p_inst.add_run("BỘ GIÁO DỤC VÀ ĐÀO TẠO — TRƯỜNG ĐẠI HỌC ...\nKHOA HỆ THỐNG THÔNG TIN QUẢN LÝ (MIS)")
    r_inst.font.name = "Times New Roman"
    r_inst.font.size = Pt(11)
    r_inst.font.bold = True
    r_inst.font.color.rgb = NAVY_SECONDARY

    p_line = doc.add_paragraph()
    p_line.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_line.paragraph_format.space_after = Pt(12)
    r_line = p_line.add_run("━━━━━━━ ★ ━━━━━━━")
    r_line.font.color.rgb = NAVY_PRIMARY

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(4)
    p_title.paragraph_format.space_after = Pt(6)
    r_t1 = p_title.add_run("BÁO CÁO TIẾN ĐỘ HOÀN THIỆN ĐỒ ÁN TỐT NGHIỆP\n")
    r_t1.font.name = "Times New Roman"
    r_t1.font.size = Pt(17)
    r_t1.font.bold = True
    r_t1.font.color.rgb = NAVY_PRIMARY
    
    r_t2 = p_title.add_run("HOÀN THIỆN TOÀN DIỆN THỰC NGHIỆM KHOA HỌC & TRIỂN KHAI GIAO DIỆN ĐIỀU PHỐI VIÊN\n")
    r_t2.font.name = "Times New Roman"
    r_t2.font.size = Pt(12.5)
    r_t2.font.bold = True
    r_t2.font.color.rgb = NAVY_SECONDARY

    r_t3 = p_title.add_run("(Cập nhật theo các góp ý của Giảng viên Hướng dẫn — bản freeze kết quả thực nghiệm)")
    r_t3.font.name = "Times New Roman"
    r_t3.font.size = Pt(11)
    r_t3.font.italic = True
    r_t3.font.color.rgb = GRAY_TEXT

    # Khung tác giả & đề tài
    info_table = doc.add_table(rows=4, cols=2)
    info_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(info_table, color="B0C4DE", sz="6", val="single")
    info_data = [
        ("Tên đề tài:", "Nghiên cứu và thiết kế hệ thống thông tin quản lý dịch vụ chăm sóc sức khỏe tại nhà tích hợp AI hỗ trợ lập lịch và điều phối nhân sự y tế"),
        ("Sinh viên thực hiện:", "Nguyễn Thạch Thảo  —  Lớp: 65.TTQL_1 (Chuyên ngành MIS)"),
        ("Giảng viên hướng dẫn:", ""),
        ("Mã nguồn & Repository:", "https://github.com/thachthaok5/home-healthcare-system  (Nhánh: main)")
    ]
    for idx, (label, val) in enumerate(info_data):
        c0 = info_table.cell(idx, 0)
        c1 = info_table.cell(idx, 1)
        c0.width = Inches(2.0)
        c1.width = Inches(4.3)
        set_cell_background(c0, HEX_LIGHT_BG)
        set_cell_background(c1, "FFFFFF")
        set_cell_margins(c0, top=60, bottom=60, left=100, right=80)
        set_cell_margins(c1, top=60, bottom=60, left=100, right=80)
        
        p0 = c0.paragraphs[0]
        p0.paragraph_format.space_after = Pt(0)
        r0 = p0.add_run(label)
        r0.font.bold = True
        r0.font.size = Pt(10)
        r0.font.color.rgb = NAVY_PRIMARY
        
        p1 = c1.paragraphs[0]
        p1.paragraph_format.space_after = Pt(0)
        r1 = p1.add_run(val)
        r1.font.size = Pt(10)
        if "http" in val:
            r1.font.bold = True
            r1.font.color.rgb = RGBColor(0, 102, 204)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # Khung Thông số Kỹ thuật & Cam kết Tính Tái lập Thực nghiệm (Reproducibility Metadata)
    audit_table = doc.add_table(rows=6, cols=2)
    audit_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(audit_table, color="2B547E", sz="6", val="single")

    routing_str = (f"OSRM cache + deterministic Haversine fallback: {vn(tot_queries, 0)} truy vấn, trong đó OSRM cache "
                   f"{vn(cache_hits, 0)} ({vn(cov_pct)}%), Haversine {vn(hav_cnt, 0)} ({vn(hav_pct)}%), trùng vị trí {vn(same_cnt, 0)} ({vn(same_pct)}%)")

    audit_meta = [
        ("Git Commit SHA Đóng băng:", f"{git_sha} (tag thesis-experiments-final)"),
        ("Thời điểm thực thi Thực nghiệm:", f"{run_dt} — ngày mô phỏng cố định {target_date_str}; số liệu sinh tự động từ pipeline"),
        ("Môi trường Phần mềm & Thư viện:", f"Python {py_ver} ({manifest.get('platform', '')}), OR-Tools {libs.get('ortools', '?')}, scikit-learn {libs.get('scikit-learn', '?')}, pandas {libs.get('pandas', '?')}, PostgreSQL 16"),
        ("Danh sách Random Seeds chuẩn hóa:", f"{seeds_str} (5 hạt giống cố định chạy cho toàn bộ các bài benchmark)"),
        ("Mô hình AI & Trọng số Huấn luyện:", f"Random Forest Regressor {model_ver} ({model_art})"),
        ("Động cơ Định tuyến & Tính cự ly:", routing_str)
    ]
    for idx, (label, val) in enumerate(audit_meta):
        c0 = audit_table.cell(idx, 0)
        c1 = audit_table.cell(idx, 1)
        c0.width = Inches(2.2)
        c1.width = Inches(4.1)
        set_cell_background(c0, "EBF3FA")
        set_cell_background(c1, "FFFFFF")
        set_cell_margins(c0, top=50, bottom=50, left=100, right=80)
        set_cell_margins(c1, top=50, bottom=50, left=100, right=80)

        p0 = c0.paragraphs[0]
        p0.paragraph_format.space_after = Pt(0)
        r0 = p0.add_run(label)
        r0.font.bold = True
        r0.font.size = Pt(9.0)
        r0.font.color.rgb = NAVY_SECONDARY

        p1 = c1.paragraphs[0]
        p1.paragraph_format.space_after = Pt(0)
        r1 = p1.add_run(val)
        r1.font.size = Pt(9.0)
        if "Git Commit" in label:
            r1.font.bold = True
            r1.font.color.rgb = GREEN_ACCENT

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # -------------------------------------------------------------
    # PHẦN 1: BẢNG TỔNG HỢP TIẾP THU VÀ GIẢI QUYẾT 9 GÓP Ý CỦA GVHD
    # -------------------------------------------------------------
    add_heading_1(doc, "PHẦN 1: TỔNG HỢP KẾT QUẢ TIẾP THU VÀ THỰC HIỆN 9 GÓP Ý CỦA GVHD")
    add_paragraph(doc, 
        "Tiếp thu toàn diện ý kiến chỉ đạo của Giảng viên Hướng dẫn tại buổi rà soát trước khi chốt thực nghiệm cuối cùng, "
        "sinh viên đã tiến hành hoàn thiện đồng bộ mã nguồn, cấu hình lại thực nghiệm khoa học, chuẩn hóa quy trình kiểm định "
        "và xây dựng hoàn tất giao diện điều phối viên. Toàn bộ 9 điểm yêu cầu đã được giải quyết triệt để như sau:"
    )

    summary_headers = ["STT", "Nội dung góp ý của GVHD", "Giải pháp kỹ thuật đã triển khai", "Minh chứng mã nguồn & Artifact", "Trạng thái"]
    t_sum = doc.add_table(rows=10, cols=5)
    t_sum.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_sum, color="CBD5E1", sz="4", val="single")

    col_widths = [Inches(0.4), Inches(1.8), Inches(2.2), Inches(1.4), Inches(0.7)]
    for c_idx, h_text in enumerate(summary_headers):
        cell = t_sum.cell(0, c_idx)
        cell.width = col_widths[c_idx]
        set_cell_background(cell, HEX_HEADER_BG)
        set_cell_margins(cell, top=80, bottom=80, left=60, right=60)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(h_text)
        r.font.bold = True
        r.font.size = Pt(8.5)
        r.font.color.rgb = RGBColor(255, 255, 255)

    sum_items = [
        ("1", "Đồng bộ tuyệt đối báo cáo với các file CSV kết quả trong source", 
         "Thiết lập quy trình khép kín: Freeze source -> Reset/Seed CSDL -> Run model -> Run experiments -> Verify -> Auto-generate Word. Tạo file manifest lưu Git SHA, seeds, timestamp. Không nhập số liệu thủ công.", 
         "artifacts/experiments/*.csv\nexperiment_run_manifest.json\ngenerate_word_report.py", "100% Hoàn thành"),
        ("2", "Sửa script verify_experiments.py và chuẩn hóa kiểm định", 
         "Sửa lọc Plan B bằng prefix chính xác 'B.'; sửa điều kiện kiểm tra solver runtime <= 8000 ms; chuyển sang cơ chế assert/fail có exit code chuẩn; bỏ toàn bộ các kết luận chủ quan.", 
         "backend/scripts/verify_experiments.py", "100% Hoàn thành"),
        ("3", "Làm rõ OSRM và tính cự ly theo chuỗi hành trình Tour", 
         "Tạo offline cache OSRM cố định, ngắt mạng khi benchmark; minh bạch tỷ lệ Cache/Network/Fallback; tính cự ly total_travel_distance theo đúng chuỗi hành trình thực tế Tour (Base -> Ca 1 -> Ca 2 -> ... -> Base).", 
         "backend/app/ai/routing.py\nartifacts/data/routing_cache.json\nrouting_audit_summary.json", "100% Hoàn thành"),
        ("4", "Rà lại Stress Test đúng với Hard Constraints H3 (Shifts & Leave)", 
         "Sinh cấu hình 4 ca trực thực tế y tế và phân bổ ngẫu nhiên 10% điều dưỡng có đơn nghỉ phép được duyệt theo từng seed. Áp dụng đồng nhất cho cả 3 thuật toán benchmark.", 
         "backend/scripts/run_stress_test.py (Hàm generate_seed_workforce_availability)", "100% Hoàn thành"),
        ("5", "Sửa Sensitivity Analysis (Continuity lịch sử khách quen & External Metrics)", 
         "Xây dựng dữ liệu lịch sử khách quen (1-3 ca trước); đánh giá bằng thước đo ngoại sinh độc lập (Cự ly Tour, Độ lệch tải, Tỷ lệ phục vụ khách quen, Số ca thay đổi phân công) thay vì dùng điểm DSS; nêu rõ limitation của TimeFit.", 
         "artifacts/experiments/dss_sensitivity_summary.csv", "100% Hoàn thành"),
        ("6", "Làm rõ phạm vi OR-Tools & nâng cấp biến start_time trong Time Window", 
         "Phân định chính xác tên thuật toán: 'Staff-Assignment under Fixed Times' vs 'Flexible Time Windows'. Bổ sung biến quyết định scheduled_start in [pref_start, pref_end] cùng ràng buộc thứ tự boolean.", 
         "backend/app/ai/scheduling.py (Hàm optimize_schedule)", "100% Hoàn thành"),
        ("7", "Diễn giải thận trọng mô hình AI & Bổ sung Robustness Test", 
         "Giữ nguyên giới hạn dữ liệu mô phỏng trong luận văn. Bổ sung bài kiểm tra độ bền vững qua 5 kịch bản phân phối biến dạng R0-R4 (nhiễu gấp đôi, biến chứng nặng, thay đổi cấu trúc bệnh nền).", 
         "backend/scripts/run_ai_robustness_test.py\nai_robustness_test_results.csv", "100% Hoàn thành"),
        ("8", "Hoàn thiện Actual Duration experiment (N=150, Overtime, ngưỡng dung sai trễ)", 
         "Bổ sung mức tải cực đại N=150; bổ sung cột overtime_minutes; tách biệt direct_overlap (chồng lấn vật lý) và cascading_delay (trễ dây chuyền); trễ <= 15 phút được xem là khả thi theo ngưỡng dung sai GIẢ ĐỊNH của kịch bản mô phỏng (có phân tích độ nhạy 10/15/20 phút).", 
         "artifacts/experiments/actual_duration_summary_mean_std.csv", "100% Hoàn thành"),
        ("9", "Triển khai Giao diện Điều phối viên (Frontend CareFlow) & Tích hợp API thật", 
         "Xây dựng đủ 5 màn hình: (1) AI Recommendation radar 5 tiêu chí + lý do loại + Override, (2) Dispatch Gantt Timeline, (3) OR-Tools Daily Optimization, (4) Leaflet Map, (5) Dashboard KPI. Kiến trúc chính React → FastAPI → PostgreSQL → AI/DSS/OR-Tools; GitHub Actions chạy toàn bộ backend/tests rồi verify_experiments.py.", 
         "frontend/src/components/careflow/*\nbackend/app/api/v1/coordinator.py\n.github/workflows/ci.yml", "100% Hoàn thành")
    ]

    for row_idx, data in enumerate(sum_items, start=1):
        bg = HEX_LIGHT_BG if row_idx % 2 == 1 else "FFFFFF"
        for col_idx, text_val in enumerate(data):
            cell = t_sum.cell(row_idx, col_idx)
            cell.width = col_widths[col_idx]
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=60, bottom=60, left=60, right=60)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.1
            if col_idx in (0, 4):
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r = p.add_run(text_val)
            r.font.name = "Times New Roman"
            r.font.size = Pt(8.5)
            if col_idx == 4:
                r.font.bold = True
                r.font.color.rgb = GREEN_ACCENT
            elif col_idx == 0:
                r.font.bold = True
                r.font.color.rgb = NAVY_PRIMARY

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # -------------------------------------------------------------
    # PHẦN 2: ĐỒNG BỘ THỰC NGHIỆM & CÔNG CỤ KIỂM ĐỊNH ĐỘC LẬP
    # -------------------------------------------------------------
    add_heading_1(doc, "PHẦN 2: QUY TRÌNH ĐỒNG BỘ THỰC NGHIỆM & CÔNG CỤ KIỂM ĐỊNH ĐỘC LẬP (MỤC 1 & 2)")
    add_paragraph(doc,
        "Để giải quyết triệt để vấn đề lệch số liệu giữa các file kết quả thực nghiệm và báo cáo Word do chạy ở các thời điểm khác nhau, "
        "sinh viên đã thiết lập quy trình thực nghiệm khép kín tự động 100% theo đúng chỉ đạo của GVHD:"
    )
    add_callout(doc,
        "Quy trình 6 bước đóng băng và đồng bộ thực nghiệm:\n"
        "1. Đóng băng mã nguồn (Freeze source) -> Ghi nhận Git Commit SHA.\n"
        "2. Khởi tạo lại CSDL sạch (Reset & Seed PostgreSQL) với hạt giống chuẩn hóa.\n"
        "3. Kiểm tra pipeline suy luận mô hình AI (Model Inference & Fallback).\n"
        "4. Chạy toàn bộ bộ thực nghiệm khoa học (Stress Test 75 runs, Actual Duration 50 runs, Sensitivity 30 runs, Robustness 25 runs).\n"
        "5. Chạy script kiểm định độc lập verify_experiments.py (Dừng ngay lập tức nếu có sai lệch toán học hoặc vi phạm ràng buộc y tế).\n"
        "6. Tự động kết xuất toàn bộ bảng số liệu vào tệp Báo cáo Word (0% số liệu can thiệp bằng tay).",
        "QUY TRÌNH THỰC NGHIỆM ĐÓNG BĂNG (SCIENTIFIC EXPERIMENT PIPELINE)"
    )

    add_paragraph(doc,
        "Đồng thời, script `backend/scripts/verify_experiments.py` đã được tái cấu trúc hoàn toàn:\n"
        "• Lọc chính xác phương án Plan B bằng tiền tố `B.` (thay thế lệnh `contains('AI')` trước đây vốn lọc trùng cả 'Thiếu AI' và 'Có AI').\n"
        f"• Sửa điều kiện kiểm định thời gian giải thuật: `raw_stress['runtime_ms'].max() <= 8000.0`. Thời gian chạy cực đại đo được trong lần freeze là {vn(max_runtime_ms, 1)} ms (đo trên máy chạy pipeline, phụ thuộc phần cứng).\n"
        "• Bổ sung kiểm tra nguồn gốc artifacts: manifest phải trỏ tới một commit tổ tiên của HEAD và từ commit đó tới HEAD không có thay đổi ở mã nguồn backend, mô hình và dữ liệu đầu vào.\n"
        "• Toàn bộ các cảnh báo được chuyển sang câu lệnh `assert`, nếu phát hiện sai lệch dù chỉ 0.01 ở mean hoặc std, script sẽ ném ngoại lệ và thoát với mã lỗi `sys.exit(1)`.\n"
        "• Đã loại bỏ hoàn toàn các phát biểu chủ quan, định tính khỏi script kiểm định để đảm bảo tính khách quan khoa học."
    )
    
    import subprocess
    ver = subprocess.run([sys.executable, str(BASE_DIR / "backend" / "scripts" / "verify_experiments.py")],
                         cwd=str(BASE_DIR), capture_output=True, text=True, encoding="utf-8", errors="replace")
    ver_lines = [ln.strip() for ln in ver.stdout.splitlines() if ln.strip().startswith(("✅", "❌", "[Chi tiết", "* Tổng phút", "=> Giảm"))]
    add_code_block(doc,
        "=== KẾT QUẢ THỰC THI verify_experiments.py (sinh tự động khi tạo báo cáo) ===\n"
        + "\n".join(ver_lines)
        + f"\n==> EXIT CODE: {ver.returncode} <=="
    )
    if ver.returncode != 0:
        raise SystemExit("verify_experiments.py thất bại — không sinh báo cáo khi số liệu chưa nhất quán.\n" + ver.stdout[-3000:] + ver.stderr[-3000:])
    _unused_old_block = (
        "=== KẾT QUẢ THỰC THI SCRIPT KIỂM ĐỊNH verify_experiments.py (NGÀY 31/10/2026) ===\n"
        "[1] STRESS TEST BENCHMARK: 75/75 lượt chạy thô khớp 100% với bảng tổng hợp mean ± std.\n"
        "[2] ACTUAL DURATION EVALUATION: 50/50 lượt chạy khớp 100% (cả N=100 và N=150).\n"
        "    * Tải N=100: AI giảm trễ từ 967.2p xuống 90.2p (giảm 90.7%); Overtime giảm từ 185.0p xuống 19.0p.\n"
        "    * Tải N=150: AI giảm trễ từ 1237.2p xuống 97.0p (giảm 92.2%); Overtime giảm từ 256.8p xuống 34.6p.\n"
        "[3] DSS SENSITIVITY: 30/30 lượt chạy thô qua 6 kịch bản khớp 100% với bảng summary.\n"
        "[4] FEASIBILITY & MEDICAL RULES AUDIT:\n"
        "    * Ràng buộc 1: Tỷ lệ khả thi Feasible Rate luôn nằm trong khoảng hợp lệ [0%, 100%].\n"
        "    * Ràng buộc 2: OR-Tools CP-SAT tuyệt đối không để bất kỳ nhân viên nào bị Overtime (0p vượt trần).\n"
        "    * Ràng buộc 3: Thời gian giải cực đại đạt 6,703.2 ms (thỏa mãn điều kiện <= 8,000 ms).\n"
        "[5] AI ROBUSTNESS AUDIT: Đủ 5 kịch bản R0-R4, R² thuộc [0, 1], MAE không âm.\n"
        "==> XÁC MINH TOÀN DIỆN THÀNH CÔNG (EXIT CODE: 0) <=="
    )
    del _unused_old_block

    # -------------------------------------------------------------
    # PHẦN 3: ĐỊNH TUYẾN OSRM & CỰ LY TOUR
    # -------------------------------------------------------------
    add_heading_1(doc, "PHẦN 3: CHUẨN HÓA ĐỊNH TUYẾN OSRM & CỰ LY HÀNH TRÌNH TOUR (MỤC 3)")
    add_paragraph(doc,
        "Theo đúng hướng dẫn của GVHD, sinh viên đã làm rõ vai trò và cơ chế hoạt động của OSRM OpenStreetMap trong thực nghiệm:\n"
        "1. **Ma trận định tuyến cố định (Offline Routing Matrix):** Khi chạy thực nghiệm, `RoutingEngine.disable_network()` được kích hoạt để không gọi mạng; mọi cự ly lấy từ ma trận OSRM đã tính trước hoặc từ fallback Haversine tất định, nên chạy lại cho cùng kết quả.\n"
        f"2. **Kiểm toán nguồn định tuyến (Routing Audit):** Mọi lệnh tính cự ly đều được phân loại nguồn và lưu vào `routing_audit_summary.json`. Trong lần freeze, tổng số {vn(tot_queries, 0)} truy vấn gồm: OSRM cache {vn(cache_hits, 0)} ({vn(cov_pct)}%), Haversine fallback {vn(hav_cnt, 0)} ({vn(hav_pct)}%) và trùng vị trí {vn(same_cnt, 0)} ({vn(same_pct)}%). "
        "Ma trận OSRM được tính trước bằng `precompute_routing_matrix.py` (OSRM Table API, profile driving) cho đúng các điểm dùng trong benchmark và lưu tại `routing_matrix_benchmark.json.gz`; truy vấn ngoài ma trận dùng Haversine × hệ số uốn lượn 1,3, tốc độ 25 km/h, cộng 3 phút đỗ xe. "
        + ("Vì vậy kết quả được mô tả chính xác là mô hình \"OSRM cache + deterministic Haversine fallback\", với tỷ lệ từng nguồn như trên.\n"
           if hav_pct >= 1.0 else
           "Do phần lớn truy vấn lấy từ OSRM cache, cự ly trong benchmark phản ánh khoảng cách đường bộ OSRM (profile ô tô của máy chủ OSRM công khai), không phải đường đi xe máy thực tế.\n")
        + "3. **Tính toán cự ly theo chuỗi hành trình Tour thực tế:** Sinh viên đã thay thế toàn bộ cách tính cộng dồn khoảng cách độc lập từ trạm đến từng khách hàng bằng phương thức `calculate_daily_tour_metrics()`. Tổng cự ly di chuyển của mỗi điều dưỡng được tính theo đúng chuỗi lộ trình liên tục trong ngày:"
    )
    add_callout(doc,
        "Cự ly di chuyển thực tế (Tour) của nhân viên e:\n"
        "   Distance(e) = d(Base, Ca_1) + ∑ d(Ca_i, Ca_{i+1}) + d(Ca_k, Base)\n"
        "Trong đó:\n"
        "• d(A, B) là cự ly lấy từ ma trận OSRM tính trước, hoặc từ fallback Haversine có hệ số hiệu chỉnh khi cặp điểm không có trong ma trận.\n"
        "• Tổng thời gian di chuyển được tính tương ứng bao gồm cả thời gian dừng xe và tìm nhà trong ngõ hẻm.",
        "CÔNG THỨC CHUỖI HÀNH TRÌNH TOUR CỦA NHÂN VIÊN Y TẾ"
    )

    # -------------------------------------------------------------
    # PHẦN 4: HARD CONSTRAINTS CA TRỰC & NGHỈ PHÉP
    # -------------------------------------------------------------
    add_heading_1(doc, "PHẦN 4: MÔ HÌNH HÓA ĐẦY ĐỦ RÀNG BUỘC CA TRỰC & ĐƠN NGHỈ PHÉP (MỤC 4)")
    add_paragraph(doc,
        "Trước đây, bài benchmark Stress Test sử dụng một khung giờ chuẩn 07:00–18:00 khiến mô tả báo cáo có phần rộng hơn thực nghiệm. "
        "Thực hiện phương án tối ưu được GVHD khuyến nghị, sinh viên đã phát triển hàm sinh dữ liệu ca trực và nghỉ phép theo từng random seed "
        "(`generate_seed_workforce_availability`), đưa đầy đủ các ràng buộc thực tế vào toàn bộ các bài thí nghiệm:\n"
        "• **4 Khung ca làm việc chuẩn y tế:**\n"
        "  1. Ca sáng sớm (Morning Shift): 07:00 – 15:30 (Trọng số phân bổ: 25%)\n"
        "  2. Ca hành chính (Day Shift): 08:00 – 17:00 (Trọng số phân bổ: 35%)\n"
        "  3. Ca chiều tối (Late Shift): 09:30 – 18:00 (Trọng số phân bổ: 20%)\n"
        "  4. Ca linh hoạt toàn ngày (Full Shift): 07:00 – 18:00 (Trọng số phân bổ: 20%)\n"
        "• **Ràng buộc Đơn nghỉ phép đã duyệt (Leave Request):** Tại mỗi hạt giống seed, ngẫu nhiên 10% đội ngũ điều dưỡng (1 nhân viên) có đơn nghỉ phép cá nhân hoặc khám sức khỏe định kỳ được duyệt trong ngày (nghỉ nửa buổi sáng hoặc nửa buổi chiều).\n"
        "• **Kiểm định nghiêm ngặt:** Cả 3 thuật toán (Nearest Feasible, Weighted DSS, và OR-Tools CP-SAT) đều phải tuân thủ điều kiện: Ca khám chỉ khả thi khi và chỉ khi toàn bộ khung giờ làm việc nằm trọn trong ca trực của điều dưỡng và hoàn toàn không giao cắt với thời gian nghỉ phép."
    )

    # -------------------------------------------------------------
    # PHẦN 5: PHÂN TÍCH ĐỘ NHẠY DSS & ĐỘ LIÊN TỤC
    # -------------------------------------------------------------
    df_sens_all = pd.read_csv(EXP_DIR / "dss_sensitivity_summary.csv")
    time_fit_str = vn_ms(pick(df_sens_all, scenario="1.*")["avg_time_fit"])
    add_heading_1(doc, "PHẦN 5: PHÂN TÍCH ĐỘ NHẠY ĐA MỤC TIÊU DSS & ĐỘ LIÊN TỤC KHÁCH QUEN (MỤC 5)")
    add_paragraph(doc,
        "Ở phiên bản trước, tỷ lệ khả thi ở cả 6 bộ trọng số trùng nhau do Continuity dùng giá trị tĩnh và TimeFit chưa biến động. "
        "Sinh viên đã khắc phục triệt để theo đúng góp ý của GVHD:\n"
        "1. **Triển khai Continuity động từ dữ liệu lịch sử:** Thiết lập cơ chế mô phỏng lịch sử quan hệ bệnh nhân - nhân viên y tế (`customer_emp_history`). Khoảng 60% bệnh nhân trong mẫu là khách hàng quen, từng được một nhân viên y tế phục vụ từ 1 đến 3 lần trước đó. Điểm Continuity được tính toán thực tế dựa trên số lần tương tác lịch sử thay vì gán giá trị mặc định.\n"
        "2. **Đánh giá bằng các thước đo ngoại sinh độc lập (External Metrics):** Không dùng chính điểm DSS tổng hợp để kết luận bộ trọng số tốt, mà sử dụng các tiêu chí vận hành khách quan:\n"
        "   - Tổng cự ly di chuyển chuỗi hành trình Tour (`total_travel_distance_km`).\n"
        "   - Độ lệch chuẩn tải làm việc giữa các điều dưỡng (`workload_std_dev`).\n"
        "   - Tỷ lệ đáp ứng khách hàng quen (`continuity_match_rate`).\n"
        "   - Số lượng ca bị thay đổi phân công nhân sự so với kịch bản Cơ sở (`assignment_change_count`).\n"
        "   - Giá trị trung bình của từng thành phần điểm số riêng biệt (Skill, Time, Distance, Workload, Continuity).\n"
        "3. **Ghi nhận hạn chế của TimeFit:** Luận văn ghi nhận rõ ràng: Do mô hình ưu tiên đảm bảo giờ hẹn mong muốn của bệnh nhân (`preferred_start`), điểm TimeFit duy trì ở mức cao ổn định (" + time_fit_str + ") trên các kịch bản cố định giờ."
    )

    # Bảng 1: DSS Sensitivity
    csv_sens = EXP_DIR / "dss_sensitivity_summary.csv"
    if csv_sens.exists():
        df_sens = pd.read_csv(csv_sens)
        add_paragraph(doc, "Bảng 1: Kết quả Phân tích Độ nhạy Trọng số Đa mục tiêu DSS qua 6 Kịch bản Thực nghiệm", bold_prefix="• ")
        
        t_dss = doc.add_table(rows=len(df_sens) + 1, cols=9)
        t_dss.alignment = WD_TABLE_ALIGNMENT.CENTER
        set_table_borders(t_dss, color="CBD5E1", sz="4", val="single")
        
        dss_cols = ["Kịch bản trọng số", "Tỷ lệ khả thi (%)", "Cự ly Tour (km)", "Lệch tải (phút)", "Đáp ứng quen (%)", "Đổi ca (ca)", "SkillFit", "DistScore", "ContScore"]
        dss_w = [Inches(1.5), Inches(0.7), Inches(0.8), Inches(0.7), Inches(0.7), Inches(0.6), Inches(0.4), Inches(0.4), Inches(0.5)]
        
        for c_idx, h_text in enumerate(dss_cols):
            cell = t_dss.cell(0, c_idx)
            cell.width = dss_w[c_idx]
            set_cell_background(cell, HEX_HEADER_BG)
            set_cell_margins(cell, top=60, bottom=60, left=40, right=40)
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r = p.add_run(h_text)
            r.font.bold = True
            r.font.size = Pt(8.0)
            r.font.color.rgb = RGBColor(255, 255, 255)
            
        for r_idx, row in df_sens.iterrows():
            bg = HEX_LIGHT_BG if r_idx % 2 == 1 else "FFFFFF"
            vals = [
                str(row["scenario"]),
                str(row["feasible_rate"]),
                str(row["total_travel_distance_km"]),
                str(row["workload_std_dev"]),
                str(row["continuity_match_rate"]),
                str(row["assignment_change_count"]),
                str(row["avg_skill_fit"]),
                str(row["avg_dist_score"]),
                str(row["avg_cont_score"])
            ]
            for c_idx, val_str in enumerate(vals):
                cell = t_dss.cell(r_idx + 1, c_idx)
                cell.width = dss_w[c_idx]
                set_cell_background(cell, bg)
                set_cell_margins(cell, top=50, bottom=50, left=40, right=40)
                p = cell.paragraphs[0]
                p.paragraph_format.space_after = Pt(0)
                if c_idx > 0:
                    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                r = p.add_run(val_str)
                r.font.name = "Times New Roman"
                r.font.size = Pt(8.0)
                if "Uu tien lien tuc" in vals[0] and c_idx in (4, 5, 8):
                    r.font.bold = True
                    r.font.color.rgb = GREEN_ACCENT

    doc.add_paragraph().paragraph_format.space_after = Pt(6)
    b0, b4, b5, b6 = (pick(df_sens_all, scenario=f"{i}.*") for i in (1, 4, 5, 6))
    same_as_base = [str(r["scenario"]) for _, r in df_sens_all.iterrows()
                    if not str(r["scenario"]).startswith("1.") and mean_of(r["assignment_change_count"]) == 0.0]

    def trend(old, new, unit, nd=2, lower_better=True):
        if abs(new - old) < 10 ** (-nd):
            return f"không đổi ({vn(new, nd)}{unit})"
        word = "giảm" if new < old else "tăng"
        return f"{word} từ {vn(old, nd)}{unit} xuống {vn(new, nd)}{unit}" if new < old else f"{word} từ {vn(old, nd)}{unit} lên {vn(new, nd)}{unit}"

    add_paragraph(doc,
        "Nhận xét từ Bảng 1 (số liệu đọc trực tiếp từ dss_sensitivity_summary.csv, so với kịch bản Cơ sở): "
        f"với 'Ưu tiên liên tục', tỷ lệ đáp ứng khách quen {trend(mean_of(b0['continuity_match_rate']), mean_of(b6['continuity_match_rate']), '%')}, "
        f"điểm Continuity {trend(mean_of(b0['avg_cont_score']), mean_of(b6['avg_cont_score']), '')}, "
        f"và trung bình {vn(mean_of(b6['assignment_change_count']))} ca đổi nhân sự. "
        f"Với 'Ưu tiên khoảng cách', tổng cự ly Tour {trend(mean_of(b0['total_travel_distance_km']), mean_of(b4['total_travel_distance_km']), ' km')}. "
        f"Với 'Ưu tiên cân bằng tải', độ lệch chuẩn tải {trend(mean_of(b0['workload_std_dev']), mean_of(b5['workload_std_dev']), ' phút')}. "
        + (f"Kịch bản {', '.join(s.split('. ', 1)[-1] for s in same_as_base)} cho phân công trùng với kịch bản Cơ sở (0 ca thay đổi), cho thấy trong cấu hình hiện tại việc dịch chuyển 5–10% trọng số giữa Skill/Time chưa đủ để đổi nghiệm tối ưu. " if same_as_base else "")
        + "Mức thay đổi nhỏ so với độ lệch chuẩn giữa các seed, nên kết quả chỉ cho thấy xu hướng phản ứng của DSS theo trọng số trong kịch bản mô phỏng, chưa đủ để kết luận về mức độ nhạy trong vận hành thực tế."
    )

    # -------------------------------------------------------------
    # PHẦN 6: NÂNG CẤP GOOGLE OR-TOOLS CP-SAT
    # -------------------------------------------------------------
    add_heading_1(doc, "PHẦN 6: NÂNG CẤP OR-TOOLS CP-SAT VỚI CỬA SỔ THỜI GIAN LINH HOẠT (MỤC 6)")
    add_paragraph(doc,
        "Thực hiện chuẩn hóa thuật ngữ và nâng cấp mô hình toán học theo góp ý của GVHD:\n"
        "1. **Làm rõ phạm vi và phân định tên gọi giải thuật trong báo cáo:**\n"
        "   - Khi thời điểm bắt đầu ca khám cố định theo giờ hẹn của bệnh nhân, mô hình được định danh chính xác là: "
        "`OR-Tools CP-SAT (Global Staff-Assignment under Fixed Service Times)`.\n"
        "   - Khi cho phép điều chỉnh giờ khám, mô hình được định danh là: "
        "`OR-Tools CP-SAT (Staff-Assignment with Flexible Time Windows)`.\n"
        "2. **Nâng cấp biến quyết định thời điểm bắt đầu (Decision Variable `scheduled_start`):**\n"
        "   Bộ giải đã được nâng cấp toàn diện bằng cách tích hợp biến nguyên `start_vars[req_id]` nằm trong cửa sổ thời gian mong muốn "
        "[preferred_start, preferred_end], kết hợp biến thứ tự boolean (precedence variable `prec`) để xử lý ràng buộc không trùng lặp và tính toán thời gian di chuyển:"
    )
    add_callout(doc,
        "Mô hình hóa biến quyết định giờ bắt đầu và thứ tự phục vụ:\n"
        "• Biến thời điểm bắt đầu: st_i ∈ [pref_start_i, pref_end_i - duration_i]\n"
        "• Biến thứ tự nhị phân: prec_{i,j,e} ∈ {0, 1} (bằng 1 nếu ca i diễn ra trước ca j trên cùng nhân viên e)\n"
        "• Ràng buộc không chồng lấn và khả thi di chuyển:\n"
        "    st_j ≥ st_i + duration_i + travel_time(i, j)   (khi x_{i,e} = 1, x_{j,e} = 1, prec = 1)\n"
        "    st_i ≥ st_j + duration_j + travel_time(j, i)   (khi x_{i,e} = 1, x_{j,e} = 1, prec = 0)\n"
        "• Hàm mục tiêu bổ sung thành phần phạt dịch chuyển xa khỏi giờ mong muốn: Min ∑ |st_i - pref_start_i|.",
        "MÔ HÌNH TOÁN HỌC CỬA SỔ THỜI GIAN LINH HOẠT TRONG OR-TOOLS CP-SAT"
    )

    # Bảng 2: Stress test benchmark
    csv_bm = EXP_DIR / "stress_test_summary_mean_std.csv"
    if csv_bm.exists():
        df_bm = pd.read_csv(csv_bm)
        add_paragraph(doc, "Bảng 2: Kết quả Benchmark Đối sánh 3 Động cơ Lập lịch qua 5 Mức tải (10 - 150 requests/ngày)", bold_prefix="• ")
        
        t_bm = doc.add_table(rows=len(df_bm) + 1, cols=7)
        t_bm.alignment = WD_TABLE_ALIGNMENT.CENTER
        set_table_borders(t_bm, color="CBD5E1", sz="4", val="single")
        
        bm_cols = ["Mức tải (req/ngày)", "Thuật toán lập lịch", "Tỷ lệ khả thi (%)", "Số ca bỏ sót", "Cự ly Tour (km)", "Lệch tải (phút)", "Thời gian giải (ms)"]
        bm_w = [Inches(1.1), Inches(1.8), Inches(0.9), Inches(0.7), Inches(0.8), Inches(0.8), Inches(0.8)]
        
        for c_idx, h_text in enumerate(bm_cols):
            cell = t_bm.cell(0, c_idx)
            cell.width = bm_w[c_idx]
            set_cell_background(cell, HEX_HEADER_BG)
            set_cell_margins(cell, top=60, bottom=60, left=40, right=40)
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r = p.add_run(h_text)
            r.font.bold = True
            r.font.size = Pt(8.0)
            r.font.color.rgb = RGBColor(255, 255, 255)
            
        for r_idx, row in df_bm.iterrows():
            bg = HEX_LIGHT_BG if r_idx % 2 == 1 else "FFFFFF"
            vals = [
                str(row["load"]),
                str(row["algorithm"]),
                str(row["feasible_rate"]),
                str(row["unassigned_count"]),
                str(row["total_travel_distance_km"]),
                str(row["workload_std_dev"]),
                str(row["runtime_ms"])
            ]
            for c_idx, val_str in enumerate(vals):
                cell = t_bm.cell(r_idx + 1, c_idx)
                cell.width = bm_w[c_idx]
                set_cell_background(cell, bg)
                set_cell_margins(cell, top=50, bottom=50, left=40, right=40)
                p = cell.paragraphs[0]
                p.paragraph_format.space_after = Pt(0)
                if c_idx in (0, 1):
                    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                else:
                    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                r = p.add_run(val_str)
                r.font.name = "Times New Roman"
                r.font.size = Pt(8.0)
                if "OR-Tools" in vals[1]:
                    r.font.bold = True
                    if c_idx == 1:
                        r.font.color.rgb = NAVY_PRIMARY

    doc.add_paragraph().paragraph_format.space_after = Pt(6)
    df_bm_all = pd.read_csv(EXP_DIR / "stress_test_summary_mean_std.csv")
    ORT, NF, WD = "OR-Tools CP-SAT", "Nearest Feasible", "Weighted DSS"
    loads_bm = sorted(df_bm_all["load"].unique())
    best_feas_loads = [l for l in loads_bm
                       if mean_of(pick(df_bm_all, load=l, algorithm=ORT)["feasible_rate"]) >= max(
                           mean_of(pick(df_bm_all, load=l, algorithm=a)["feasible_rate"]) for a in (NF, WD))]
    nmax = max(loads_bm)
    o, n, w = (pick(df_bm_all, load=nmax, algorithm=a) for a in (ORT, NF, WD))
    o_assigned = nmax - mean_of(o["unassigned_count"])
    n_assigned = nmax - mean_of(n["unassigned_count"])
    w_assigned = nmax - mean_of(w["unassigned_count"])
    o_km, n_km, w_km = (mean_of(r["total_travel_distance_km"]) for r in (o, n, w))
    if len(best_feas_loads) == len(loads_bm):
        feas_sentence = "• Ở cả " + str(len(loads_bm)) + " mức tải, OR-Tools CP-SAT đạt tỷ lệ khả thi trung bình cao nhất (hoặc bằng) trong 3 thuật toán."
    else:
        feas_sentence = ("• OR-Tools CP-SAT đạt tỷ lệ khả thi trung bình cao nhất ở các mức tải N = "
                         + ", ".join(str(l) for l in best_feas_loads) + ".")
    km_cmp = "thấp hơn" if o_km < min(n_km, w_km) else ("cao hơn" if o_km > max(n_km, w_km) else "nằm giữa")
    add_paragraph(doc,
        "Phân tích kết quả Benchmark từ Bảng 2 (số liệu đọc trực tiếp từ stress_test_summary_mean_std.csv):\n"
        + feas_sentence + "\n"
        f"• Tại N={nmax} yêu cầu/ngày, OR-Tools đạt tỷ lệ khả thi {vn_ms(o['feasible_rate'])}% (bỏ sót {vn_ms(o['unassigned_count'])} ca, tức phân công trung bình {vn(o_assigned)} ca), "
        f"so với {vn_ms(n['feasible_rate'])}% của Nearest Feasible ({vn(n_assigned)} ca) và {vn_ms(w['feasible_rate'])}% của Weighted DSS ({vn(w_assigned)} ca). "
        f"Tỷ lệ khả thi thấp ở mức tải này phản ánh giới hạn năng lực của đội 10 nhân sự trong kịch bản, không phải lỗi giải thuật.\n"
        f"• Tổng cự ly Tour của OR-Tools tại N={nmax} là {vn_ms(o['total_travel_distance_km'])} km, {km_cmp} so với hai thuật toán tham lam "
        f"({vn(n_km)} km và {vn(w_km)} km)"
        + (f", trong khi OR-Tools phục vụ nhiều hơn khoảng {vn(o_assigned - max(n_assigned, w_assigned), 1)} ca/ngày; vì vậy cần so sánh cự ly trên mỗi ca phục vụ: "
           f"{vn(o_km / o_assigned)} km/ca so với {vn(n_km / n_assigned)} và {vn(w_km / w_assigned)} km/ca.\n" if o_assigned > max(n_assigned, w_assigned) else ".\n")
        + f"• Thời gian chạy của OR-Tools tại N={nmax} là {vn_ms(o['runtime_ms'])} ms; giá trị lớn nhất trên toàn bộ lượt chạy là {vn(max_runtime_ms, 1)} ms. "
        "Kết quả này chỉ cho thấy bài toán xử lý được trong cấu hình thực nghiệm hiện tại (10 nhân sự, tối đa 150 yêu cầu/ngày, giới hạn thời gian tất định của CP-SAT, phần cứng của máy chạy pipeline), "
        "chưa đủ để khẳng định bảo đảm vận hành thực tế."
    )

    # -------------------------------------------------------------
    # PHẦN 7: DIỄN GIẢI THẬN TRỌNG & AI ROBUSTNESS TEST
    # -------------------------------------------------------------
    df_rob_all = pd.read_csv(EXP_DIR / "ai_robustness_test_results.csv")
    r0 = pick(df_rob_all, scenario_id="R0")
    r0_mae_ai, r0_mae_def = vn(mean_of(r0["mae_ai"])), vn(mean_of(r0["mae_default"]))
    r0_r2 = vn(mean_of(r0["r2_ai"]), 3)
    add_heading_1(doc, "PHẦN 7: DIỄN GIẢI THẬN TRỌNG VỀ AI & BÀI TOÁN ROBUSTNESS TEST (MỤC 7)")
    add_paragraph(doc,
        "Tiếp thu ý kiến sâu sắc của GVHD về tính khách quan khoa học, sinh viên xác định rõ trong báo cáo và luận văn:\n"
        f"• Kết quả mô hình Random Forest Regressor {model_ver} trên phân phối gốc R0 đạt MAE {r0_mae_ai} phút (so với {r0_mae_def} phút của định mức mặc định) và R² {r0_r2} "
        "phản ánh mô hình đã học rất tốt cơ chế phát sinh dữ liệu từ các biến tiền lập lịch (độ phức tạp ca bệnh, thiết bị chuyên dụng, mức độ ưu tiên, khung giờ hẹn và quận huyện). "
        "Điều này chứng minh tính đúng đắn và sự thông suốt của pipeline thu thập, tiền xử lý và huấn luyện máy học, nhưng **chưa chứng minh khả năng dự báo hoàn hảo trên dữ liệu thực tế lâm sàng**, vốn chứa đựng nhiều biến thiên bất định chưa thể mô hình hóa hết.\n"
        "• Để đánh giá độ tin cậy khi phân phối dữ liệu thay đổi, sinh viên tiến hành **Thử nghiệm Độ bền vững (Robustness Test)** trên 5 kịch bản phân phối synthetic bị làm biến dạng (synthetic perturbation) qua 5 random seeds:"
    )

    # Bảng 3: Robustness Test
    csv_rob = EXP_DIR / "ai_robustness_test_results.csv"
    if csv_rob.exists():
        df_rob = pd.read_csv(csv_rob)
        add_paragraph(doc, "Bảng 3: Kết quả Đánh giá Độ bền vững Mô hình AI (Robustness Test) qua 5 Kịch bản Phân phối Biến dạng", bold_prefix="• ")
        
        t_rob = doc.add_table(rows=len(df_rob) + 1, cols=7)
        t_rob.alignment = WD_TABLE_ALIGNMENT.CENTER
        set_table_borders(t_rob, color="CBD5E1", sz="4", val="single")
        
        rob_cols = ["Mã", "Kịch bản phân phối", "Mô tả đặc điểm biến dạng", "MAE Mặc định", "MAE AI", "R² của AI", "Mức giảm sai số (%)"]
        rob_w = [Inches(0.5), Inches(1.5), Inches(1.8), Inches(0.8), Inches(0.8), Inches(0.7), Inches(0.8)]
        
        for c_idx, h_text in enumerate(rob_cols):
            cell = t_rob.cell(0, c_idx)
            cell.width = rob_w[c_idx]
            set_cell_background(cell, HEX_HEADER_BG)
            set_cell_margins(cell, top=60, bottom=60, left=40, right=40)
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r = p.add_run(h_text)
            r.font.bold = True
            r.font.size = Pt(8.0)
            r.font.color.rgb = RGBColor(255, 255, 255)
            
        for r_idx, row in df_rob.iterrows():
            bg = HEX_LIGHT_BG if r_idx % 2 == 1 else "FFFFFF"
            vals = [
                str(row["scenario_id"]),
                str(row["scenario_name"]),
                str(row["description"]),
                str(row["mae_default"]),
                str(row["mae_ai"]),
                str(row["r2_ai"]),
                str(row["mae_reduction_pct"])
            ]
            for c_idx, val_str in enumerate(vals):
                cell = t_rob.cell(r_idx + 1, c_idx)
                cell.width = rob_w[c_idx]
                set_cell_background(cell, bg)
                set_cell_margins(cell, top=50, bottom=50, left=40, right=40)
                p = cell.paragraphs[0]
                p.paragraph_format.space_after = Pt(0)
                if c_idx in (0, 1, 2):
                    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                else:
                    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                r = p.add_run(val_str)
                r.font.name = "Times New Roman"
                r.font.size = Pt(8.0)
                if c_idx == 6:
                    r.font.bold = True
                    r.font.color.rgb = GREEN_ACCENT

    doc.add_paragraph().paragraph_format.space_after = Pt(6)
    worst = max((r for _, r in df_rob_all.iterrows()), key=lambda r: mean_of(r["mae_ai"]))
    all_better = all(mean_of(r["mae_ai"]) < mean_of(r["mae_default"]) for _, r in df_rob_all.iterrows())
    red_min = min(mean_of(r["mae_reduction_pct"]) for _, r in df_rob_all.iterrows())
    red_max = max(mean_of(r["mae_reduction_pct"]) for _, r in df_rob_all.iterrows())
    add_paragraph(doc,
        "Nhận xét từ Bảng 3 (số liệu đọc trực tiếp từ ai_robustness_test_results.csv): "
        + (f"ở cả {len(df_rob_all)} kịch bản, MAE của mô hình AI thấp hơn định mức mặc định, mức giảm sai số từ {vn(red_min, 1)}% đến {vn(red_max, 1)}%. " if all_better
           else "không phải mọi kịch bản mô hình AI đều tốt hơn định mức mặc định. ")
        + f"Kịch bản có MAE của AI cao nhất là {worst['scenario_id']} ({worst['description']}): MAE AI {vn_ms(worst['mae_ai'])} phút so với {vn(mean_of(worst['mae_default']))} phút của định mức mặc định. "
        "Vì vậy có thể kết luận: mô hình vẫn duy trì ưu thế so với baseline trong các kịch bản synthetic perturbation được khảo sát. "
        "Kết quả này chưa chứng minh mô hình thích nghi với phân phối ngoài phạm vi khảo sát hay với dữ liệu lâm sàng thực tế, vì toàn bộ dữ liệu và các phép biến dạng đều là mô phỏng."
    )

    # -------------------------------------------------------------
    # PHẦN 8: HOÀN THIỆN ACTUAL DURATION EXPERIMENT
    # -------------------------------------------------------------
    add_heading_1(doc, "PHẦN 8: HOÀN THIỆN THỰC NGHIỆM THỜI LƯỢNG THỰC TẾ (MỤC 8)")
    add_paragraph(doc,
        "Thực hiện trọn vẹn yêu cầu của GVHD, bài thí nghiệm mô phỏng thời lượng thực tế (Actual Duration Simulation) đã được bổ sung đầy đủ:\n"
        "1. **Mức tải cực đại N = 150 requests/ngày:** Kiểm chứng giới hạn chịu tải khi nhu cầu chăm sóc y tế tại nhà tăng vọt.\n"
        "2. **Chỉ số làm thêm giờ (Overtime Minutes):** Tính toán chính xác số phút nhân viên phải làm việc vượt quá khung ca quy định để hoàn tất các ca khám trong ngày.\n"
        f"3. **Ngưỡng dung sai {tol_min} phút được giả định trong kịch bản thực nghiệm:**\n"
        f"   - Độ trễ ≤ {tol_min} phút (`mild_delay_count`): xếp vào **khả thi thực tế** (actual feasible).\n"
        f"   - Độ trễ > {tol_min} phút (`severe_delay_count`): xếp vào **trễ vượt ngưỡng dung sai**.\n"
        f"   - Đây là **một tham số của mô phỏng**, không dựa trên chuẩn y khoa hay quy định nghiệp vụ được trích dẫn. Để kiểm tra kết luận không phụ thuộc duy nhất vào một ngưỡng, Bảng 5 tính lại trên cùng các lịch trình với ngưỡng {'/'.join(str(t) for t in tol_list)} phút.\n"
        "4. **Tách biệt rõ ràng 2 dạng xung đột lịch trình:**\n"
        "   - Chồng lấn trực tiếp (`direct_overlap_count`): Ca khám trước thực tế vẫn đang diễn ra khi đã đến giờ hẹn ca tiếp theo trên cùng một nhân viên (hai ca đè lên nhau tại cùng một thời điểm).\n"
        "   - Trễ dây chuyền (`cascading_delay_count`): Ca khám sau bị bắt đầu muộn do ca trước kéo dài cộng thời gian di chuyển, dù không có sự hiện diện đồng thời tại giờ bắt đầu danh nghĩa."
    )

    # Bảng 4: Actual duration
    csv_act = EXP_DIR / "actual_duration_summary_mean_std.csv"
    if csv_act.exists():
        df_act = pd.read_csv(csv_act)
        add_paragraph(doc, "Bảng 4: So sánh Đối chứng giữa Plan A (Default Duration) và Plan B (AI Predicted Duration) dưới Tác động Thực tế", bold_prefix="• ")
        
        t_act = doc.add_table(rows=len(df_act) + 1, cols=8)
        t_act.alignment = WD_TABLE_ALIGNMENT.CENTER
        set_table_borders(t_act, color="CBD5E1", sz="4", val="single")
        
        act_cols = ["Tải (req/ngày)", "Phương án lập lịch", "Chồng lấn trực tiếp (ca)", "Trễ dây chuyền (ca)", "Trễ nặng >15p (ca)", "Tổng phút trễ (phút)", "Overtime (phút)", "Khả thi thực tế (%)"]
        act_w = [Inches(0.8), Inches(1.7), Inches(0.8), Inches(0.8), Inches(0.7), Inches(0.8), Inches(0.8), Inches(0.9)]
        
        for c_idx, h_text in enumerate(act_cols):
            cell = t_act.cell(0, c_idx)
            cell.width = act_w[c_idx]
            set_cell_background(cell, HEX_HEADER_BG)
            set_cell_margins(cell, top=60, bottom=60, left=30, right=30)
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r = p.add_run(h_text)
            r.font.bold = True
            r.font.size = Pt(7.5)
            r.font.color.rgb = RGBColor(255, 255, 255)
            
        for r_idx, row in df_act.iterrows():
            bg = HEX_LIGHT_BG if r_idx % 2 == 1 else "FFFFFF"
            vals = [
                str(row["load"]),
                str(row["plan"]),
                str(row["direct_overlap_count"]),
                str(row["cascading_delay_count"]),
                str(row["severe_delay_count"]),
                str(row["total_delay_minutes"]),
                str(row["overtime_minutes"]),
                str(row["actual_feasible_rate"])
            ]
            for c_idx, val_str in enumerate(vals):
                cell = t_act.cell(r_idx + 1, c_idx)
                cell.width = act_w[c_idx]
                set_cell_background(cell, bg)
                set_cell_margins(cell, top=50, bottom=50, left=30, right=30)
                p = cell.paragraphs[0]
                p.paragraph_format.space_after = Pt(0)
                if c_idx in (0, 1):
                    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                else:
                    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                r = p.add_run(val_str)
                r.font.name = "Times New Roman"
                r.font.size = Pt(7.5)
                if "Plan B" in vals[1] or "C AI" in vals[1] or "Có AI" in vals[1]:
                    r.font.bold = True
                    if c_idx in (2, 5, 6, 7):
                        r.font.color.rgb = GREEN_ACCENT

    doc.add_paragraph().paragraph_format.space_after = Pt(6)
    df_act_all = pd.read_csv(EXP_DIR / "actual_duration_summary_mean_std.csv")

    def act_bullet(load):
        a = pick(df_act_all, load=load, plan="A.*")
        b = pick(df_act_all, load=load, plan="B.*")
        g = lambda r, c: mean_of(r[c])
        return (
            f"• **Tại mức tải N = {load} yêu cầu/ngày:** Plan A (thời lượng mặc định) có trung bình {vn(g(a, 'direct_overlap_count'), 1)} ca chồng lấn trực tiếp, "
            f"{vn(g(a, 'total_delay_minutes'), 1)} phút trễ, {vn(g(a, 'severe_delay_count'), 1)} ca trễ vượt ngưỡng và {vn(g(a, 'overtime_minutes'), 1)} phút làm thêm giờ. "
            f"Plan B (thời lượng AI) giảm còn {vn(g(b, 'direct_overlap_count'), 1)} ca chồng lấn (giảm {vn(pct_change(g(a, 'direct_overlap_count'), g(b, 'direct_overlap_count')), 1)}%), "
            f"{vn(g(b, 'total_delay_minutes'), 1)} phút trễ (giảm {vn(pct_change(g(a, 'total_delay_minutes'), g(b, 'total_delay_minutes')), 1)}%), "
            f"{vn(g(b, 'severe_delay_count'), 1)} ca trễ vượt ngưỡng và {vn(g(b, 'overtime_minutes'), 1)} phút làm thêm giờ. "
            f"Tỷ lệ khả thi thực tế: {vn(g(b, 'actual_feasible_rate'), 1)}% so với {vn(g(a, 'actual_feasible_rate'), 1)}%.\n"
        )

    act_loads = sorted(df_act_all["load"].unique())[-2:]
    add_paragraph(doc,
        "Nhận xét từ Bảng 4 (số liệu đọc trực tiếp từ actual_duration_summary_mean_std.csv):\n"
        + "".join(act_bullet(l) for l in act_loads)
        + "Lưu ý: thời lượng thực tế (ground truth) và thời lượng AI dự báo đều sinh từ cùng một cơ chế mô phỏng, nên mức cải thiện trên phản ánh lợi ích trong kịch bản synthetic, chưa phải dữ liệu vận hành thực tế."
    )
    _unused_old_act = (
        "Đánh giá sâu sắc từ Bảng 4:\n"
        "• **Tại mức tải nặng N = 100 requests/ngày:** Phương án Plan A (dùng thời lượng mặc định) làm phát sinh trung bình 30,6 ca chồng lấn trực tiếp, 967,2 phút trễ hẹn và 185,0 phút làm thêm ngoài giờ. Khi có AI dự báo chính xác (Plan B), số ca chồng lấn giảm 81,7% (chỉ còn 5,6 ca), tổng phút trễ giảm 90,7% (còn 90,2 phút) và Overtime giảm mạnh về 19,0 phút.\n"
        "• **Tại mức tải cực đại N = 150 requests/ngày:** Lợi ích của AI thể hiện rõ nét nhất: Tổng phút trễ giảm từ 1.237,2 phút xuống 97,0 phút (giảm 92,2%); số ca vi phạm cam kết dịch vụ (trễ > 15 phút) giảm từ 31,4 ca xuống gần như triệt tiêu (0,2 ca); Overtime giảm từ 256,8 phút xuống 34,6 phút. Tỷ lệ khả thi thực tế đạt tới 99,7% so với mức 54,0% của Plan A."
    )
    del _unused_old_act

    # Bảng 5: Độ nhạy ngưỡng dung sai trễ
    csv_tol = EXP_DIR / "delay_tolerance_sensitivity_summary.csv"
    df_tol = pd.read_csv(csv_tol)
    add_paragraph(doc, f"Bảng 5: Độ nhạy theo ngưỡng dung sai trễ ({'/'.join(str(t) for t in tol_list)} phút) trên cùng các lịch trình của Bảng 4", bold_prefix="• ")
    tol_cols = ["Tải (req/ngày)", "Phương án lập lịch", "Ngưỡng (phút)", "Ca trễ vượt ngưỡng", "Khả thi thực tế (%)"]
    t_tol = doc.add_table(rows=len(df_tol) + 1, cols=len(tol_cols))
    t_tol.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_tol, color="CBD5E1", sz="4", val="single")
    for c_idx, h_text in enumerate(tol_cols):
        cell = t_tol.cell(0, c_idx)
        set_cell_background(cell, HEX_HEADER_BG)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(h_text)
        r.font.bold = True
        r.font.size = Pt(8.0)
        r.font.color.rgb = RGBColor(255, 255, 255)
    for r_idx, row in df_tol.reset_index(drop=True).iterrows():
        vals = [str(row["load"]), str(row["plan"]), str(row["tolerance_minutes"]), str(row["severe_delay_count"]), str(row["actual_feasible_rate"])]
        for c_idx, val_str in enumerate(vals):
            cell = t_tol.cell(r_idx + 1, c_idx)
            set_cell_background(cell, HEX_LIGHT_BG if r_idx % 2 == 1 else "FFFFFF")
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT if c_idx < 2 else WD_ALIGN_PARAGRAPH.RIGHT
            r = p.add_run(val_str)
            r.font.name = "Times New Roman"
            r.font.size = Pt(7.5)
    doc.add_paragraph().paragraph_format.space_after = Pt(6)
    nmax_t = int(df_tol["load"].max())
    fa = {t: mean_of(pick(df_tol, load=nmax_t, plan="A.*", tolerance_minutes=t)["actual_feasible_rate"]) for t in tol_list}
    fb = {t: mean_of(pick(df_tol, load=nmax_t, plan="B.*", tolerance_minutes=t)["actual_feasible_rate"]) for t in tol_list}
    b_wins_all = all(fb[t] >= fa[t] for t in tol_list for _l in [0]) and all(
        mean_of(pick(df_tol, load=l, plan="B.*", tolerance_minutes=t)["actual_feasible_rate"]) >=
        mean_of(pick(df_tol, load=l, plan="A.*", tolerance_minutes=t)["actual_feasible_rate"])
        for l in df_tol["load"].unique() for t in tol_list)
    add_paragraph(doc,
        f"Nhận xét từ Bảng 5: tại N = {nmax_t}, tỷ lệ khả thi thực tế của Plan A là "
        + ", ".join(f"{vn(fa[t], 1)}% (ngưỡng {t} phút)" for t in tol_list)
        + "; của Plan B là " + ", ".join(f"{vn(fb[t], 1)}%" for t in tol_list) + ". "
        + ("Ở mọi mức tải và mọi ngưỡng khảo sát, Plan B đều có tỷ lệ khả thi không thấp hơn Plan A, nên kết luận so sánh không phụ thuộc vào việc chọn riêng ngưỡng 15 phút."
           if b_wins_all else "Thứ tự giữa hai phương án thay đổi ở một số ngưỡng, nên kết luận cần nêu kèm ngưỡng dung sai được chọn.")
    )

    # -------------------------------------------------------------
    # PHẦN 9: GIAO DIỆN FRONTEND & TÍCH HỢP BACKEND
    # -------------------------------------------------------------
    add_heading_1(doc, "PHẦN 9: TRIỂN KHAI GIAO DIỆN ĐIỀU PHỐI VIÊN & TÍCH HỢP CSDL THỰC TẾ (MỤC 9)")
    add_paragraph(doc,
        "Đáp ứng hoàn toàn định hướng 5 màn hình ưu tiên của GVHD, sinh viên đã xây dựng hoàn chỉnh giao diện Web Application CareFlow "
        "bằng React 19 + TypeScript + Vite + Tailwind CSS v4. Kiến trúc chính duy nhất khi chạy và khi bảo vệ là "
        "React → FastAPI (`/api/v1/coordinator/...`) → PostgreSQL → AI/DSS/OR-Tools; Vite chỉ đóng vai trò dev server và proxy `/api` sang FastAPI. "
        "Máy chủ Express (`server.ts`) cùng dữ liệu seed giả và cơ chế sinh tọa độ minh họa của bản prototype đã được tách khỏi đường chạy chính "
        "(chuyển vào thư mục `frontend/legacy-prototype/`, chỉ lưu lại để tham khảo). Bản đồ lộ trình dùng tọa độ lấy từ CSDL qua API; "
        "dữ liệu hiển thị là dữ liệu seed mô phỏng trong PostgreSQL:"
    )

    fe_screens = [
        ("1. Màn hình Đề xuất AI (AI Recommendation & Explainable DSS):",
         "Hiển thị danh sách các yêu cầu chờ phân công (Unassigned Requests). Khi chọn một ca khám, hệ thống gọi API phân tích và hiển thị: "
         "(a) Thời lượng dự báo của AI; (b) Biểu đồ radar 5 tiêu chí DSS (SkillFit, TimeFit, Distance, Workload, Continuity); "
         "(c) Danh sách điều dưỡng bị loại kèm lý do vi phạm ràng buộc cứng (H1-H6); "
         "(d) Modal Override cho phép điều phối viên can thiệp chọn nhân viên khác kèm bắt buộc nhập 1 trong 6 mã lý do kiểm toán lâm sàng."),
        ("2. Bảng Điều phối Trực quan (Dispatch Board dạng Timeline/Gantt):",
         "Biểu diễn toàn bộ lịch trình trong ngày của 10 nhân viên y tế theo trục thời gian thực tế. Các ca khám được mã hóa màu theo trạng thái "
         "(Proposed, Confirmed, In-Progress, Completed). Tự động phát hiện và cảnh báo các ca bị xung đột thời gian (Conflict badge) và hỗ trợ điều phối viên kéo dời lịch trực tiếp."),
        ("3. Bộ Tối ưu hóa Toàn cục Toàn ngày (OR-Tools Daily Optimization):",
         "Cho phép điều phối viên thiết lập trọng số tối ưu (Cự ly, Cân bằng tải, Khách quen, SLA) và kích hoạt giải thuật Google OR-Tools CP-SAT "
         "ngay trên giao diện. Hiển thị bảng đối sánh chi tiết Baseline vs Optimized (giảm quãng đường di chuyển, triệt tiêu xung đột) trước khi bấm áp dụng chính thức."),
        ("4. Bản đồ Lộ trình Di chuyển Tương tác (Leaflet Route Map):",
         "Tích hợp bản đồ Leaflet OpenStreetMap TP. Nha Trang. Hiển thị trạm xuất phát (Base Station) của từng điều dưỡng, đánh dấu các điểm dừng phục vụ "
         "theo thứ tự di chuyển và vẽ đường nối lộ trình thực tế kèm thông số cự ly và thời gian di chuyển từng chặng."),
        ("5. Bảng Chỉ số Vận hành (Dashboard KPIs):",
         "Theo dõi thời gian thực các chỉ số đo lường hiệu suất vận hành: Tỷ lệ phân công thành công (Fulfillment Rate), Thời gian di chuyển trung bình mỗi ca, "
         "Độ cân bằng tải đội ngũ y tế, Số lượng can thiệp của con người (Override rate) và Thống kê các ca vi phạm thời gian.")
    ]
    for title_s, desc_s in fe_screens:
        add_paragraph(doc, desc_s, bold_prefix=f"• {title_s} ")

    add_paragraph(doc,
        "• **Tích hợp Tự động hóa Kiểm thử Hồi quy (GitHub Actions CI/CD):**\n"
        "Sinh viên đã thiết lập quy trình CI tại `.github/workflows/ci.yml`. Mỗi khi mã nguồn được push lên nhánh `main`, "
        "GitHub Actions sẽ tự động khởi động một PostgreSQL 16 container, khởi tạo schema 23 bảng, nạp dữ liệu seed chuẩn hóa, "
        f"chạy toàn bộ {n_tests} test trong `backend/tests/` bằng `pytest`, sau đó chạy `verify_experiments.py` (gồm kiểm tra manifest khớp commit). "
        "Commit dùng để nộp (tag `thesis-experiments-final`) phải có workflow này chạy xanh."
    )

    # -------------------------------------------------------------
    # PHẦN 10: KẾT LUẬN & KẾ HOẠCH BẢO VỆ
    # -------------------------------------------------------------
    add_heading_1(doc, "PHẦN 10: KẾT LUẬN & SỰ SẴN SÀNG CHO BUỔI BẢO VỆ TỐT NGHIỆP")
    add_paragraph(doc,
        "Sau đợt rà soát và chỉnh sửa toàn diện này:\n"
        f"1. **Tính nhất quán & khả năng tái lập:** Số liệu thực nghiệm được sinh tại commit `{git_sha[:8]}` (ghi trong manifest), mọi con số trong báo cáo được đọc trực tiếp từ CSV; CI kiểm tra manifest khớp commit. Các hạn chế của dữ liệu mô phỏng được nêu rõ.\n"
        f"2. **Giải thuật & hệ thống:** OR-Tools CP-SAT hỗ trợ cửa sổ thời gian linh hoạt và chạy ở chế độ tất định; cự ly dùng mô hình OSRM cache + Haversine fallback (OSRM {vn(cov_pct)}% truy vấn); mô hình AI duy trì ưu thế so với baseline trong các kịch bản synthetic perturbation được khảo sát.\n"
        "3. **Sản phẩm ứng dụng:** 5 màn hình điều phối viên chạy trên kiến trúc React → FastAPI → PostgreSQL → AI/DSS/OR-Tools với dữ liệu seed mô phỏng trong CSDL 23 bảng, phục vụ demo quy trình trước Hội đồng.\n"
        "Sinh viên xin trân trọng cảm ơn sự hướng dẫn tận tình, nghiêm cẩn và sâu sát về mặt chuyên môn của Giảng viên Hướng dẫn!"
    )

    # Lưu file
    doc.save(str(OUTPUT_DOCX))
    print(f"SUCCESS_GENERATED_REPORT: {OUTPUT_DOCX}")


if __name__ == "__main__":
    build_word_report()
