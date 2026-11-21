# 12. Đồ Án Cuối Khóa: Hệ Thống Giám Sát Cảm Biến Gateway (Sensor Gateway System)

> **Tài liệu tham khảo gốc:** `EMB_LINUX/12-Final-Project-Sensor-Monitoring-System/README.md`  
> **Chủ đề:** Thiết kế kiến trúc Hệ thống Nhúng thực tế kết hợp Đa luồng (Multi-threading), Đa tiến trình (Multi-processing), Hàng đợi bộ đệm dùng chung an toàn (Thread-safe Shared Buffer), Cơ sở dữ liệu SQLite3, và Ghi nhật ký (Logging) qua IPC.

---

## 12.1. Tổng Quan về Hệ Thống

Dự án **Sensor Gateway System** mô phỏng một Gateway công nghiệp trong thực tế:
- Thu thập dữ liệu nhiệt độ từ nhiều nút cảm biến (Sensor Nodes) thông qua mạng kết nối TCP/IP.
- Xử lý dữ liệu thời gian thực: tính toán giá trị trung bình động (Running Average) và phát hiện các điều kiện bất thường (Quá nhiệt độ ngưỡng cảnh báo).
- Lưu trữ dữ liệu lịch sử vào cơ sở dữ liệu quan hệ **SQLite3**.
- Sử dụng tiến trình riêng biệt (Log Process) để ghi nhật ký hệ thống độc lập qua cơ chế IPC, tránh làm nghẽn tiến trình xử lý chính.

---

## 12.2. Kiến Trúc Đa Luồng & Đa Tiến Trình (System Architecture)

Hệ thống được thiết kế theo mô hình phân tách trách nhiệm cao:

```
+--------------------------------------------------------------------------------+
|                        MAIN PROCESS (Tiến trình chính)                         |
|                                                                                |
|  +---------------------+                                                       |
|  | Connmgr Thread      | <=== Thu thập dữ liệu nhiệt độ từ các Sensor Nodes   |
|  | (Quản lý kết nối)  |      qua kết nối TCP Socket                            |
|  +---------------------+                                                       |
|             |                                                                  |
|             v (Ghi dữ liệu mới vào)                                            |
|  ==============================================================                |
|       THREAD-SAFE SHARED BUFFER (Bộ đệm dùng chung có Mutex & Cond)            |
|  ==============================================================                |
|        /              \                                                        |
|       v (Đọc dữ liệu)  v (Đọc dữ liệu)                                         |
|  +-------------------+  +---------------------+                                |
|  | Datamgr Thread    |  | Storage Mgr Thread  |                                |
|  | (Tính trung bình, |  | (Ghi dữ liệu vào CSDL|                               |
|  |  cảnh báo nhiệt)  |  |  SQLite sensor.db)  |                                |
|  +-------------------+  +---------------------+                                |
+--------------------------------------------------------------------------------+
                                |
                                | IPC (Pipe / FIFO / Socket)
                                v
+--------------------------------------------------------------------------------+
|                         LOG PROCESS (Tiến trình Ghi Log)                       |
|  - Nhận sự kiện log từ Main Process và ghi tuần tự vào file gateway.log        |
+--------------------------------------------------------------------------------+
```

### Các thành phần chính:

1. **Main Process (Tiến trình chính):**
   - **Connection Manager Thread (`connmgr`):** Lắng nghe cổng mạng TCP Server, chấp nhận các sensor node kết nối tới, nhận các gói dữ liệu nhị phân (Sensor ID, Temperature, Timestamp) và đẩy vào Shared Buffer.
   - **Data Manager Thread (`datamgr`):** Đọc dữ liệu từ Shared Buffer, lưu trữ vào cấu trúc danh sách liên kết để tính trung bình động của 10 lần đo gần nhất của từng sensor. Nếu nhiệt độ vượt quá ngưỡng (ví dụ > 35°C), kích hoạt cảnh báo.
   - **Storage Manager Thread (`sensor_db`):** Đọc dữ liệu từ Shared Buffer, tạo bảng SQL và thực thi câu lệnh chèn (`INSERT INTO sensor_data`) vào cơ sở dữ liệu SQLite3.
   - **Thread-safe Shared Buffer (`sbuffer`):** Hàng đợi FIFO dùng chung giữa 3 thread, được bảo vệ nghiêm ngặt bằng `pthread_mutex_t` và `pthread_cond_t` để đảm bảo bài toán Producer-Consumer không bao giờ bị Race Condition hay Deadlock.

2. **Log Process (Tiến trình ghi Log):**
   - Được tạo ra bằng `fork()` từ lúc khởi động.
   - Nhận thông điệp sự kiện từ Main Process thông qua **Pipe / FIFO** (ví dụ: sensor kết nối mới, sensor mất kết nối, cảnh báo quá nhiệt, ghi database thành công).
   - Đảm bảo việc ghi file I/O ổ đĩa nặng nề không làm chậm luồng xử lý dữ liệu thời gian thực của Gateway.

---

## 12.3. Cấu Trúc Mã Nguồn Dự Án

- `config.h`: Các hằng số cấu hình toàn hệ thống (Cổng TCP, Ngưỡng nhiệt độ min/max, Tên file DB, Tên file Log).
- `sbuffer.h / sbuffer.c`: Triển khai cấu trúc danh sách liên kết Thread-safe Shared Buffer.
- `connmgr.h / connmgr.c`: Quản lý mạng TCP Server và giao tiếp cảm biến.
- `datamgr.h / datamgr.c`: Thuật toán phân tích dữ liệu nhiệt độ.
- `sensor_db.h / sensor_db.c`: Tầng trừu tượng tương tác với thư viện C của SQLite3.
- `log.h / log.c`: Quản lý tiến trình Log Process và đường ống IPC.
- `main.c`: Khởi tạo hệ thống, tạo luồng, đồng bộ hóa quá trình dừng hệ thống an toàn (Graceful Shutdown).

---

## 12.4. Các Kỹ Thuật Nổi Bật Phỏng Vấn Cần Nhấn Mạnh

1. **Tại sao lại tách Log ra làm Process riêng thay vì 1 Thread?**
   - **Cách ly rủi ro (Fault Isolation):** Nếu luồng ghi log gặp sự cố hoặc phân vùng đĩa bị nghẽn I/O, nó không làm treo toàn bộ Gateway thu thập dữ liệu thời gian thực.
   - Minh họa xuất sắc khả năng phối hợp **vừa Multi-thread vừa Multi-process**.

2. **Cách giải quyết bài toán Shared Buffer giữa 1 Producer và 2 Consumers:**
   - Cần cơ chế đánh dấu cờ để cả `datamgr` và `storage_mgr` đều đọc được gói tin đó trước khi nó bị xóa khỏi Buffer (Reference Counting hoặc cờ đã đọc).

3. **Cơ chế Graceful Shutdown:**
   - Bắt tín hiệu `SIGINT` (Ctrl+C).
   - Đóng cổng TCP để không nhận thêm sensor mới.
   - Đẩy tín hiệu kết thúc (Dummy End-of-Stream packet) vào Shared Buffer để các Worker Thread đọc hết dữ liệu còn tồn đọng rồi tự thoát an toàn.
   - Đóng kết nối SQLite, đóng đầu ghi Pipe để Log Process nhận EOF và kết thúc.
   - Tiến trình cha gọi `waitpid()` thu dọn Log Process, cam kết 0% Memory Leak và 0% Zombie Process.
