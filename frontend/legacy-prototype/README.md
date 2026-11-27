# Legacy prototype (không thuộc kiến trúc chính)

Thư mục này lưu lại máy chủ Express (`server.ts`), lớp Drizzle (`db/`), middleware và cấu hình Firebase
của **bản prototype đầu tiên**. Các file này chứa dữ liệu seed giả trong bộ nhớ và **không được dùng**
khi chạy hay demo hệ thống.

Kiến trúc chính duy nhất của CareFlow:

```
React (Vite, frontend/src) → FastAPI (/api/v1/...) → PostgreSQL → AI / DSS / OR-Tools
```

- `npm run dev` chạy Vite tại cổng 3000 và proxy `/api` sang FastAPI ở `http://localhost:8000` (xem `vite.config.ts`).
- Thư mục này bị loại khỏi `tsc` (xem `tsconfig.json`) và không được import từ `src/`.
- Chỉ để tham khảo lịch sử phát triển: `npm run legacy:prototype`.
