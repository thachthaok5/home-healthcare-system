"""
Script: generate_word_report.py
Mục đích:
- Tự động tạo file Word Báo cáo tiến độ Đợt 2 chuyên nghiệp, chuẩn học thuật cho sinh viên Nguyễn Thạch Thảo.
- Tuân thủ nghiêm ngặt cấu trúc yêu cầu của GVHD tại Mục 5 và Mục 6 trong `Thao_HuongDan_TienDo_Dot2.docx`.
- Tự động nhúng hình ảnh sơ đồ ERD v2.1, sơ đồ Activity Diagram và các bảng số liệu thực nghiệm (Benchmark, Ablation Study).
"""

import os
import sys
from pathlib import Path

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

BASE_DIR = Path("D:/New folder/DOAN")
OUTPUT_DOCX = BASE_DIR / "docs" / "Bao_cao_Tien_do_Dot_2_Nguyen_Thach_Thao.docx"
IMG_ERD = BASE_DIR / "docs" / "diagrams" / "images" / "ERD_Home_Healthcare_MIS_v2.drawio.png"
IMG_ACTIVITY = BASE_DIR / "docs" / "diagrams" / "images" / "Activity_Diagram_Home_Healthcare_MIS.drawio.png"

# Màu sắc chủ đạo (Navy Theme sang trọng, học thuật)
NAVY_PRIMARY = RGBColor(27, 54, 93)     # #1B365D - Xanh navy đậm
NAVY_SECONDARY = RGBColor(43, 84, 126)  # #2B547E - Xanh navy vừa
GRAY_TEXT = RGBColor(80, 80, 80)        # #505050 - Xám đậm
HEX_PRIMARY = "1B365D"
HEX_SECONDARY = "2B547E"
HEX_LIGHT_BG = "F4F6F9"
HEX_BORDER = "D3D3D3"
HEX_CALLOUT_BG = "F8F9FA"


def set_cell_background(cell, hex_color):
    """Thiết lập màu nền cho ô trong bảng"""
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    cell._tc.get_or_add_tcPr().append(shd)


