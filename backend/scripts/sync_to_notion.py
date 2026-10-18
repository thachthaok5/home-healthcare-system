"""
Script: sync_to_notion.py
Mục đích:
- Đồng bộ danh sách 10 Task ngày 18/10/2026 (theo feedback Đợt 2 - Lần 3 của GVHD)
  trực tiếp vào Database Notion của bạn.
- Tự động điền đầy đủ các thuộc tính (Properties) và tạo nội dung chi tiết (Page Body)
  gồm: Mục tiêu, Căn cứ feedback, Checklist công việc.
"""

import os
import sys
import csv
import json
from pathlib import Path
import httpx

if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

NOTION_VERSION = "2022-06-28"


def get_task_details(task_name: str, desc: str, ref: str) -> list:
    """Tạo các block nội dung chi tiết cho từng Notion Page"""
    return [
        {
            "object": "block",
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{"type": "text", "text": {"content": "📌 Mục tiêu & Nội dung thực hiện"}}]
            }
        },
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{"type": "text", "text": {"content": desc}}]
            }
        },
        {
            "object": "block",
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{"type": "text", "text": {"content": "📋 Căn cứ Feedback GVHD (TS. Trịnh Thị Ngọc Thúy)"}}]
            }
        },
        {
            "object": "block",
            "type": "callout",
            "callout": {
                "icon": {"type": "emoji", "emoji": "💡"},
                "rich_text": [{"type": "text", "text": {"content": f"Yêu cầu đối chiếu: {ref} trong tài liệu Feedback Đợt 2 (Lần 3)."}}]
            }
        },
        {
            "object": "block",
            "type": "heading_3",
            "heading_3": {
                "rich_text": [{"type": "text", "text": {"content": "✅ Tiêu chí nghiệm thu (Checklist)"}}]
            }
        },
        {
            "object": "block",
            "type": "to_do",
            "to_do": {
                "rich_text": [{"type": "text", "text": {"content": "Kiểm tra tính nhất quán với CSDL PostgreSQL và source code."}}],
                "checked": True
            }
        },
        {
            "object": "block",
            "type": "to_do",
            "to_do": {
                "rich_text": [{"type": "text", "text": {"content": "Cập nhật vào Báo cáo Word luận văn tốt nghiệp."}}],
                "checked": False
            }
        }
    ]


def sync_tasks(token: str, database_id: str):
    token = token.strip()
    database_id = database_id.strip().replace("-", "")
    # Format UUID 8-4-4-4-12
    formatted_db_id = f"{database_id[:8]}-{database_id[8:12]}-{database_id[12:16]}-{database_id[16:20]}-{database_id[20:]}"

    headers = {
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json"
    }

    csv_path = Path(__file__).resolve().parent.parent.parent / "docs" / "huong_dan" / "Notion_Tasks_2026-10-18.csv"
    if not csv_path.exists():
        print(f"Lỗi: Không tìm thấy file CSV tại {csv_path}")
        return False

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        tasks = list(reader)

    print(f"-> Đã đọc {len(tasks)} tasks từ CSV.")
    print(f"-> Đang kết nối tới Database Notion: {formatted_db_id}...")

    success_count = 0
    with httpx.Client(timeout=15.0) as client:
        for t in tasks:
            page_payload = {
                "parent": {"database_id": formatted_db_id},
                "properties": {
                    "Tên": {
                        "title": [{"text": {"content": t["Task Name"]}}]
                    },
                    "Phân loại": {
                        "select": {"name": t["Category"]}
                    },
                    "Ưu tiên": {
                        "select": {"name": t["Priority"]}
                    },
                    "Trạng thái": {
                        "select": {"name": t["Status"]}
                    },
                    "Ngày": {
                        "date": {"start": t["Date"]}
                    },
                    "Căn cứ Feedback": {
                        "rich_text": [{"text": {"content": t["Feedback Reference"]}}]
                    },
                    "Thẻ": {
                        "multi_select": [
                            {"name": t["Category"][:20]},
                            {"name": t["Priority"]}
                        ]
                    }
                },
                "children": get_task_details(t["Task Name"], t["Description"], t["Feedback Reference"])
            }

            resp = client.post("https://api.notion.com/v1/pages", headers=headers, json=page_payload)
            if resp.status_code in [200, 201]:
                success_count += 1
                print(f"   [SUCCESS] {t['Task Name'][:55]}...")
            else:
                print(f"   [FAILED] {t['Task Name'][:30]} - Status: {resp.status_code} - {resp.text}")

    print("\n" + "="*70)
    print(f"🎉 HOÀN TẤT ĐỒNG BỘ! Đã thêm thành công {success_count}/{len(tasks)} tasks vào Notion Database của bạn!")
    print("="*70)
    return success_count == len(tasks)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        token = os.getenv("NOTION_TOKEN", "")
        db_id = os.getenv("NOTION_DB_ID", "3ed747b902a280f1a4cce47ae406831c")
        if not token:
            print("Vui lòng cung cấp NOTION_TOKEN qua biến môi trường hoặc tham số dòng lệnh:")
            print("Usage: python sync_to_notion.py <NOTION_TOKEN> <NOTION_DB_ID>")
            sys.exit(1)
        token = sys.argv[1]
        db_id = sys.argv[2]

    sync_tasks(token, db_id)
