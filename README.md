# Interior Walkthrough — Thiết kế nội thất

Trang web phong cách "scroll-driven cinematic" giống opencudem.org, chủ đề thiết kế nội thất.
Cuộn chuột để đi qua video walkthrough (78s, 24fps, 720p).

## Chạy locally (BẮT BUỘC dùng server hỗ trợ Range)

Video cần HTTP Range requests để seek được. **Không dùng** `python -m http.server` (không hỗ trợ Range → video không chạy).

### Cách 1 — serve.py (khuyến nghị, Python)
```powershell
cd d:/code/interior-scroll
python serve.py
```
Mở http://localhost:8765

### Cách 2 — npx serve (Node.js)
```powershell
cd d:/code/interior-scroll
npx --yes serve -l 8765
```
Mở http://localhost:8765

### Cách 3 — VS Code Live Server
Cài extension Live Server → chuột phải `index.html` → Open with Live Server.

## Kiểm tra Range (tuỳ chọn)
```powershell
python -c "import urllib.request; r=urllib.request.urlopen(urllib.request.Request('http://localhost:8765/assets/walkthrough.mp4', headers={'Range':'bytes=0-100'})); print(r.status, r.headers.get('Content-Range'))"
```
Phải trả `206 bytes 0-100/...`. Nếu trả `200` → server không hỗ trợ Range.

## Cấu trúc
- `index.html` — khung trang, stage, controls, dialog.
- `cinematic.css` — giao diện cinematic, grain, fade chapter.
- `cinematic.js` — scroll → currentTime video, vẽ frame lên canvas, easing, reduced motion.
- `manifest.json` — fps, frameCount, video, posters, chapters.
- `assets/walkthrough.mp4` — video đã encode web-friendly (gop 12, faststart).
- `assets/poster-*.jpg` — ảnh fallback.
- `serve.py` — HTTP server hỗ trợ Range để test local.

## Tuỳ biến
- Sửa `manifest.json` → `chapters` để đổi text/điểm bắt đầu (start: 0..1).
- Thay video: encode lại với ffmpeg (720p, 24fps, gop 12, +faststart), cập nhật duration/fps/frameCount.
- Nút "Bật âm thanh" chỉ toggle mute của video (audio đã tách khỏi file để giảm size).

## Hỗ trợ
- `prefers-reduced-motion`: tự bật "Giảm chuyển động".
- Fallback ảnh tĩnh nếu seek chậm (>8 lần >300ms).
- Hộp debug góc dưới-trái hiển thị trạng thái (sẽ gỡ khi release).
