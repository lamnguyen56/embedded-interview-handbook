# 07. Dự Án Nhỏ: Ứng Dụng Chat Peer-to-Peer qua TCP/IP Socket (Chat Application)

> **Tài liệu tham khảo gốc:** `EMB_LINUX/07-Mini-Project-Chat-Application/README.md`  
> **Chủ đề:** Xây dựng ứng dụng Chat Peer-to-Peer (P2P) hoàn chỉnh bằng C trên Linux, Áp dụng đa luồng (POSIX Threads), Quản lý kết nối TCP Socket, An toàn luồng (Thread-Safety với Mutex), Giao diện dòng lệnh CLI.

---

## 7.1. Tổng Quan về Dự Án

Ứng dụng Chat P2P (Peer-to-Peer Chat Application) là một đồ án mẫu giúp củng cố toàn diện kiến thức về:
- Lập trình mạng Socket TCP/IP trên Linux (`socket`, `bind`, `listen`, `accept`, `connect`, `send`, `recv`).
- Mô hình vừa đóng vai trò **Server** (lắng nghe các kết nối từ bạn bè tới) vừa đóng vai trò **Client** (chủ động kết nối tới peer khác).
- Đa luồng (`pthread`): Mỗi kết nối được quản lý độc lập bởi một thread nhận dữ liệu ngầm mà không làm đơ giao diện gõ lệnh chính.
- Đồng bộ hóa dữ liệu danh sách kết nối bằng **Mutex**.
- Bắt tín hiệu `SIGINT` (Ctrl+C) để dọn dẹp sạch sẽ tài nguyên socket và bộ nhớ trước khi thoát.

---

## 7.2. Cấu Trúc Thư Mục Dự Án

```
07-Mini-Project-Chat-Application/
├── bin/            # Chứa file thực thi nhị phân (chat) sau khi build
├── inc/            # Các file header (.h)
│   ├── command.h   # Định nghĩa hàm và cấu trúc xử lý lệnh người dùng
│   ├── connection.h# Quản lý danh sách kết nối (struct Connection, mảng kết nối)
│   ├── message.h   # Hàm đóng gói và gửi/nhận tin nhắn
│   └── utils.h     # Các hàm tiện ích (lấy IP máy, validate port, format log)
├── log/            # Chứa file nhật ký lịch sử chat
├── obj/            # Chứa các file đối tượng (.o) trung gian
├── src/            # Mã nguồn C (.c)
│   ├── main.c      # Điểm bắt đầu chương trình, khởi tạo Server Listener Thread & CLI Loop
│   ├── command.c   # Xử lý các lệnh: help, myip, myport, connect, list, send, terminate, exit
│   ├── connection.c# Quản lý danh sách kết nối, mutex lock bảo vệ danh sách
│   ├── message.c   # Luồng nhận tin nhắn cho từng peer (Receiver Thread)
│   └── utils.c     # Triển khai các hàm tiện ích
├── Makefile        # Kịch bản tự động hóa bản dựng dự án
└── README.md       # Hướng dẫn sử dụng gốc tiếng Anh
```

---

## 7.3. Kiến Trúc Hoạt Động của Ứng Dụng

Ứng dụng chia thành 3 luồng logic chính:

```
+-------------------------------------------------------------------------+
|                              ỨNG DỤNG CHAT                              |
|                                                                         |
|  [1. MAIN THREAD - CLI Loop]                                            |
|  - Đọc lệnh từ bàn phím: connect, send, list, terminate, exit          |
|  - Gửi dữ liệu tới peer tương ứng                                       |
|                                                                         |
|  [2. LISTENER THREAD (Server)]                                          |
|  - Lắng nghe cổng nội bộ (Port chỉ định lúc chạy)                       |
|  - Khi có peer mới kết nối tới -> Thêm vào danh sách -> Tạo Receiver   |
|                                                                         |
|  [3. RECEIVER THREADS (Mỗi kết nối 1 Thread)]                           |
|  - Receiver Thread 1: Chặn trong recv() từ Peer A -> In ra màn hình    |
|  - Receiver Thread 2: Chặn trong recv() từ Peer B -> In ra màn hình    |
+-------------------------------------------------------------------------+
```

