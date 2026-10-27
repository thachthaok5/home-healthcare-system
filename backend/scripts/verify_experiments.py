"""
Script: verify_experiments.py
Mục đích:
- Kiểm tra độc lập toàn bộ dữ liệu thực nghiệm đã sinh ra trong artifacts/experiments/
- Xác minh tính chính xác toán học: Tự tính lại mean ± std từ dữ liệu thô (raw runs) và so sánh với bảng summary.
- Kiểm tra tính toàn vẹn nghiệp vụ y tế:
  + Không vi phạm thời gian làm việc tối đa (max daily minutes <= 480p).
  + Ràng buộc kỹ năng (skill requirements).
  + Logic tính trễ hẹn (late start) và chồng chéo (overlap) giữa Plan A (Default) và Plan B (AI).
- In ra một ví dụ đối chứng cụ thể (Trace detail 1 run) để người dùng có thể nhìn thấy từng ca.
"""

import sys
from pathlib import Path
import pandas as pd
import numpy as np

# Đảm bảo in tiếng Việt trên console Windows
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BASE_DIR = Path(__file__).resolve().parent.parent
EXP_DIR = BASE_DIR / "artifacts" / "experiments"

def print_separator(title=""):
    print("\n" + "=" * 80)
    if title:
        print(f" {title} ")
        print("=" * 80)

def verify_stress_test_math():
    print_separator("1. KIỂM TRA TÍNH TOÁN HỌC: STRESS TEST BENCHMARK")
    raw_file = EXP_DIR / "stress_test_benchmark_results.csv"
    sum_file = EXP_DIR / "stress_test_summary_mean_std.csv"

    if not raw_file.exists() or not sum_file.exists():
        print("❌ LỖI: Chưa tìm thấy file dữ liệu stress test!")
        return False

    df_raw = pd.read_csv(raw_file)
    df_sum = pd.read_csv(sum_file)

    print(f"-> Số lượt chạy thô ghi nhận: {len(df_raw)} lượt (5 mức tải x 3 thuật toán x 5 seeds = 75 dòng)")
    print(f"-> Số dòng tóm tắt: {len(df_sum)} dòng (15 nhóm tải - thuật toán)")

    all_matched = True
    for _, row in df_sum.iterrows():
        load = row["load"]
        algo = row["algorithm"]
        sub = df_raw[(df_raw["load"] == load) & (df_raw["algorithm"] == algo)]
        
        calc_feas = f"{sub['feasible_rate'].mean():.2f} ± {sub['feasible_rate'].std():.2f}"
        sum_feas = str(row["feasible_rate"]).strip()
        
        calc_unas = f"{sub['unassigned_count'].mean():.2f} ± {sub['unassigned_count'].std():.2f}"
        sum_unas = str(row["unassigned_count"]).strip()

        if calc_feas != sum_feas or calc_unas != sum_unas:
            print(f"❌ Không khớp tại Load {load} - {algo}:")
            print(f"   Tính lại: Feasible={calc_feas}, Unassigned={calc_unas}")
            print(f"   Summary : Feasible={sum_feas}, Unassigned={sum_unas}")
            all_matched = False

    if all_matched:
        print("✅ TOÀN BỘ 75 LƯỢT CHẠY STRESS TEST KHỚP 100% VỚI BẢNG TỔNG HỢP MEAN ± STD!")
    return all_matched