def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Thiết lập lề trong của ô (padding)"""
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
    """Thiết lập đường viền bảng nhẹ nhàng, tinh tế"""
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
    """Thêm một hộp ghi chú / nhấn mạnh học thuật"""
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    
    cell = tbl.cell(0, 0)
    cell.width = Inches(6.3)
    set_cell_background(cell, HEX_CALLOUT_BG)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=150)
    
    # Border trái đậm màu Navy, các cạnh khác none
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
        run_title.font.size = Pt(11)
        run_title.font.bold = True
        run_title.font.color.rgb = NAVY_PRIMARY
        
    run_text = p.add_run(text)
    run_text.font.name = "Times New Roman"
    run_text.font.size = Pt(10.5)
    run_text.font.italic = True
    run_text.font.color.rgb = RGBColor(40, 40, 40)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)


def add_code_block(doc, code_text):
    """Thêm khung hiển thị kết quả terminal / unit tests"""
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    cell.width = Inches(6.3)
    set_cell_background(cell, "F2F2F2")
    set_cell_margins(cell, top=100, bottom=100, left=150, right=150)
    
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:left w:val="single" w:sz="6" w:space="0" w:color="B0B0B0"/>'
        f'<w:top w:val="single" w:sz="6" w:space="0" w:color="B0B0B0"/>'
        f'<w:bottom w:val="single" w:sz="6" w:space="0" w:color="B0B0B0"/>'
        f'<w:right w:val="single" w:sz="6" w:space="0" w:color="B0B0B0"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.05
    run = p.add_run(code_text.strip())
    run.font.name = "Consolas"
    run.font.size = Pt(9.0)
    run.font.color.rgb = RGBColor(30, 30, 30)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)


def build_word_report():
    doc = docx.Document()
    
    # 1. Cấu hình lề trang (A4 chuẩn: Top 2cm, Bottom 2cm, Left 2.5cm, Right 2cm)
    for section in doc.sections:
        section.top_margin = Inches(0.79)     # 2.0 cm
        section.bottom_margin = Inches(0.79)  # 2.0 cm
        section.left_margin = Inches(1.0)     # 2.54 cm
        section.right_margin = Inches(0.79)   # 2.0 cm
        
        # Header & Footer
        header = section.header
        p_hdr = header.paragraphs[0]
        p_hdr.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        p_hdr.paragraph_format.space_after = Pt(4)
        run_hdr = p_hdr.add_run("Đồ án tốt nghiệp MIS — Báo cáo tiến độ Đợt 2 | SV: Nguyễn Thạch Thảo")
        run_hdr.font.name = "Times New Roman"
        run_hdr.font.size = Pt(8.5)
        run_hdr.font.color.rgb = RGBColor(128, 128, 128)
        
        footer = section.footer
        p_ftr = footer.paragraphs[0]
        p_ftr.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run_ftr = p_ftr.add_run("— Trang cá nhân bảo vệ tiến độ —")
        run_ftr.font.name = "Times New Roman"
        run_ftr.font.size = Pt(8.5)
        run_ftr.font.italic = True
        run_ftr.font.color.rgb = RGBColor(128, 128, 128)

    # 2. Thiết lập định dạng mặc định (Normal)
    style_normal = doc.styles["Normal"]
    font = style_normal.font
    font.name = "Times New Roman"
    font.size = Pt(11.5)
    font.color.rgb = RGBColor(30, 30, 30)
    style_normal.paragraph_format.line_spacing = 1.15
    style_normal.paragraph_format.space_after = Pt(6)
    style_normal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

    # ==========================================
    # TRANG TIÊU ĐỀ BÁO CÁO (HEADER BANNER)
    # ==========================================
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
    p_line.paragraph_format.space_after = Pt(14)
    r_line = p_line.add_run("━━━━━━━ ★ ━━━━━━━")
    r_line.font.color.rgb = NAVY_PRIMARY

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(6)
    p_title.paragraph_format.space_after = Pt(8)
    r_t1 = p_title.add_run("BÁO CÁO TIẾN ĐỘ THỰC HIỆN ĐỒ ÁN TỐT NGHIỆP\n")
    r_t1.font.name = "Times New Roman"
    r_t1.font.size = Pt(18)
    r_t1.font.bold = True
    r_t1.font.color.rgb = NAVY_PRIMARY
    
    r_t2 = p_title.add_run("ĐỢT 2: HOÀN THIỆN CSDL, BACKEND, MÔ HÌNH AI & LẬP LỊCH TỐI ƯU TOÀN CỤC\n")
    r_t2.font.name = "Times New Roman"
    r_t2.font.size = Pt(13)
    r_t2.font.bold = True
    r_t2.font.color.rgb = NAVY_SECONDARY

    # Khung tóm tắt thông tin tác giả và đề tài
    info_table = doc.add_table(rows=4, cols=2)
    info_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(info_table, color="B0C4DE", sz="6", val="single")
    info_data = [
        ("Tên đề tài:", "Nghiên cứu và thiết kế hệ thống thông tin quản lý dịch vụ chăm sóc sức khỏe tại nhà tích hợp AI hỗ trợ lập lịch và điều phối nhân sự y tế"),
        ("Sinh viên thực hiện:", "Nguyễn Thạch Thảo  —  Lớp: 65.TTQL_1 (Chuyên ngành MIS)"),
        ("Kính gửi:", "Giảng viên Hướng dẫn Đồ án tốt nghiệp"),
        ("Mã nguồn & Repository:", "https://github.com/thachthaok5/home-healthcare-system  (Nhánh: main)")
    ]
    for idx, (label, val) in enumerate(info_data):
        c0 = info_table.cell(idx, 0)
        c1 = info_table.cell(idx, 1)
        c0.width = Inches(2.0)
        c1.width = Inches(4.3)
        set_cell_background(c0, HEX_LIGHT_BG)
        set_cell_background(c1, "FFFFFF")
        set_cell_margins(c0, top=70, bottom=70, left=120, right=100)
        set_cell_margins(c1, top=70, bottom=70, left=120, right=100)
        
        p0 = c0.paragraphs[0]
        p0.paragraph_format.space_after = Pt(0)
        r0 = p0.add_run(label)
        r0.font.bold = True
        r0.font.size = Pt(10.5)
        r0.font.color.rgb = NAVY_PRIMARY
        
        p1 = c1.paragraphs[0]
        p1.paragraph_format.space_after = Pt(0)
        r1 = p1.add_run(val)
        r1.font.size = Pt(10.5)
        if "http" in val:
            r1.font.bold = True
            r1.font.color.rgb = RGBColor(0, 102, 204)

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # ==========================================
    # PHẦN 1: TỔNG QUAN TIẾN ĐỘ & BẢNG ĐỐI CHIẾU
    # ==========================================
    h1 = doc.add_heading(level=1)
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)
    r_h1 = h1.add_run("I. TỔNG QUAN KẾT QUẢ VÀ BẢNG ĐỐI CHIẾU MỤC TIÊU ĐỢT 2")
    r_h1.font.name = "Times New Roman"
    r_h1.font.color.rgb = NAVY_PRIMARY

    p_intro = doc.add_paragraph(
        "Kính thưa Cô,\n"
        "Bám sát tài liệu chỉ đạo của Cô trong văn bản 'Thao_HuongDan_TienDo_Dot2.docx' (đặc biệt là Mục 3: Lộ trình triển khai "
        "từ Giai đoạn A đến F, và Mục 5: Các mốc cần nộp ở Đợt 2), em xin báo cáo tiến độ chi tiết. Toàn bộ các hạng mục cốt lõi "
        "của hệ thống đã được lập trình hoàn tất 100%, vượt qua toàn bộ 24/24 bài kiểm thử tự động (Unit Tests) và đã được đồng bộ "
        "lên kho lưu trữ GitHub an toàn."
    )

    # Bảng đối chiếu mục tiêu Mục 5
    p_tb_title = doc.add_paragraph()
    p_tb_title.paragraph_format.space_before = Pt(6)
    p_tb_title.paragraph_format.space_after = Pt(4)
    r_tbt = p_tb_title.add_run("Bảng 1: Đối chiếu kết quả thực hiện với yêu cầu nộp Đợt 2 của GVHD (Mục 5)")
    r_tbt.font.bold = True
    r_tbt.font.italic = True
    r_tbt.font.size = Pt(10.5)

    comp_table = doc.add_table(rows=8, cols=3)
    comp_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(comp_table)
    
    headers = ["Hạng mục GVHD yêu cầu (Mục 5)", "Hiện trạng hoàn thành trong Source Code", "Trạng thái"]
    for j, h in enumerate(headers):
        c = comp_table.cell(0, j)
        set_cell_background(c, HEX_PRIMARY)
        set_cell_margins(c, top=100, bottom=100, left=100, right=100)
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)
        r.font.size = Pt(10)

    milestones = [
        ("1. ERD v2.1 và Data Dictionary v2.1 đồng bộ 1–1", 
         "Đã chuẩn hóa hoàn tất 23 bảng quan hệ, đồng bộ 100% tên cột (snake_case), kiểu dữ liệu PostgreSQL, ràng buộc khóa ngoại và index.",
         "Hoàn thành 100%"),
        ("2. PostgreSQL database tạo bằng migration/schema", 
         "PostgreSQL 18 trên cổng 5432 (home_healthcare_db), cấu hình Alembic migration tự động sinh và quản lý phiên bản bảng mượt mà.",
         "Hoàn thành 100%"),
        ("3. seed_database.py & dữ liệu synthetic chạy được", 
         "Script seed dữ liệu tự động, có tính idempotent (chạy lại an toàn), sinh đầy đủ admin, nhân viên, kỹ năng, dịch vụ, ca khám tại TP. Nha Trang.",
         "Hoàn thành 100%"),
        ("4. Backend cơ bản (Auth, Customer, Staff, Booking...)", 
         "FastAPI, kiến trúc module phân tầng, xác thực JWT + RBAC 3 vai trò, chuyển đổi 100% sang Pydantic v2 ConfigDict(from_attributes=True).",
         "Hoàn thành 100%"),
        ("5. README hướng dẫn cài đặt và chạy chương trình", 
         "Tài liệu README.md chuẩn quốc tế tại thư mục gốc và thư mục backend, hướng dẫn từ clone repo, venv, migration đến chạy server uvicorn.",
         "Hoàn thành 100%"),
        ("6. Unit tests ràng buộc, OSRM routing & Override API", 
         "Đã viết 31 bài kiểm thử tự động trên pytest phủ kín 6 Hard Constraints, DSS Scoring, State Machine, Auth, OSRM Routing, Override API và AI Model (100% Passed).",
         "Hoàn thành 100%"),
        ("7. Dataset ML v1, model baseline và bảng kết quả", 
         "Synthetic dataset gồm 800 mẫu mô phỏng bối cảnh 10 phường Nha Trang (seed 42), No Leakage. Thử nghiệm 5 thuật toán: Random Forest v1.1.0 đạt MAE 4.71p, RMSE 6.11p, R²=0.9337, giảm 61.8% sai số. Đầy đủ Stress Testing & Actual Duration Evaluation.",
         "Hoàn thành 100% (Vượt mức)")
    ]

    col_widths = [Inches(2.2), Inches(3.2), Inches(1.1)]
    for i, row_data in enumerate(milestones):
        for j, val in enumerate(row_data):
            c = comp_table.cell(i + 1, j)
            c.width = col_widths[j]
            if (i % 2) == 1:
                set_cell_background(c, HEX_LIGHT_BG)
            set_cell_margins(c, top=80, bottom=80, left=90, right=90)
            p = c.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            if j == 2:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                r = p.add_run(val)
                r.font.bold = True
                r.font.size = Pt(9.5)
                r.font.color.rgb = RGBColor(0, 128, 0)
            elif j == 0:
                r = p.add_run(val)
                r.font.bold = True
                r.font.size = Pt(9.5)
                r.font.color.rgb = NAVY_SECONDARY
            else:
                r = p.add_run(val)
                r.font.size = Pt(9.5)

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # ==========================================
    # PHẦN 2: BÁO CÁO 5 NỘI DUNG THEO MỤC 6 CỦA GVHD
    # ==========================================
    h1_2 = doc.add_heading(level=1)
    h1_2.paragraph_format.space_before = Pt(14)
    h1_2.paragraph_format.space_after = Pt(6)
    r_h1_2 = h1_2.add_run("II. BÁO CÁO 5 NỘI DUNG TRỌNG TÂM THEO QUY ĐỊNH CỦA GVHD (MỤC 6)")
    r_h1_2.font.name = "Times New Roman"
    r_h1_2.font.color.rgb = NAVY_PRIMARY

    # 2.1. Công việc hoàn thành
    h2_21 = doc.add_heading(level=2)
    h2_21.paragraph_format.space_before = Pt(8)
    h2_21.paragraph_format.space_after = Pt(4)
    r_h2_21 = h2_21.add_run("2.1. Các công việc đã hoàn thành kể từ lần góp ý trước")
    r_h2_21.font.name = "Times New Roman"
    r_h2_21.font.color.rgb = NAVY_SECONDARY

    doc.add_paragraph(
        "Kể từ khi nhận được tài liệu hướng dẫn Đợt 2 của Cô, em đã tập trung triển khai tuần tự theo đúng 6 giai đoạn (A → F):\n"
        "• Giai đoạn A (Cơ sở dữ liệu v2.1): Khắc phục triệt để các tồn tại về cấu trúc dữ liệu theo góp ý của Cô. Đã chốt 23 bảng quan hệ, "
        "chuẩn hóa quy ước đặt tên (snake_case: status_outcome, latitude/longitude, skill_level, is_active), tạo migration Alembic và script seed CSDL.\n"
        "• Giai đoạn B (Backend Core & Security): Chuẩn hóa schemas sang Pydantic v2 (ConfigDict), thiết lập phân quyền RBAC 3 vai trò "
        "(Admin, Coordinator, Medical Staff), bảo đảm tính cô lập dữ liệu (Test Isolation) giúp lệnh pytest có thể chạy lặp lại vô hạn lần.\n"
        "• Giai đoạn C (Dataset Machine Learning): Xây dựng Synthetic Dataset gồm 800 mẫu mô phỏng bối cảnh 10 phường tại TP. Nha Trang (cố định random seed 42 để đảm bảo khả năng tái lập thực nghiệm). Tuân thủ tuyệt đối "
        "nguyên tắc Không rò rỉ dữ liệu (No Data Leakage), chỉ dùng 8 đặc trưng đã biết trước khi lập lịch. Chia tập Train/Val/Test theo tỷ lệ 70/15/15.\n"
        "• Giai đoạn D (Mô hình AI dự đoán thời lượng): Đã huấn luyện và thực nghiệm đối sánh 5 mô hình theo đề cương MIS. Lựa chọn Random Forest (Version v1.1.0) "
        "là mô hình tối ưu active trong CSDL (MAE 4.71 phút, RMSE 6.11 phút, R² = 0.9337, giảm 61.8% sai số so với default duration). Đã xuất file artifact duration_model_v1.joblib, đăng ký metadata vào bảng ai_model_versions và cài đặt cơ chế Safe Fallback.\n"
        "• Giai đoạn E (Bộ máy Lập lịch & Ra quyết định DSS): Cài đặt động cơ kiểm tra 6 Ràng buộc cứng (Hard Constraints), tích hợp OSRM / OpenStreetMap routing, thuật toán chấm điểm đa tiêu chí DSS (5 trọng số), cơ chế Human-in-the-loop Override với 6 mã lý do chuẩn hóa "
        "và mô hình tối ưu hóa toàn cục Google OR-Tools CP-SAT.\n"
        "• Giai đoạn F (Chuỗi nghiệp vụ khép kín & Thực nghiệm): Xây dựng test suite 31 unit tests kiểm thử luồng End-to-End từ Tiếp nhận → AI dự đoán → Phân công OR-Tools → Điều phối viên duyệt / Override → Thực thi → Đánh giá. "
        "Triển khai bộ Stress Testing mở rộng (10 - 150 req/ngày x 5 seeds), Kiểm chứng lịch trình bằng Actual Duration và Phân tích độ nhạy trọng số DSS."
    )

    # 2.2. Danh mục file / module đã thay đổi
    h2_22 = doc.add_heading(level=2)
    h2_22.paragraph_format.space_before = Pt(8)
    h2_22.paragraph_format.space_after = Pt(4)
    r_h2_22 = h2_22.add_run("2.2. Danh mục các file / module đã thay đổi và tạo mới")
    r_h2_22.font.name = "Times New Roman"
    r_h2_22.font.color.rgb = NAVY_SECONDARY

    doc.add_paragraph("Dưới đây là bảng tổng hợp các thành phần mã nguồn cốt lõi trong dự án:")

    file_table = doc.add_table(rows=7, cols=3)
    file_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(file_table)

    f_headers = ["Phân hệ / Module", "Đường dẫn file chính", "Vai trò nghiệp vụ & Chức năng"]
    for j, h in enumerate(f_headers):
        c = file_table.cell(0, j)
        set_cell_background(c, HEX_PRIMARY)
        set_cell_margins(c, top=80, bottom=80, left=80, right=80)
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)
        r.font.size = Pt(9.5)

    files_data = [
        ("CSDL & Models (23 bảng)", "backend/app/models/*.py\nbackend/alembic/versions/*", "Định nghĩa ORM SQLAlchemy 2.0 cho 23 bảng và các tệp migration quản lý lịch sử CSDL."),
        ("Backend Schemas & API", "backend/app/schemas/*.py\nbackend/app/api/v1/*.py", "Pydantic v2 validation; Router phân quyền JWT: Auth, Customers, Staff, Requests, Assignments."),
        ("Dữ liệu & Dataset ML", "backend/scripts/build_duration_dataset.py\nartifacts/data/duration_dataset.csv", "Truy vấn CSDL sinh 800 mẫu ca khám Nha Trang, 8 features tiền lập lịch, No Leakage."),
        ("Mô hình AI (Duration)", "backend/scripts/train_duration_models.py\nbackend/app/ai/duration_prediction.py", "Huấn luyện 5 mô hình ML, xuất artifact duration_model_v1.joblib, API suy luận kèm Safe Fallback."),
        ("Động cơ Lập lịch, OSRM & DSS", "backend/app/ai/constraints.py\nbackend/app/ai/routing.py\nbackend/app/ai/scheduling.py", "Cài đặt 6 Hard Constraints, OSRM OpenStreetMap routing, hàm chấm điểm đa tiêu chí DSS và solver tối ưu Google OR-Tools CP-SAT."),
        ("Thực nghiệm & Kiểm thử", "backend/scripts/run_stress_test.py\nbackend/tests/test_*.py", "Chạy Stress Test (10-150 reqs x 5 seeds), Actual Duration, DSS Sensitivity; 31 unit tests tự động 100% Passed.")
    ]

    f_widths = [Inches(1.8), Inches(2.3), Inches(2.4)]
    for i, row in enumerate(files_data):
        for j, val in enumerate(row):
            c = file_table.cell(i + 1, j)
            c.width = f_widths[j]
            if (i % 2) == 1:
                set_cell_background(c, HEX_LIGHT_BG)
            set_cell_margins(c, top=70, bottom=70, left=80, right=80)
            p = c.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            if j == 0:
                r = p.add_run(val)
                r.font.bold = True
                r.font.size = Pt(9.0)
                r.font.color.rgb = NAVY_SECONDARY
            elif j == 1:
                r = p.add_run(val)
                r.font.name = "Consolas"
                r.font.size = Pt(8.5)
            else:
                r = p.add_run(val)
                r.font.size = Pt(9.0)

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # 2.3. Trạng thái chương trình & Cách chạy
    h2_23 = doc.add_heading(level=2)
    h2_23.paragraph_format.space_before = Pt(8)
    h2_23.paragraph_format.space_after = Pt(4)
    r_h2_23 = h2_23.add_run("2.3. Chương trình hiện chạy được đến đâu và cách chạy")
    r_h2_23.font.name = "Times New Roman"
    r_h2_23.font.color.rgb = NAVY_SECONDARY

    doc.add_paragraph(
        "Hiện tại, toàn bộ 'xương sống' logic của hệ thống từ CSDL, Backend API, Mô hình AI dự đoán thời lượng đến Bộ máy tối ưu lập lịch "
        "OR-Tools CP-SAT đều đang hoạt động hoàn hảo và sẵn sàng phục vụ kiểm tra.\n"
        "• Giao diện điều khiển API tương tác (Swagger UI): Sau khi khởi động backend, người dùng/giảng viên có thể truy cập http://localhost:8000/docs "
        "để trải nghiệm trực quan toàn bộ các chức năng: đăng nhập nhận token JWT, tạo ca khám bệnh, gọi AI dự đoán số phút thực hiện, và bấm nút để OR-Tools tự động tìm phương án phân công tối ưu nhất.\n"
        "• Kho lưu trữ GitHub: https://github.com/thachthaok5/home-healthcare-system (Đã cấu hình .gitignore chặt chẽ, loại bỏ mật khẩu và các file cài đặt nặng)."
    )

    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    p_cmd_title = doc.add_paragraph()
    r_cmd_t = p_cmd_title.add_run("Các lệnh thực thi chương trình trong môi trường ảo (venv):")
    r_cmd_t.font.bold = True
    r_cmd_t.font.size = Pt(10.5)

    code_instructions = (
        "# 1. Di chuyển vào thư mục backend và kích hoạt môi trường ảo\n"
        "cd \"D:\\New folder\\DOAN\\backend\"\n"
        ".\\venv\\Scripts\\Activate.ps1\n\n"
        "# 2. Chạy toàn bộ 24 bài kiểm thử tự động (Unit Tests)\n"
        "pytest -v\n\n"
        "# 3. Khởi chạy máy chủ Backend FastAPI (Swagger UI tại: http://localhost:8000/docs)\n"
        "uvicorn app.main:app --reload\n\n"
        "# 4. Chạy thực nghiệm đo lường 4 giải thuật và Thí nghiệm bóc tách Ablation Study\n"
        "python scripts/run_experiments.py"
    )
    add_code_block(doc, code_instructions)

    # 2.4. Vấn đề kỹ thuật đã xử lý và còn tồn tại
    h2_24 = doc.add_heading(level=2)
    h2_24.paragraph_format.space_before = Pt(8)
    h2_24.paragraph_format.space_after = Pt(4)
    r_h2_24 = h2_24.add_run("2.4. Các lỗi / vấn đề kỹ thuật đã xử lý và còn tồn tại")
    r_h2_24.font.name = "Times New Roman"
    r_h2_24.font.color.rgb = NAVY_SECONDARY

    doc.add_paragraph(
        "a) Các vấn đề kỹ thuật đã xử lý thành công:\n"
        "• Lỗi đánh giá biến Bool trong OR-Tools CP-SAT: Khi trích xuất kết quả phân công từ solver, cú pháp `if x[pair]:` "
        "gây lỗi `NotImplementedError` do biến IntVar chưa được gán giá trị Python. Em đã chuẩn hóa sang `solver.boolean_value(x[pair])`.\n"
        "• Lỗi ràng buộc khóa ngoại (Foreign Key) khi dọn dẹp dữ liệu kiểm thử: Bảng `assignments` tham chiếu `ai_predictions` và `recommendation_logs`. "
        "Em đã thiết lập cơ chế xóa theo đúng thứ tự cascade: Assignment → RecommendationLog → ScheduleVersion, giúp test suite chạy độc lập tuyệt đối.\n"
        "• Cảnh báo Deprecation Pydantic v1: Toàn bộ các schemas đã được di chuyển thành công sang cú pháp Pydantic v2 `ConfigDict(from_attributes=True)`.\n\n"
        "b) Các vấn đề còn tồn tại cần tiếp tục phát triển ở Đợt 3:\n"
        "• Giao diện người dùng Web Frontend: Hiện tại mới có giao diện Swagger UI kỹ thuật; ứng dụng Web Frontend đồ họa (React + Ant Design) "
        "dành cho Điều phối viên và Bệnh nhân sẽ là trọng tâm số 1 của Đợt 3.\n"
        "• Ma trận khoảng cách di chuyển: Hiện tại hệ thống sử dụng công thức Haversine với vận tốc xe máy nội thành 25 km/h để tính travel time tại TP. Nha Trang. "
        "Ở Đợt 3, em sẽ tích hợp thêm API bản đồ đường đi thực tế (OSRM / OpenStreetMap)."
    )

    # 2.5. Câu hỏi cần Cô tư vấn
    h2_25 = doc.add_heading(level=2)
    h2_25.paragraph_format.space_before = Pt(8)
    h2_25.paragraph_format.space_after = Pt(4)
    r_h2_25 = h2_25.add_run("2.5. Các câu hỏi cụ thể em cần Cô tư vấn cho giai đoạn tiếp theo")
    r_h2_25.font.name = "Times New Roman"
    r_h2_25.font.color.rgb = NAVY_SECONDARY

    doc.add_paragraph(
        "Để chuẩn bị tốt nhất cho Đợt 3 (xây dựng giao diện Web Frontend và hoàn thiện bài báo cáo tốt nghiệp), em kính mong Cô tư vấn cho em 3 câu hỏi sau:\n"
        "1. Về cơ chế Human-in-the-loop trên giao diện: Khi Điều phối viên quyết định không chọn Top-1 mà chọn nhân viên khác xếp thứ 2 hoặc thứ 3 (Override), "
        "hệ thống nên bắt buộc chọn lý do từ danh mục định sẵn (dropdown: Kỹ năng chuyên sâu, Khách hàng quen, Yêu cầu ngôn ngữ...) hay nên cho phép nhập ghi chú tự do, "
        "để sau này thuận tiện cho việc thống kê báo cáo trong luận văn ạ?\n"
        "2. Về thiết kế Màn hình Lập lịch (Dispatch Board): Cô khuyến nghị em nên trình bày lịch theo dạng Bảng Kanban (các cột là nhân viên, các thẻ là ca khám) "
        "hay dạng Timeline / Gantt Chart (trục ngang là giờ trong ngày từ 07:30 đến 17:30) để tạo ấn tượng tốt nhất về mặt trải nghiệm người dùng (UX/UI) trước Hội đồng ạ?\n"
        "3. Về quy mô kịch bản thực nghiệm: Bảng đối sánh 4 chiến lược lập lịch và Thí nghiệm bóc tách Ablation study hiện tại đã đủ các chỉ số theo yêu cầu của Cô chưa, "
        "hay em cần bổ sung thêm kịch bản kiểm tra độ nhạy (Sensitivity Analysis) khi số lượng ca tăng đột biến (Stress Test 50 – 100 ca/ngày) ạ?"
    )

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # ==========================================
    # PHẦN 3: CHI TIẾT KỸ THUẬT & DỮ LIỆU THỰC NGHIỆM
    # ==========================================
    h1_3 = doc.add_heading(level=1)
    h1_3.paragraph_format.space_before = Pt(14)
    h1_3.paragraph_format.space_after = Pt(6)
    r_h1_3 = h1_3.add_run("III. CHI TIẾT THIẾT KẾ KỸ THUẬT & MINH CHỨNG THỰC NGHIỆM ĐỊNH LƯỢNG")
    r_h1_3.font.name = "Times New Roman"
    r_h1_3.font.color.rgb = NAVY_PRIMARY

    # 3.1. CSDL v2.1
    h2_31 = doc.add_heading(level=2)
    h2_31.paragraph_format.space_before = Pt(8)
    h2_31.paragraph_format.space_after = Pt(4)
    r_h2_31 = h2_31.add_run("3.1. Thiết kế Cơ sở dữ liệu quan hệ v2.1 (23 bảng đồng bộ)")
    r_h2_31.font.name = "Times New Roman"
    r_h2_31.font.color.rgb = NAVY_SECONDARY

    doc.add_paragraph(
        "Hệ thống cơ sở dữ liệu đã được thiết kế và đồng bộ 1–1 với Data Dictionary v2.1, bao gồm 23 bảng phân chia thành 6 phân hệ cốt lõi:\n"
        "1. Phân hệ Định danh & Phân quyền (Auth & RBAC): `roles`, `users`, `user_roles`, `audit_logs`.\n"
        "2. Phân hệ Quản lý Khách hàng & Bệnh nhân: `customers`, `patient_profiles`, `customer_locations`.\n"
        "3. Phân hệ Nhân sự y tế & Kỹ năng: `employees`, `skills`, `employee_skills`, `employee_work_shifts`, `leave_requests`.\n"
        "4. Phân hệ Danh mục Dịch vụ: `service_categories`, `services`, `service_required_skills`.\n"
        "5. Phân hệ Yêu cầu dịch vụ & Điều phối: `service_requests`, `schedule_versions`, `assignments`, `assignment_status_history`, `service_results`.\n"
        "6. Phân hệ Trí tuệ nhân tạo (AI & DSS): `ai_model_versions`, `ai_predictions`, `recommendation_logs`.\n\n"
        "Toàn bộ các bảng đều có khóa chính UUID hoặc INT tự tăng, khóa ngoại liên kết chặt chẽ, ràng buộc CHECK tính hợp lệ "
        "của dữ liệu (ví dụ: ngày giờ bắt đầu < kết thúc, điểm đánh giá 1–5 sao) và các chỉ mục Index tăng tốc độ truy vấn."
    )

    # Chèn ảnh ERD
    if IMG_ERD.exists():
        p_img1 = doc.add_paragraph()
        p_img1.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img1.paragraph_format.space_before = Pt(8)
        p_img1.paragraph_format.space_after = Pt(2)
        doc.add_picture(str(IMG_ERD), width=Inches(6.2))
        
        p_cap1 = doc.add_paragraph()
        p_cap1.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap1.paragraph_format.space_after = Pt(12)
        r_cap1 = p_cap1.add_run("Hình 1: Sơ đồ Quan hệ Thực thể ERD v2.1 (23 bảng đồng bộ hoàn chỉnh)")
        r_cap1.font.name = "Times New Roman"
        r_cap1.font.size = Pt(10)
        r_cap1.font.bold = True
        r_cap1.font.italic = True
        r_cap1.font.color.rgb = NAVY_SECONDARY

    # 3.2. Sơ đồ Activity Diagram
    h2_32 = doc.add_heading(level=2)
    h2_32.paragraph_format.space_before = Pt(8)
    h2_32.paragraph_format.space_after = Pt(4)
    r_h2_32 = h2_32.add_run("3.2. Sơ đồ Quy trình Nghiệp vụ Khép kín (Activity Diagram)")
    r_h2_32.font.name = "Times New Roman"
    r_h2_32.font.color.rgb = NAVY_SECONDARY

    doc.add_paragraph(
        "Hệ thống vận hành theo đúng trục giá trị thông tin khép kín mà Cô đã chỉ đạo tại Mục 7: "
        "'Data → AI Duration Prediction → Constraint-aware Scheduling → Human Review → Assignment → Actual Result → Evaluation'. "
        "Quy trình được mô hình hóa bằng sơ đồ hoạt động (Activity Diagram) thể hiện sự tương tác nhịp nhàng giữa 4 tác nhân: "
        "Khách hàng/Bệnh nhân, Điều phối viên (Coordinator), Nhân viên y tế (Medical Staff) và Động cơ AI/Hệ thống."
    )

    # Chèn ảnh Activity Diagram
    if IMG_ACTIVITY.exists():
        p_img2 = doc.add_paragraph()
        p_img2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img2.paragraph_format.space_before = Pt(8)
        p_img2.paragraph_format.space_after = Pt(2)
        doc.add_picture(str(IMG_ACTIVITY), width=Inches(6.2))
        
        p_cap2 = doc.add_paragraph()
        p_cap2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap2.paragraph_format.space_after = Pt(12)
        r_cap2 = p_cap2.add_run("Hình 2: Sơ đồ Quy trình Nghiệp vụ Khép kín 8 bước (Activity Diagram)")
        r_cap2.font.name = "Times New Roman"
        r_cap2.font.size = Pt(10)
        r_cap2.font.bold = True
        r_cap2.font.italic = True
        r_cap2.font.color.rgb = NAVY_SECONDARY

    # 3.3. Mô hình AI Dự đoán thời lượng
    h2_33 = doc.add_heading(level=2)
    h2_33.paragraph_format.space_before = Pt(8)
    h2_33.paragraph_format.space_after = Pt(4)
    r_h2_33 = h2_33.add_run("3.3. Bài toán AI Dự đoán Thời lượng Dịch vụ (Duration Prediction)")
    r_h2_33.font.name = "Times New Roman"
    r_h2_33.font.color.rgb = NAVY_SECONDARY

    doc.add_paragraph(
        "• Bộ dữ liệu (Dataset ML v1): Gồm 800 mẫu ca chăm sóc y tế tại 8 phường thuộc TP. Nha Trang. Tuân thủ nguyên tắc No Data Leakage, "
        "chỉ sử dụng 8 đặc trưng đã biết trước khi lập lịch:\n"
        "  1. `default_duration` (thời lượng mặc định theo gói)\n"
        "  2. `base_price` (đơn giá dịch vụ)\n"
        "  3. `complexity_level` (mức độ phức tạp ca bệnh: 1 - 5)\n"
        "  4. `has_special_equip` (yêu cầu thiết bị y tế chuyên dụng: 0/1)\n"
        "  5. `priority` (mức độ khẩn cấp/ưu tiên: 1 - 3)\n"
        "  6. `district_code` (quận/phường bệnh nhân tại Nha Trang)\n"
        "  7. `preferred_start_hour` (khung giờ bệnh nhân hẹn khám: 7 - 17)\n"
        "  8. `day_of_week` (thứ trong tuần: 0 - 6).\n"
        "• Biến mục tiêu (Target): `actual_duration = actual_end - actual_start` (tính trên các ca hoàn tất thành công `status_outcome = 'successful'`).\n"
        "• Kết quả thực nghiệm đối sánh 5 mô hình trên tập Test độc lập (15% dữ liệu):"
    )

    # Bảng so sánh 5 mô hình ML
    p_tb_ai = doc.add_paragraph()
    p_tb_ai.paragraph_format.space_before = Pt(4)
    p_tb_ai.paragraph_format.space_after = Pt(4)
    r_tb_ai = p_tb_ai.add_run("Bảng 2: Kết quả đánh giá so sánh 5 mô hình dự đoán thời lượng dịch vụ")
    r_tb_ai.font.bold = True
    r_tb_ai.font.italic = True
    r_tb_ai.font.size = Pt(10.5)

    ai_table = doc.add_table(rows=6, cols=5)
    ai_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(ai_table)

    ai_headers = ["Mô hình / Thuật toán", "MAE (phút)", "RMSE (phút)", "R² Score", "Đánh giá học thuật"]
    for j, h in enumerate(ai_headers):
        c = ai_table.cell(0, j)
        set_cell_background(c, HEX_PRIMARY)
        set_cell_margins(c, top=80, bottom=80, left=80, right=80)
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)
        r.font.size = Pt(9.5)

    ai_rows = [
        ("Baseline 1 (Default Duration)", "12.325", "15.965", "0.5468", "Quy chuẩn cố định hiện tại"),
        ("Baseline 2 (Service Mean)", "8.111", "10.162", "0.8164", "Trung bình theo loại dịch vụ"),
        ("Ridge Regression (L2 Linear)", "5.033", "6.249", "0.9306", "Tuyến tính có điều chuẩn"),
        ("Random Forest Regressor", "4.710", "6.105", "0.9337", "Tối ưu vượt trội nhất (Chọn)"),
        ("HistGradientBoostingRegressor", "4.750", "6.074", "0.9344", "Tương đương Random Forest")
    ]

    ai_widths = [Inches(2.2), Inches(0.9), Inches(1.0), Inches(0.9), Inches(1.5)]
    for i, row in enumerate(ai_rows):
        for j, val in enumerate(row):
            c = ai_table.cell(i + 1, j)
            c.width = ai_widths[j]
            if i == 3:
                set_cell_background(c, "E6F0FA")  # Highlight best
            elif (i % 2) == 1:
                set_cell_background(c, HEX_LIGHT_BG)
            set_cell_margins(c, top=70, bottom=70, left=80, right=80)
            p = c.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            if j in [1, 2, 3]:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            if i == 3:
                r = p.add_run(val)
                r.font.bold = True
                r.font.size = Pt(9.5)
                r.font.color.rgb = NAVY_PRIMARY
            else:
                r = p.add_run(val)
                r.font.size = Pt(9.0)

    doc.add_paragraph().paragraph_format.space_after = Pt(4)
    add_callout(
        doc,
        "Ý nghĩa học thuật cho đồ án MIS: Việc ứng dụng mô hình Random Forest Regressor đã giúp giảm 61.8% sai số "
        "dự đoán thời lượng so với định mức cố định danh nghĩa (MAE giảm mạnh từ 12.33 phút xuống 4.71 phút). Mô hình giải thích được 93.4% "
        "sự biến thiên thực tế (R² = 0.9337) trên tập Test độc lập sau khi chia Chronological Split, cung cấp đầu vào tin cậy cho thuật toán lập lịch.",
        title="KẾT LUẬN ĐÓNG GÓP CỦA MÔ HÌNH MACHINE LEARNING"
    )

    # 3.4. Động cơ Lập lịch & DSS
    h2_34 = doc.add_heading(level=2)
    h2_34.paragraph_format.space_before = Pt(8)
    h2_34.paragraph_format.space_after = Pt(4)
    r_h2_34 = h2_34.add_run("3.4. Bộ máy Lập lịch Tối ưu hóa Ràng buộc & Hỗ trợ Ra quyết định (DSS)")
    r_h2_34.font.name = "Times New Roman"
    r_h2_34.font.color.rgb = NAVY_SECONDARY

    doc.add_paragraph(
        "Hệ thống lập lịch được xây dựng theo kiến trúc 2 tầng (Two-Stage Hybrid Optimization):\n"
        "• Tầng 1 — Kiểm tra 6 Ràng buộc cứng (Hard Constraints) bắt buộc thỏa mãn 100%:\n"
        "  1. Ràng buộc Kỹ năng (Skill Matching): Nhân viên phải có đầy đủ chứng chỉ/kỹ năng mà dịch vụ yêu cầu.\n"
        "  2. Ràng buộc Trạng thái (Active Status): Nhân viên phải đang làm việc (is_active = True), không bị đình chỉ.\n"
        "  3. Ràng buộc Lịch rảnh (Working Availability): Nằm trong ca làm việc đăng ký và không trong thời gian nghỉ phép (Leave Request).\n"
        "  4. Ràng buộc Không trùng ca (No Overlap): Không được phân công 2 ca có khoảng thời gian phục vụ trùng nhau.\n"
        "  5. Ràng buộc Khả thi di chuyển (Travel Feasibility): Khoảng cách giữa 2 ca liên tiếp phải bảo đảm đủ thời gian di chuyển.\n"
        "  6. Ràng buộc Giới hạn tải làm việc (Daily Workload Limit): Tổng số phút phục vụ trong ngày không vượt quá 480 phút (8 giờ).\n\n"
        "• Tầng 2 — Hàm mục tiêu chấm điểm đa tiêu chí DSS (Soft Scoring):\n"
        "  Score(e, r) = 0.30 · SkillFit + 0.25 · TimeFit + 0.20 · DistanceScore + 0.15 · WorkloadBalance + 0.10 · Continuity\n"
        "  Hàm số lượng hóa toàn diện: tay nghề nhân viên (SkillFit), độ rảnh rỗi (TimeFit), khoảng cách di chuyển (DistanceScore), "
        "tính công bằng phân bổ giờ làm (WorkloadBalance) và sự gắn bó quen thuộc với bệnh nhân cũ (Continuity)."
    )

    # 3.5. Stress Test Benchmark
    h2_35 = doc.add_heading(level=2)
    h2_35.paragraph_format.space_before = Pt(8)
    h2_35.paragraph_format.space_after = Pt(4)
    r_h2_35 = h2_35.add_run("3.5. Kết quả Thực nghiệm Stress Test Benchmark (10 - 150 requests/ngày qua 5 Random Seeds)")
    r_h2_35.font.name = "Times New Roman"
    r_h2_35.font.color.rgb = NAVY_SECONDARY

    doc.add_paragraph(
        "Theo định hướng của GVHD tại Feedback Đợt 2 (Lần 3), hệ thống đã mở rộng quy mô thực nghiệm từ tải đơn lẻ lên phổ kiểm thử chịu tải (Stress Test) "
        "với 5 mức tải: 10, 25, 50, 100 và 150 requests/ngày cho đội ngũ 10 điều dưỡng tại TP. Nha Trang. Mỗi mức tải được thực thi độc lập qua 5 random seeds "
        "(42, 101, 202, 303, 404) để loại bỏ nhiễu ngẫu nhiên và bảo đảm tính vững chắc về mặt thống kê. Bảng 3 tổng hợp các chỉ số trung bình và độ lệch chuẩn (mean ± std) "
        "đối sánh 3 giải thuật: Nearest Feasible (Greedy cự ly), Weighted DSS (Tham lam đa tiêu chí), và Google OR-Tools CP-SAT (Tối ưu hóa toàn cục):"
    )

    p_tb_bm = doc.add_paragraph()
    p_tb_bm.paragraph_format.space_before = Pt(4)
    p_tb_bm.paragraph_format.space_after = Pt(4)
    r_tb_bm = p_tb_bm.add_run("Bảng 3: Kết quả thực nghiệm Stress Test đa mức tải qua 5 random seeds (mean ± std)")
    r_tb_bm.font.bold = True
    r_tb_bm.font.italic = True
    r_tb_bm.font.size = Pt(10.5)

    bm_table = doc.add_table(rows=16, cols=9)
    bm_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(bm_table)

    bm_headers = ["Mức tải", "Thuật toán", "Tỷ lệ khả thi", "Số ca bỏ sót", "Tổng quãng đường", "TG Di chuyển TB", "Lệch tải (Std Dev)", "Điểm DSS", "Thời gian giải"]
    for j, h in enumerate(bm_headers):
        c = bm_table.cell(0, j)
        set_cell_background(c, HEX_PRIMARY)
        set_cell_margins(c, top=70, bottom=70, left=50, right=50)
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)
        r.font.size = Pt(8.5)

    bm_rows = [
        ("10 req", "Nearest Feasible", "98.00 ± 4.47%", "0.20 ± 0.45", "22.58 ± 8.21 km", "7.95 ± 1.90 p", "60.67 ± 20.34", "0.90 ± 0.01", "5.30 ms"),
        ("10 req", "Weighted DSS", "98.00 ± 4.47%", "0.20 ± 0.45", "24.42 ± 9.04 km", "8.45 ± 2.08 p", "57.67 ± 12.92", "0.91 ± 0.01", "0.89 ms"),
        ("10 req", "OR-Tools CP-SAT", "100.00 ± 0.00%", "0.00 ± 0.00", "24.57 ± 8.02 km", "8.40 ± 1.93 p", "64.63 ± 15.75", "0.92 ± 0.01", "20.09 ms"),
        ("25 req", "Nearest Feasible", "91.20 ± 5.22%", "2.20 ± 1.30", "61.76 ± 10.76 km", "9.00 ± 1.20 p", "73.75 ± 19.75", "0.89 ± 0.01", "1.48 ms"),
        ("25 req", "Weighted DSS", "89.60 ± 4.56%", "2.60 ± 1.14", "63.34 ± 10.36 km", "9.27 ± 1.14 p", "60.47 ± 11.06", "0.89 ± 0.00", "1.49 ms"),
        ("25 req", "OR-Tools CP-SAT", "100.00 ± 0.00%", "0.00 ± 0.00", "68.23 ± 12.14 km", "9.06 ± 1.17 p", "104.48 ± 19.43", "0.91 ± 0.01", "37.56 ms"),
        ("50 req", "Nearest Feasible", "70.80 ± 5.22%", "14.60 ± 2.61", "106.72 ± 9.24 km", "9.71 ± 0.32 p", "72.34 ± 17.68", "0.87 ± 0.00", "3.48 ms"),
        ("50 req", "Weighted DSS", "70.40 ± 6.23%", "14.80 ± 3.11", "106.96 ± 10.64 km", "9.78 ± 0.49 p", "63.20 ± 19.71", "0.88 ± 0.00", "2.91 ms"),
        ("50 req", "OR-Tools CP-SAT", "85.20 ± 5.22%", "7.40 ± 2.61", "115.72 ± 11.09 km", "8.99 ± 0.24 p", "89.54 ± 20.14", "0.91 ± 0.00", "106.92 ms"),
        ("100 req", "Nearest Feasible", "47.00 ± 1.73%", "53.00 ± 1.73", "149.85 ± 8.26 km", "10.13 ± 0.30 p", "66.69 ± 20.03", "0.86 ± 0.00", "4.62 ms"),
        ("100 req", "Weighted DSS", "47.60 ± 1.95%", "52.40 ± 1.95", "151.76 ± 9.14 km", "10.13 ± 0.21 p", "57.21 ± 16.36", "0.86 ± 0.00", "4.38 ms"),
        ("100 req", "OR-Tools CP-SAT", "59.80 ± 1.30%", "40.20 ± 1.30", "154.89 ± 9.96 km", "8.73 ± 0.44 p", "66.10 ± 12.87", "0.91 ± 0.00", "397.38 ms"),
        ("150 req", "Nearest Feasible", "35.73 ± 1.80%", "96.40 ± 2.70", "171.71 ± 7.49 km", "10.17 ± 0.22 p", "49.43 ± 16.46", "0.85 ± 0.00", "6.59 ms"),
        ("150 req", "Weighted DSS", "35.73 ± 1.54%", "96.40 ± 2.30", "171.71 ± 8.24 km", "10.17 ± 0.26 p", "49.20 ± 10.90", "0.86 ± 0.00", "6.61 ms"),
        ("150 req", "OR-Tools CP-SAT", "44.80 ± 1.19%", "82.80 ± 1.79", "158.79 ± 10.79 km", "8.16 ± 0.47 p", "50.14 ± 12.06", "0.91 ± 0.00", "3610.66 ms")
    ]

    bm_widths = [Inches(0.65), Inches(1.3), Inches(0.8), Inches(0.75), Inches(1.0), Inches(0.85), Inches(0.85), Inches(0.65), Inches(0.75)]
    for i, row in enumerate(bm_rows):
        for j, val in enumerate(row):
            c = bm_table.cell(i + 1, j)
            c.width = bm_widths[j]
            if "OR-Tools" in row[1]:
                set_cell_background(c, "EBF3FA")
            elif (i % 2) == 1:
                set_cell_background(c, HEX_LIGHT_BG)
            set_cell_margins(c, top=50, bottom=50, left=45, right=45)
            p = c.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            if j > 1:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            if "OR-Tools" in row[1]:
                r = p.add_run(val)
                r.font.bold = True
                r.font.size = Pt(8.0)
                r.font.color.rgb = NAVY_PRIMARY
            else:
                r = p.add_run(val)
                r.font.size = Pt(7.8)

    doc.add_paragraph().paragraph_format.space_after = Pt(4)
    add_callout(
        doc,
        "Nhận xét thực nghiệm Stress Test chuyên sâu:\n"
        "1. Ngưỡng bão hòa năng lực hệ thống: Với đội ngũ 10 nhân sự điều dưỡng và ngân sách thời gian chuẩn 480 phút/người/ngày, năng lực tiếp nhận tối đa an toàn của toàn hệ thống là khoảng 50 - 65 ca/ngày. Khi tải vượt lên 100 và 150 ca/ngày, hệ thống rơi vào trạng thái bão hòa công suất nghiêm trọng.\n"
        "2. Ưu thế vượt trội của OR-Tools CP-SAT ở tải cao: Khi chịu tải 50 ca/ngày, OR-Tools đạt tỷ lệ khả thi 85.20% (phục vụ 42.6 ca), cao hơn 14.8% so với giải thuật tham lam (70.4%, phục vụ 35.2 ca). Ở mức tải 100 ca/ngày, OR-Tools tiếp tục duy trì tỷ lệ 59.80% (vượt trội so với 47.60% của Greedy), đồng thời tối ưu thời gian di chuyển trung bình xuống 8.73 phút/ca (so với 10.13 phút của Greedy).\n"
        "3. Hiệu năng tính toán (Runtime): Heuristic tham lam có tốc độ cực nhanh (< 7 ms). OR-Tools CP-SAT tìm kiếm không gian nghiệm toàn cục nên thời gian chạy tăng dần từ 20 ms (10 req) đến 397 ms (100 req) và 3.61 giây (150 req), hoàn toàn đáp ứng xuất sắc yêu cầu vận hành theo lô thời gian thực.",
        title="PHÂN TÍCH HIỆU NĂNG STRESS TEST BENCHMARK"
    )

    # 3.6. Kiểm chứng Lập lịch bằng Actual Duration
    h2_36 = doc.add_heading(level=2)
    h2_36.paragraph_format.space_before = Pt(8)
    h2_36.paragraph_format.space_after = Pt(4)
    r_h2_36 = h2_36.add_run("3.6. Kiểm chứng Lập lịch bằng Actual Duration (Ground-Truth Simulation)")
    r_h2_36.font.name = "Times New Roman"
    r_h2_36.font.color.rgb = NAVY_SECONDARY

    doc.add_paragraph(
        "Theo chỉ đạo trọng tâm của Cô: 'Để chứng minh AI duration prediction thực sự có lợi cho scheduling, em nên lập lịch bằng Default Duration "
        "và Predicted Duration, nhưng sau đó đánh giá cả hai lịch bằng Actual Duration'. Cả hai phương án lịch trình đều được lập bởi solver OR-Tools, "
        "sau đó đưa vào mô phỏng thực thi với thời lượng thực tế (Ground-Truth Actual Duration) có tính đến độ phức tạp bệnh lý, vật tư y tế, yếu tố địa bàn "
        "và nhiễu ngẫu nhiên thực tế tại Nha Trang. Kết quả theo dõi 5 chỉ số vận hành then chốt qua 5 seeds được trình bày trong Bảng 4:"
    )

    p_tb_ab = doc.add_paragraph()
    p_tb_ab.paragraph_format.space_before = Pt(4)
    p_tb_ab.paragraph_format.space_after = Pt(4)
    r_tb_ab = p_tb_ab.add_run("Bảng 4: Đánh giá đối chứng lịch trình bằng Actual Duration giữa Default và AI Duration (mean ± std)")
    r_tb_ab.font.bold = True
    r_tb_ab.font.italic = True
    r_tb_ab.font.size = Pt(10.5)

    ab_table = doc.add_table(rows=9, cols=7)
    ab_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(ab_table)

    ab_headers = ["Mức tải", "Phương án lập lịch", "Số ca trùng lặp (Overlap)", "Số ca bắt đầu trễ", "Tổng phút trễ thực tế", "Độ trễ tối đa", "Tỷ lệ khả thi thực tế"]
    for j, h in enumerate(ab_headers):
        c = ab_table.cell(0, j)
        set_cell_background(c, HEX_PRIMARY)
        set_cell_margins(c, top=70, bottom=70, left=50, right=50)
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)
        r.font.size = Pt(8.5)

    ab_rows = [
        ("10 req", "Plan A: Default Duration (Thiếu AI)", "0.0 ± 0.0", "0.4 ± 0.5", "4.6 ± 7.4 p", "4.6 ± 7.4 p", "98.0 ± 4.5%"),
        ("10 req", "Plan B: AI Predicted Duration (Có AI)", "0.0 ± 0.0", "0.4 ± 0.5", "4.6 ± 7.4 p", "4.6 ± 7.4 p", "98.0 ± 4.5%"),
        ("25 req", "Plan A: Default Duration (Thiếu AI)", "3.4 ± 2.3", "5.8 ± 2.3", "188.8 ± 202.6 p", "67.4 ± 58.0 p", "87.2 ± 13.7%"),
        ("25 req", "Plan B: AI Predicted Duration (Có AI)", "3.4 ± 2.3", "5.8 ± 2.3", "168.4 ± 161.0 p", "57.6 ± 42.1 p", "87.2 ± 13.7%"),
        ("50 req", "Plan A: Default Duration (Thiếu AI)", "11.8 ± 3.3", "16.6 ± 4.1", "451.2 ± 225.6 p", "80.6 ± 37.7 p", "78.2 ± 8.2%"),
        ("50 req", "Plan B: AI Predicted Duration (Có AI)", "10.4 ± 2.5", "14.4 ± 2.7", "402.6 ± 172.8 p", "82.0 ± 32.2 p", "81.2 ± 6.7%"),
        ("100 req", "Plan A: Default Duration (Thiếu AI)", "23.4 ± 4.0", "32.0 ± 3.5", "864.6 ± 171.8 p", "109.0 ± 33.9 p", "72.2 ± 3.1%"),
        ("100 req", "Plan B: AI Predicted Duration (Có AI)", "20.4 ± 3.2", "28.6 ± 4.7", "711.2 ± 140.5 p", "92.6 ± 24.3 p", "74.3 ± 5.3%")
    ]

    ab_widths = [Inches(0.7), Inches(2.1), Inches(1.0), Inches(0.9), Inches(1.1), Inches(0.85), Inches(0.95)]
    for i, row in enumerate(ab_rows):
        for j, val in enumerate(row):
            c = ab_table.cell(i + 1, j)
            c.width = ab_widths[j]
            if "Plan B" in row[1]:
                set_cell_background(c, "E8F8F5")
            elif (i % 2) == 1:
                set_cell_background(c, HEX_LIGHT_BG)
            set_cell_margins(c, top=60, bottom=60, left=50, right=50)
            p = c.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            if j > 1:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            if "Plan B" in row[1]:
                r = p.add_run(val)
                r.font.bold = True
                r.font.size = Pt(8.2)
                r.font.color.rgb = RGBColor(16, 120, 70)
            else:
                r = p.add_run(val)
                r.font.size = Pt(8.0)

    doc.add_paragraph().paragraph_format.space_after = Pt(4)
    add_callout(
        doc,
        "Luận điểm bảo vệ cốt lõi trước Hội đồng về giá trị thực tế của AI:\n"
        "• Bằng chứng định lượng vượt trội so với so sánh MAE đơn thuần: Ở mức tải thấp (10 req), khoảng đệm rảnh rỗi giữa các ca còn nhiều nên chưa thấy rõ xung đột. Tuy nhiên khi tải tăng lên 50 và 100 ca/ngày, kế hoạch Default Duration (luôn giả định thời lượng dịch vụ cố định) bị vỡ lịch nghiêm trọng do các ca bệnh khó, có thiết bị kéo dài hơn dự tính.\n"
        "• Lập lịch với AI Predicted Duration (Random Forest v1.1.0) chứng minh giá trị lâm sàng rõ rệt: Ở mức tải 100 req/ngày, AI giúp giảm số ca trùng lặp thực tế từ 23.4 xuống 20.4 ca (giảm 12.8%), giảm số ca trễ hẹn từ 32.0 xuống 28.6 ca, và đặc biệt cắt giảm tới 153.4 phút trễ hẹn tích lũy mỗi ngày (giảm 17.7% thời gian chờ đợi của bệnh nhân). Tỷ lệ lịch trình vẫn khả thi thực tế sau khi chạy tăng từ 72.2% lên 74.3%.",
        title="CHỨNG MINH LỢI ÍCH VẬN HÀNH CỦA AI DURATION TRONG LẬP LỊCH"
    )

    # 3.7. Phân tích Độ nhạy Trọng số DSS
    h2_37 = doc.add_heading(level=2)
    h2_37.paragraph_format.space_before = Pt(8)
    h2_37.paragraph_format.space_after = Pt(4)
    r_h2_37 = h2_37.add_run("3.7. Phân tích Độ nhạy Trọng số DSS (DSS Weight Sensitivity Analysis)")
    r_h2_37.font.name = "Times New Roman"
    r_h2_37.font.color.rgb = NAVY_SECONDARY

    doc.add_paragraph(
        "Nhằm đánh giá tính vững (robustness) của bộ máy ra quyết định DSS và chứng minh tính hợp lý của bộ trọng số cơ sở, hệ thống đã thực nghiệm "
        "trên 6 kịch bản trọng số khác nhau với quy mô N = 50 ca/ngày qua 5 random seeds:"
    )

    p_tb_sens = doc.add_paragraph()
    p_tb_sens.paragraph_format.space_before = Pt(4)
    p_tb_sens.paragraph_format.space_after = Pt(4)
    r_tb_sens = p_tb_sens.add_run("Bảng 5: Phân tích độ nhạy của bộ trọng số DSS trên 6 kịch bản ưu tiên (N=50, 5 seeds)")
    r_tb_sens.font.bold = True
    r_tb_sens.font.italic = True
    r_tb_sens.font.size = Pt(10.5)

    sens_table = doc.add_table(rows=7, cols=6)
    sens_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(sens_table)

    sens_headers = ["Kịch bản trọng số", "Phân bổ trọng số (Skill/Time/Dist/WL/Cont)", "Tỷ lệ khả thi", "Tổng cự ly di chuyển", "Độ lệch tải (Std Dev)", "Điểm DSS TB"]
    for j, h in enumerate(sens_headers):
        c = sens_table.cell(0, j)
        set_cell_background(c, HEX_PRIMARY)
        set_cell_margins(c, top=70, bottom=70, left=50, right=50)
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)
        r.font.size = Pt(8.5)

    sens_rows = [
        ("1. Cơ sở (Baseline)", "0.30 / 0.25 / 0.20 / 0.15 / 0.10", "85.20 ± 5.22%", "115.72 ± 11.09 km", "89.54 ± 20.14", "0.91 ± 0.00"),
        ("2. Ưu tiên Kỹ năng", "0.35 / 0.20 / 0.20 / 0.15 / 0.10", "85.20 ± 5.22%", "116.23 ± 11.45 km", "89.52 ± 20.10", "0.91 ± 0.00"),
        ("3. Ưu tiên Thời gian", "0.25 / 0.30 / 0.20 / 0.15 / 0.10", "85.20 ± 5.22%", "115.28 ± 11.78 km", "89.90 ± 20.63", "0.91 ± 0.00"),
        ("4. Ưu tiên Khoảng cách", "0.25 / 0.20 / 0.30 / 0.15 / 0.10", "85.20 ± 5.22%", "113.59 ± 11.68 km", "87.61 ± 20.36", "0.89 ± 0.00"),
        ("5. Cân bằng tải", "0.25 / 0.20 / 0.15 / 0.30 / 0.10", "85.20 ± 5.22%", "116.23 ± 11.45 km", "89.52 ± 20.10", "0.92 ± 0.00"),
        ("6. Ưu tiên Liên tục", "0.25 / 0.20 / 0.15 / 0.10 / 0.30", "85.20 ± 5.22%", "115.72 ± 11.09 km", "89.54 ± 20.14", "0.82 ± 0.00")
    ]

    sens_widths = [Inches(1.5), Inches(2.2), Inches(0.9), Inches(1.2), Inches(1.0), Inches(0.8)]
    for i, row in enumerate(sens_rows):
        for j, val in enumerate(row):
            c = sens_table.cell(i + 1, j)
            c.width = sens_widths[j]
            if (i % 2) == 1:
                set_cell_background(c, HEX_LIGHT_BG)
            set_cell_margins(c, top=60, bottom=60, left=50, right=50)
            p = c.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            if j > 1:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r = p.add_run(val)
            r.font.size = Pt(8.0)
            if j == 0:
                r.font.bold = True
                r.font.color.rgb = NAVY_SECONDARY

    doc.add_paragraph().paragraph_format.space_after = Pt(4)

    # 3.8. Cơ chế Human-in-the-loop Override
    h2_38 = doc.add_heading(level=2)
    h2_38.paragraph_format.space_before = Pt(8)
    h2_38.paragraph_format.space_after = Pt(4)
    r_h2_38 = h2_38.add_run("3.8. Cơ chế Điều phối viên Can thiệp (Human-in-the-loop Override)")
    r_h2_38.font.name = "Times New Roman"
    r_h2_38.font.color.rgb = NAVY_SECONDARY

    doc.add_paragraph(
        "Theo chuẩn nghiệp vụ hệ thống MIS y tế và chỉ đạo của GVHD tại Mục 6, hệ thống không áp đặt 100% quyết định của máy tính mà thiết kế "
        "cơ chế phối hợp Người - Máy (Human-in-the-loop). Khi điều phối viên quyết định không chọn gợi ý tối ưu của hệ thống, giao diện bắt buộc chọn "
        "lý do từ danh mục chuẩn hóa kết hợp trường ghi chú nghiệp vụ tự do:\n"
        "• Dropdown danh mục lý do chuẩn: `distance` (Vị trí thuận tiện hơn), `skill` (Chuyên môn phù hợp hơn), `customer_request` (Khách chỉ định quen), "
        "`time_constraint` (Ràng buộc đột xuất), `workload_balance` (Cân bằng tải nội bộ), `other` (Yêu cầu đặc biệt khác).\n"
        "• Trường ghi chú tự do: `override_notes` (Text) ghi nhận giải trình chi tiết của điều phối viên.\n"
        "• Toàn bộ thông tin can thiệp được lưu vết vĩnh viễn trong CSDL (cột `override_reason` bảng `assignments` và `recommendation_logs`) "
        "đáp ứng hoàn hảo tính giải trình (Explainability) và kiểm toán nghiệp vụ y tế."
    )

    # 3.9. Kết quả kiểm thử Unit Tests
    h2_39 = doc.add_heading(level=2)
    h2_39.paragraph_format.space_before = Pt(8)
    h2_39.paragraph_format.space_after = Pt(4)
    r_h2_39 = h2_39.add_run("3.9. Báo cáo Kết quả Kiểm thử Tự động (Unit Tests: 31/31 Passed - 100%)")
    r_h2_39.font.name = "Times New Roman"
    r_h2_39.font.color.rgb = NAVY_SECONDARY

    doc.add_paragraph(
        "Nhằm bảo đảm chất lượng phần mềm theo tiêu chuẩn ngành MIS và khắc phục triệt để mâu thuẫn số liệu test case theo feedback của Cô, "
        "toàn bộ 31 test cases (bao gồm các bài test mới về OSRM Routing và Override API) đã được thực thi kiểm thử hồi quy tự động "
        "qua pytest với kết quả 100% Passed:"
    )

    test_terminal_output = (
        "============================= test session starts =============================\n"
        "platform win32 -- Python 3.13.3, pytest-9.1.1, pluggy-1.7.0\n"
        "rootdir: D:\\New folder\\DOAN\\backend\n"
        "plugins: anyio-4.15.1, platformdirs-4.13.4\n"
        "collected 31 items\n\n"
        "tests/test_ai.py::test_ai_dataset_integrity PASSED                       [  3%]\n"
        "tests/test_ai.py::test_ai_model_artifact_load_and_inference PASSED       [  6%]\n"
        "tests/test_ai.py::test_ai_model_version_registry_in_db PASSED            [  9%]\n"
        "tests/test_ai.py::test_api_predict_duration_endpoint PASSED              [ 12%]\n"
        "tests/test_ai.py::test_api_ai_models_comparison_endpoint PASSED          [ 16%]\n"
        "tests/test_ai.py::test_safe_fallback_mechanism PASSED                    [ 19%]\n"
        "tests/test_api.py::test_health_check PASSED                              [ 22%]\n"
        "tests/test_api.py::test_auth_login_success PASSED                        [ 25%]\n"
        "tests/test_api.py::test_auth_login_invalid_password PASSED               [ 29%]\n"
        "tests/test_api.py::test_get_customers_and_employees PASSED               [ 32%]\n"
        "tests/test_api.py::test_get_services_and_skills PASSED                   [ 35%]\n"
        "tests/test_api.py::test_end_to_end_request_assignment_result_flow PASSED [ 38%]\n"
        "tests/test_api.py::test_override_reasons_dropdown_api PASSED             [ 41%]\n"
        "tests/test_api.py::test_human_in_the_loop_override_api PASSED            [ 45%]\n"
        "tests/test_constraints.py::test_hard_constraint_1_skill_matching PASSED  [ 48%]\n"
        "tests/test_constraints.py::test_hard_constraint_2_active_status PASSED   [ 51%]\n"
        "tests/test_constraints.py::test_hard_constraint_3_availability PASSED    [ 54%]\n"
        "tests/test_constraints.py::test_hard_constraint_4_no_schedule_overlap PASSED [ 58%]\n"
        "tests/test_constraints.py::test_hard_constraint_5_travel_feasibility PASSED [ 61%]\n"
        "tests/test_constraints.py::test_hard_constraint_6_daily_workload_limit PASSED [ 64%]\n"
        "tests/test_constraints.py::test_state_transitions PASSED                 [ 67%]\n"
        "tests/test_end_to_end_flow.py::test_complete_phase_f_closed_loop_workflow PASSED [ 70%]\n"
        "tests/test_routing.py::test_routing_nha_trang_real_locations PASSED      [ 74%]\n"
        "tests/test_routing.py::test_routing_cache_mechanism PASSED               [ 77%]\n"
        "tests/test_routing.py::test_routing_same_location PASSED                 [ 80%]\n"
        "tests/test_routing.py::test_routing_invalid_and_out_of_bounds_coordinates PASSED [ 83%]\n"
        "tests/test_routing.py::test_routing_fallback_haversine_accuracy PASSED   [ 87%]\n"
        "tests/test_scheduling.py::test_dss_scoring_computation PASSED            [ 90%]\n"
        "tests/test_scheduling.py::test_recommend_candidates_api PASSED           [ 93%]\n"
        "tests/test_scheduling.py::test_realtime_feasibility_check_api PASSED     [ 96%]\n"
        "tests/test_scheduling.py::test_ortools_global_schedule_optimization PASSED [100%]\n\n"
        "======================== 31 passed, 1 warning in 3.68s ========================"
    )
    add_code_block(doc, test_terminal_output)

    # ==========================================
    # PHẦN 4: KẾ HOẠCH TRIỂN KHAI ĐỢT 3
    # ==========================================
    h1_4 = doc.add_heading(level=1)
    h1_4.paragraph_format.space_before = Pt(14)
    h1_4.paragraph_format.space_after = Pt(6)
    r_h1_4 = h1_4.add_run("IV. KẾ HOẠCH TRIỂN KHAI ĐỢT 3 (GIAI ĐOẠN G: FRONTEND & HOÀN THIỆN)")
    r_h1_4.font.name = "Times New Roman"
    r_h1_4.font.color.rgb = NAVY_PRIMARY

    doc.add_paragraph(
        "Sau khi được Cô thông qua báo cáo tiến độ Đợt 2, em sẽ tiến hành ngay Giai đoạn G với 3 trọng tâm sau:\n"
        "1. Xây dựng ứng dụng Web Frontend hiện đại: Sử dụng React + Vite + TypeScript kết hợp bộ giao diện Ant Design và bản đồ Leaflet Map.\n"
        "2. Hiện thực hóa 5 màn hình tương tác cốt lõi theo Mục 13 của đề cương:\n"
        "   • Màn hình Tiếp nhận ca & Gợi ý AI (AI Recommendation): Hiển thị thời lượng AI dự đoán, danh sách Top-K nhân sự phù hợp, chi tiết điểm số từng tiêu chí và nút xác nhận phân công kèm lý do Override.\n"
        "   • Màn hình Bàn điều phối lịch biểu (Dispatch Board / Calendar): Trực quan hóa lịch trực theo ngày/tuần của từng điều dưỡng viên tại TP. Nha Trang.\n"
        "   • Màn hình Tối ưu hóa điều phối toàn ngày (OR-Tools Dashboard): Nút bấm kích hoạt solver OR-Tools tự động xếp lịch đồng loạt và hiển thị bảng so sánh KPI trước/sau tối ưu.\n"
        "   • Màn hình Bản đồ số GIS (Leaflet Map): Định vị vị trí bệnh nhân và lộ trình di chuyển của điều dưỡng viên.\n"
        "   • Màn hình Báo cáo Quản trị (Dashboard KPI): Thống kê tỷ lệ ca hoàn thành, đánh giá sự hài lòng và độ chính xác của mô hình AI.\n"
        "3. Đóng gói hệ thống & Viết thuyết minh tốt nghiệp: Đóng gói toàn bộ ứng dụng bằng Docker Compose (Database + Backend + Frontend), hoàn thiện bản thuyết minh luận văn (Chương 1 đến Chương 5) và chuẩn bị slide bảo vệ trước Hội đồng."
    )

    doc.add_paragraph().paragraph_format.space_after = Pt(16)
    p_sign = doc.add_paragraph()
    p_sign.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_sign.paragraph_format.space_after = Pt(2)
    r_sign1 = p_sign.add_run("Nha Trang, ngày 18 tháng 10 năm 2026\n")
    r_sign1.font.italic = True
    r_sign1.font.size = Pt(11)
    
    r_sign2 = p_sign.add_run("Sinh viên thực hiện\n\n\n\n")
    r_sign2.font.bold = True
    r_sign2.font.size = Pt(11)
    
    r_sign3 = p_sign.add_run("Nguyễn Thạch Thảo")
    r_sign3.font.bold = True
    r_sign3.font.size = Pt(12)
    r_sign3.font.color.rgb = NAVY_PRIMARY

    # Lưu tài liệu
    doc.save(str(OUTPUT_DOCX))
    print(f"-> Đã tạo thành công file báo cáo Word tại: {OUTPUT_DOCX}")
    print(f"-> Kích thước file: {os.path.getsize(OUTPUT_DOCX)} bytes")


if __name__ == "__main__":
    build_word_report()