### An Toàn Luồng (Thread-Safety):
Danh sách kết nối `ConnectionList` (chứa Socket FD, IP, Port, Trạng thái) được chia sẻ giữa **Main Thread**, **Listener Thread** và các **Receiver Thread**. Do đó, mọi thao tác thêm mới, duyệt mảng hoặc xóa kết nối bắt buộc phải được bọc trong cặp:
```c
pthread_mutex_lock(&connection_mutex);
// Thao tác với danh sách kết nối...
pthread_mutex_unlock(&connection_mutex);
```

---

## 7.4. Hướng Dẫn Biên Dịch và Thực Thi

### 7.4.1. Biên dịch
Sử dụng Makefile được chuẩn bị sẵn:
```bash
make
```
File thực thi sẽ được tạo tại đường dẫn `bin/chat`.

### 7.4.2. Khởi chạy Ứng dụng
Chương trình yêu cầu truyền tham số số hiệu cổng (Port) mà ứng dụng sẽ mở để lắng nghe:
```bash
./bin/chat <PORT>
# Ví dụ chạy trên máy 1 mở cổng 8000:
./bin/chat 8000
```

---

## 7.5. Bảng Lệnh Điều Khiển trong Ứng Dụng

| Lệnh | Cú pháp | Ý nghĩa & Mô tả |
|:---|:---|:---|
| `help` | `help` | Hiển thị danh sách tất cả các lệnh hỗ trợ |
| `myip` | `myip` | In ra địa chỉ IP hiện tại của máy |
| `myport` | `myport` | In ra số hiệu cổng mà chương trình đang lắng nghe |
| `connect` | `connect <IP> <Port>` | Chủ động kết nối tới một peer khác qua IP và Port |
| `list` | `list` | Liệt kê tất cả các kết nối hiện đang hoạt động (Incoming & Outgoing) kèm ID |
| `send` | `send <ID> <Message>` | Gửi tin nhắn tới kết nối có số thứ tự `<ID>` tương ứng trong `list` |
| `terminate`| `terminate <ID>` | Đóng kết nối có số thứ tự `<ID>` và giải phóng thread |
| `exit` | `exit` | Đóng toàn bộ socket, giải phóng bộ nhớ và thoát an toàn |

---

## 7.6. Kịch Bản Sử Dụng Thực Tế (Walkthrough Demo)

### Bước 1: Khởi động Peer A (Cổng 8000)
```bash
$ ./bin/chat 8000
Chat application started on port 8000
Enter command: myip
Your IP address: 192.168.1.5
Enter command: myport
Your port: 8000
```

### Bước 2: Khởi động Peer B (Cổng 8001 trên máy 192.168.1.10)
```bash
$ ./bin/chat 8001
Chat application started on port 8001
```

### Bước 3: Peer A chủ động kết nối tới Peer B
```bash
Enter command: connect 192.168.1.10 8001
Connected to 192.168.1.10:8001
```

### Bước 4: Kiểm tra danh sách kết nối trên Peer A
```bash
Enter command: list
-------- Connection List --------
ID  |  IP Address        |  Port  |  Type
----------------------------------------
0   |  192.168.1.10      |  8001  |  Outgoing
----------------------------------------
Total: 1 connection(s)
```

### Bước 5: Peer A gửi tin nhắn sang Peer B
```bash
Enter command: send 0 Xin chao Peer B, day la tin nhan tu Peer A!
Message sent to connection 0.
```

### Bước 6: Phía màn hình Peer B tự động hiển thị:
```bash
***Message received from: 192.168.1.5
***Sender Port:          8000
-->Message:              Xin chao Peer B, day la tin nhan tu Peer A!
```

---

## 7.7. Kiểm Tra Rò Rỉ Bộ Nhớ với Valgrind

Để đảm bảo chương trình không bị rò rỉ bộ nhớ (Memory Leak) hoặc rò rỉ File Descriptor — một yêu cầu tối quan trọng trong các sản phẩm nhúng thương mại:
```bash
make valgrind
```
Valgrind sẽ theo dõi từng hàm `malloc`, `free`, `open`, `close`, `pthread_create`, `pthread_join` và đưa ra báo cáo tổng kết chi tiết khi thoát ứng dụng.