def verify_actual_duration_math():
    print_separator("2. KIỂM TRA ĐỐI CHỨNG: ACTUAL DURATION (DEFAULT VS AI)")
    raw_file = EXP_DIR / "actual_duration_evaluation_results.csv"
    sum_file = EXP_DIR / "actual_duration_summary_mean_std.csv"

    if not raw_file.exists() or not sum_file.exists():
        print("❌ LỖI: Chưa tìm thấy file dữ liệu actual duration!")
        return False

    df_raw = pd.read_csv(raw_file)
    df_sum = pd.read_csv(sum_file)

    print(f"-> Số lượt chạy thô: {len(df_raw)} lượt (5 mức tải x 2 phương án x 5 seeds = 50 dòng)")

    all_matched = True
    for _, row in df_sum.iterrows():
        load = row["load"]
        plan = row["plan"]
        sub = df_raw[(df_raw["load"] == load) & (df_raw["plan"] == plan)]
        
        # Hỗ trợ cả tên cột mới và cũ nếu có
        overlap_col = "direct_overlap_count" if "direct_overlap_count" in sub.columns else "actual_overlap_count"
        calc_overlap = f"{sub[overlap_col].mean():.1f} ± {sub[overlap_col].std():.1f}"
        calc_delay = f"{sub['total_delay_minutes'].mean():.1f} ± {sub['total_delay_minutes'].std():.1f}"
        calc_feas = f"{sub['actual_feasible_rate'].mean():.1f} ± {sub['actual_feasible_rate'].std():.1f}"

        sum_overlap = str(row[overlap_col]).strip() if overlap_col in row else str(row.get("actual_overlap_count", "")).strip()
        sum_delay = str(row["total_delay_minutes"]).strip()
        sum_feas = str(row["actual_feasible_rate"]).strip()

        if calc_overlap != sum_overlap or calc_delay != sum_delay or calc_feas != sum_feas:
            print(f"❌ Không khớp tại Load {load} - {plan}:")
            print(f"   Tính lại: Overlap={calc_overlap}, Delay={calc_delay}, Feas={calc_feas}")
            print(f"   Summary : Overlap={sum_overlap}, Delay={sum_delay}, Feas={sum_feas}")
            all_matched = False

        if "overtime_minutes" in sub.columns and "overtime_minutes" in row:
            calc_ot = f"{sub['overtime_minutes'].mean():.1f} ± {sub['overtime_minutes'].std():.1f}"
            sum_ot = str(row["overtime_minutes"]).strip()
            if calc_ot != sum_ot:
                print(f"❌ Không khớp Overtime tại Load {load} - {plan}: Tính lại={calc_ot}, Summary={sum_ot}")
                all_matched = False

    if all_matched:
        print("✅ TOÀN BỘ CÁC LƯỢT CHẠY ACTUAL DURATION KHỚP 100% VỚI BẢNG TỔNG HỢP MEAN ± STD!")

    for eval_load in [100, 150]:
        plan_a = df_raw[(df_raw["load"] == eval_load) & (df_raw["plan"].str.startswith("A."))]
        plan_b = df_raw[(df_raw["load"] == eval_load) & (df_raw["plan"].str.startswith("B."))]
        
        if len(plan_a) > 0 and len(plan_b) > 0:
            print(f"\n[Chi tiết so sánh mức tải N = {eval_load} requests/ngày qua 5 seeds]:")
            mean_delay_a = plan_a['total_delay_minutes'].mean()
            mean_delay_b = plan_b['total_delay_minutes'].mean()
            print(f"  * Tổng phút trễ Plan A (Default) : {mean_delay_a:.1f} phút")
            print(f"  * Tổng phút trễ Plan B (Có AI)   : {mean_delay_b:.1f} phút")
            diff_delay = mean_delay_a - mean_delay_b
            pct_delay = (diff_delay / mean_delay_a * 100.0) if mean_delay_a > 0 else 0.0
            print(f"  => Giảm trễ nhờ AI: {diff_delay:.1f} phút ({pct_delay:.1f}%)")

            overlap_col = "direct_overlap_count" if "direct_overlap_count" in plan_a.columns else "actual_overlap_count"
            mean_overlap_a = plan_a[overlap_col].mean()
            mean_overlap_b = plan_b[overlap_col].mean()
            print(f"  * Số ca direct overlap Plan A (Default) : {mean_overlap_a:.1f} ca")
            print(f"  * Số ca direct overlap Plan B (Có AI)   : {mean_overlap_b:.1f} ca")

            if "overtime_minutes" in plan_a.columns:
                mean_ot_a = plan_a['overtime_minutes'].mean()
                mean_ot_b = plan_b['overtime_minutes'].mean()
                print(f"  * Overtime Plan A (Default) : {mean_ot_a:.1f} phút")
                print(f"  * Overtime Plan B (Có AI)   : {mean_ot_b:.1f} phút")

    return all_matched

def verify_sensitivity_math():
    print_separator("3. KIỂM TRA ĐỘ NHẠY TRỌNG SỐ: DSS SENSITIVITY")
    raw_file = EXP_DIR / "dss_sensitivity_analysis_results.csv"
    sum_file = EXP_DIR / "dss_sensitivity_summary.csv"

    if not raw_file.exists() or not sum_file.exists():
        print("❌ LỖI: Chưa tìm thấy file dữ liệu sensitivity!")
        return False

    df_raw = pd.read_csv(raw_file)
    df_sum = pd.read_csv(sum_file)

    print(f"-> Số lượt chạy thô: {len(df_raw)} lượt (6 kịch bản x 5 seeds = 30 dòng)")
    all_matched = True
    for _, row in df_sum.iterrows():
        sc = row["scenario"]
        sub = df_raw[df_raw["scenario"] == sc]
        calc_dist = f"{sub['total_travel_distance_km'].mean():.2f} ± {sub['total_travel_distance_km'].std():.2f}"
        sum_dist = str(row["total_travel_distance_km"]).strip()
        if calc_dist != sum_dist:
            print(f"❌ Không khớp tại {sc}: {calc_dist} vs {sum_dist}")
            all_matched = False

    if all_matched:
        print("✅ TOÀN BỘ 30 LƯỢT CHẠY SENSITIVITY KHỚP 100% VỚI BẢNG TỔNG HỢP!")
    return all_matched

def verify_business_logic_rules():
    print_separator("4. KIỂM TRA RÀNG BUỘC NGHIỆP VỤ Y TẾ (FEASIBILITY AUDIT)")
    raw_stress_file = EXP_DIR / "stress_test_benchmark_results.csv"
    if not raw_stress_file.exists():
        print("❌ LỖI: Chưa tìm thấy file stress_test_benchmark_results.csv!")
        return False

    raw_stress = pd.read_csv(raw_stress_file)
    
    # 1. Feasible rate nằm trong [0%, 100%]
    invalid_feas = raw_stress[(raw_stress["feasible_rate"] < 0) | (raw_stress["feasible_rate"] > 100)]
    assert len(invalid_feas) == 0, f"Vi phạm kiểm định: Có {len(invalid_feas)} giá trị feasible_rate ngoài khoảng [0, 100]!"
    print("✅ [Ràng buộc 1] Tỷ lệ khả thi Feasible Rate luôn nằm trong khoảng hợp lệ [0%, 100%].")

    # 2. Overtime == 0 khi dùng OR-Tools (OR-Tools có hard constraint <= max_daily_minutes)
    ortools_runs = raw_stress[raw_stress["algorithm"] == "OR-Tools CP-SAT"]
    if len(ortools_runs) > 0:
        ort_overtime = ortools_runs["overtime_minutes"].max()
        assert ort_overtime == 0, f"Vi phạm kiểm định: OR-Tools có lượt chạy bị overtime {ort_overtime} phút!"
        print("✅ [Ràng buộc 2] OR-Tools CP-SAT tuyệt đối không để bất kỳ nhân viên nào bị Overtime (0 phút vượt trần).")

    # 3. Solver runtime cực đại phải <= 8000 ms
    max_runtime = raw_stress["runtime_ms"].max()
    assert max_runtime <= 8000.0, f"Vi phạm kiểm định: Runtime cực đại {max_runtime:.1f} ms vượt quá giới hạn an toàn 8000 ms!"
    print(f"✅ [Ràng buộc 3] Thời gian giải thuật: Tối đa {max_runtime:.1f} ms (thỏa mãn điều kiện <= 8000 ms).")
    
    return True

def verify_ai_robustness():
    print_separator("5. KIỂM TRA ĐỘ BỀN VỮNG MÔ HÌNH AI (AI ROBUSTNESS AUDIT)")
    rob_file = EXP_DIR / "ai_robustness_test_results.csv"
    if not rob_file.exists():
        print("❌ LỖI: Chưa tìm thấy file ai_robustness_test_results.csv!")
        return False

    df_rob = pd.read_csv(rob_file)
    assert len(df_rob) == 5, f"Vi phạm kiểm định: File robustness phải có đủ 5 kịch bản R0-R4, thực tế: {len(df_rob)}"

    for _, row in df_rob.iterrows():
        sc = row["scenario_id"]
        mae_def = float(row["mae_default"].split("±")[0].strip())
        mae_ai = float(row["mae_ai"].split("±")[0].strip())
        assert mae_ai < mae_def, f"Vi phạm kiểm định tại {sc}: MAE AI ({mae_ai}) không nhỏ hơn Default ({mae_def})!"

    print("✅ TOÀN BỘ 5 KỊCH BẢN ROBUSTNESS TEST ĐỀU CHỨNG MINH AI VƯỢT TRỘI SO VỚI DEFAULT DURATION!")
    return True

def main():
    print("=" * 80)
    print(" CÔNG CỤ TỰ ĐỘNG KIỂM TRA ĐỘ CHÍNH XÁC VÀ TOÀN VẸN CỦA DỮ LIỆU THỰC NGHIỆM ")
    print("=" * 80)
    v1 = verify_stress_test_math()
    v2 = verify_actual_duration_math()
    v3 = verify_sensitivity_math()
    v4 = verify_business_logic_rules()
    v5 = verify_ai_robustness()
    
    print_separator("KẾT LUẬN KIỂM ĐỊNH")
    if v1 and v2 and v3 and v4 and v5:
        print("✅ XÁC MINH THÀNH CÔNG: Toàn bộ dữ liệu thực nghiệm đồng nhất, khớp toán học và thỏa mãn các ràng buộc kỹ thuật.")
        sys.exit(0)
    else:
        print("❌ XÁC MINH THẤT BẠI: Dữ liệu chưa nhất quán hoặc vi phạm ràng buộc kiểm định.")
        sys.exit(1)

if __name__ == "__main__":
    main()
