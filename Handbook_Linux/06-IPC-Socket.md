# 06. IPC - Socket (Giao Tiếp Mạng và Socket Cục Bộ)

> **Tài liệu tham khảo gốc:** `EMB_LINUX/06-IPC-Socket/README.md`  
> **Chủ đề:** Khái niệm Socket, Socket Domains (`AF_UNIX` vs `AF_INET`), Socket Types (`SOCK_STREAM` vs `SOCK_DGRAM`), Thứ tự Byte & Endianness, Code mẫu chuẩn TCP Server/Client, UDP Server/Client, Unix Domain Sockets (Stream & Datagram), Peer Credentials, Truyền File Descriptor.

---

## 6.1. Giới thiệu về Cơ Chế Socket trong Linux

Socket là một trong những cơ chế giao tiếp liên tiến trình (IPC) mạnh mẽ và linh hoạt nhất trong hệ thống Linux. Điểm khác biệt lớn nhất giữa Socket và các cơ chế IPC khác (Pipes, Message Queues, Shared Memory) là: **Socket không chỉ giao tiếp giữa các tiến trình trên cùng một máy, mà còn giao tiếp xuyên suốt giữa các máy tính khác nhau qua mạng (Internet / LAN)**.

### 6.1.1. Khái niệm cốt lõi
- Mỗi socket được hệ điều hành biểu diễn dưới dạng một **File Descriptor (fd)**, cho phép lập trình viên sử dụng các hàm I/O quen thuộc (`read`, `write`, `close`) bên cạnh các API chuyên biệt (`send`, `recv`, `bind`, `listen`, `accept`).
- Một kết nối socket được định nghĩa bởi 3 yếu tố:
  1. **Domain (Họ địa chỉ):** Phạm vi giao tiếp (nội bộ hay qua mạng).
  2. **Type (Kiểu socket):** Cơ chế truyền tải dữ liệu (hướng luồng tin cậy hay hướng gói tin không tin cậy).
  3. **Protocol (Giao thức):** Quy định đóng gói gói tin thực tế (thường đặt là 0 để chọn mặc định).

---

### 6.1.2. Phân loại Socket Domains (Họ Địa Chỉ)

```
                       SOCKET DOMAINS
                             |
         +-------------------+-------------------+
         |                                       |
    [AF_UNIX / AF_LOCAL]                    [AF_INET / AF_INET6]
    - Giao tiếp cùng 1 máy                 - Giao tiếp qua mạng
    - Dùng đường dẫn file filesystem       - Dùng IP Address + Port
    - Nhanh vượt trội, zero network stack  - Có chi phí TCP/IP stack overhead
```

1. **UNIX Domain (`AF_UNIX` hoặc `AF_LOCAL`):**
   - Dùng riêng cho các tiến trình chạy trên **cùng một máy vật lý**.
   - Điểm kết nối được định danh bằng một file đặc biệt trong hệ thống tập tin (ví dụ `/tmp/app.sock`).
   - Hiệu năng cực cao vì dữ liệu được copy trực tiếp qua bộ đệm của Kernel, **không đi qua tầng giao thức mạng (Network Stack)**, không tốn chi phí checksum hay packet framing.
2. **Internet Domain (`AF_INET` cho IPv4, `AF_INET6` cho IPv6):**
   - Giao tiếp giữa các tiến trình qua mạng LAN, WAN hoặc Internet.
   - Định danh bởi sự kết hợp của **Địa chỉ IP (IP Address)** và **Số hiệu cổng (Port Number)**.

---

### 6.1.3. Phân loại Socket Types (Kiểu Socket)

| Đặc tính | Stream Socket (`SOCK_STREAM`) | Datagram Socket (`SOCK_DGRAM`) |
|:---|:---|:---|
| **Giao thức nền tảng** | TCP (Transmission Control Protocol) | UDP (User Datagram Protocol) |
| **Bản chất kết nối** | **Connection-oriented** (Bắt buộc thiết lập kết nối bắt tay 3 bước trước khi gửi data) | **Connectionless** (Không cần kết nối, gửi dữ liệu trực tiếp) |
| **Độ tin cậy (Reliability)** | Rất cao: Đảm bảo dữ liệu đến nơi, tự động phát hiện mất gói và gửi lại (Retransmission) | Không đảm bảo: Gói tin có thể bị mất, bị trùng lặp |
| **Thứ tự gói tin** | Đảm bảo tuần tự tuyệt đối (In-order delivery) | Không đảm bảo thứ tự (Gói gửi sau có thể tới trước) |
| **Biên giới thông điệp** | **Byte Stream:** Không có ranh giới tin nhắn (Ứng dụng phải tự định khung gói tin) | **Preserves Boundaries:** Giữ nguyên vẹn kích thước từng gói tin gửi |
| **Overhead & Tốc độ** | Overhead lớn hơn do kiểm soát luồng (Flow control) và bắt tay | Nhẹ, nhanh, độ trễ cực thấp (Low Latency) |
| **Ứng dụng thực tế** | Web (HTTP/HTTPS), File Transfer (FTP), Shell (SSH), Chat TCP | Streaming Video/Audio, DNS lookup, Cảm biến thời gian thực, CAN-over-Ethernet |

---

## 6.2. Luồng Hoạt Động (Communication Flow) của Socket

### 6.2.1. Luồng TCP Stream Socket (Client - Server)

```
        SERVER                                    CLIENT
   socket() [Tạo socket]                      socket() [Tạo socket]
      |                                          |
   bind() [Gắn IP:Port]                          |
      |                                          |
   listen() [Lắng nghe hàng đợi]                 |
      |                                          |
   accept() [Chặn chờ kết nối] <------------- connect() [Bắt tay 3 bước TCP]
      |                                          |
      | ===== KẾT NỐI ĐƯỢC THIẾT LẬP (TẠO FD MỚI CHO CLIENT) ===== |
      |                                          |
   recv() / read() <------------------------- send() / write()
      |                                          |
   send() / write() ------------------------> recv() / read()
      |                                          |
   close() [Đóng kết nối client]              close() [Đóng kết nối]
```

---

## 6.3. Thứ Tự Byte (Endianness) và Network Byte Order

### 6.3.1. Little-Endian vs. Big-Endian
- **Little-Endian:** Byte có trọng số thấp nhất (LSB) nằm ở địa chỉ bộ nhớ thấp nhất (Sử dụng phổ biến trên kiến trúc x86, x86-64, và hầu hết vi xử lý ARM hiện đại).
- **Big-Endian:** Byte có trọng số cao nhất (MSB) nằm ở địa chỉ bộ nhớ thấp nhất.
- **Network Byte Order:** Chuẩn quốc tế quy định dữ liệu truyền tải trên mạng máy tính **bắt buộc phải là Big-Endian**!

### 6.3.2. Bốn hàm chuyển đổi Byte Order cốt lõi (`<arpa/inet.h>`)
- `htons(val)`: **H**ost **TO** **N**etwork **S**hort (Chuyển số 16-bit, dùng cho **Port number**).
- `htonl(val)`: **H**ost **TO** **N**etwork **L**ong (Chuyển số 32-bit, dùng cho **IPv4 address**).
- `ntohs(val)`: **N**etwork **TO** **H**ost **S**hort (Giải mã Port từ mạng về máy).
- `ntohl(val)`: **N**etwork **TO** **H**ost **L**ong (Giải mã IP từ mạng về máy).

#### Chuyển đổi chuỗi IP sang dạng nhị phân:
- `inet_pton(AF_INET, "192.168.1.10", &addr.sin_addr)`: Chuyển chuỗi ASCII sang nhị phân (Presentation to Network).
- `inet_ntop(AF_INET, &addr.sin_addr, str, sizeof(str))`: Chuyển nhị phân sang chuỗi ASCII để in ra log.

---

## 6.4. Mã Nguồn Mẫu TCP Server & Client

### 6.4.1. TCP Server Hoàn Chỉnh (Echo Server)
```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <sys/socket.h>

#define PORT 8080
#define BUFFER_SIZE 1024

int main() {
    int server_fd, client_fd;
    struct sockaddr_in server_addr, client_addr;
    socklen_t client_len = sizeof(client_addr);
    char buffer[BUFFER_SIZE];

    // 1. Tạo TCP socket
    if ((server_fd = socket(AF_INET, SOCK_STREAM, 0)) < 0) {
        perror("Lỗi tạo socket");
        exit(EXIT_FAILURE);
    }

    // Cho phép tái sử dụng cổng ngay lập tức sau khi tắt server (Tránh TIME_WAIT)
    int opt = 1;
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    // 2. Cấu hình địa chỉ server
    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = htonl(INADDR_ANY); // Nhận kết nối trên mọi card mạng
    server_addr.sin_port = htons(PORT);             // Chuyển Port sang Network Byte Order

    // 3. Bind socket vào cổng
    if (bind(server_fd, (struct sockaddr *)&server_addr, sizeof(server_addr)) < 0) {
        perror("Lỗi bind");
        close(server_fd);
        exit(EXIT_FAILURE);
    }

    // 4. Lắng nghe kết nối (hàng đợi backlog tối đa 5 client chờ)
    if (listen(server_fd, 5) < 0) {
        perror("Lỗi listen");
        close(server_fd);
        exit(EXIT_FAILURE);
    }

    printf("[TCP Server] Đang lắng nghe trên cổng %d...\n", PORT);

    while (1) {
        // 5. Chấp nhận kết nối từ client
        client_fd = accept(server_fd, (struct sockaddr *)&client_addr, &client_len);
        if (client_fd < 0) {
            perror("Lỗi accept");
            continue;
        }

        char client_ip[INET_ADDRSTRLEN];
        inet_ntop(AF_INET, &client_addr.sin_addr, client_ip, sizeof(client_ip));
        printf("[TCP Server] Client kết nối từ: %s:%d\n", client_ip, ntohs(client_addr.sin_port));

        // 6. Nhận dữ liệu từ client
        ssize_t bytes_read = recv(client_fd, buffer, sizeof(buffer) - 1, 0);
        if (bytes_read > 0) {
            buffer[bytes_read] = '\0';
            printf("[Nhận]: %s\n", buffer);

            // Phản hồi ngược lại (Echo)
            send(client_fd, buffer, bytes_read, 0);
        }

        close(client_fd); // Đóng phiên với client này
    }

    close(server_fd);
    return 0;
}
```

### 6.4.2. TCP Client Hoàn Chỉnh
```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <sys/socket.h>

#define SERVER_IP "127.0.0.1"
#define PORT 8080
#define BUFFER_SIZE 1024

int main() {
    int sock_fd;
    struct sockaddr_in server_addr;
    char buffer[BUFFER_SIZE] = "Xin chào từ TCP Client Embedded Linux!";

    // 1. Tạo socket
    if ((sock_fd = socket(AF_INET, SOCK_STREAM, 0)) < 0) {
        perror("Lỗi tạo socket");
        return 1;
    }

    // 2. Cấu hình thông tin server đích
    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(PORT);
    inet_pton(AF_INET, SERVER_IP, &server_addr.sin_addr);

    // 3. Kết nối tới server
    if (connect(sock_fd, (struct sockaddr *)&server_addr, sizeof(server_addr)) < 0) {
        perror("Lỗi kết nối tới Server");
        close(sock_fd);
        return 1;
    }

    printf("Đã kết nối thành công tới %s:%d\n", SERVER_IP, PORT);

    // 4. Gửi dữ liệu
    send(sock_fd, buffer, strlen(buffer), 0);
    printf("Đã gửi: %s\n", buffer);

    // 5. Nhận phản hồi
    ssize_t bytes = recv(sock_fd, buffer, sizeof(buffer) - 1, 0);
    if (bytes > 0) {
        buffer[bytes] = '\0';
        printf("Server phản hồi (Echo): %s\n", buffer);
    }

    close(sock_fd);
    return 0;
}
```

---

## 6.5. Unix Domain Sockets (IPC Siêu Tốc Cục Bộ)

Unix Domain Socket (`AF_UNIX`) sử dụng cùng bộ API với Network Socket nhưng hoạt động hoàn toàn cục bộ thông qua một file socket trong hệ thống tập tin (File System Pathname).

### 6.5.1. Cấu trúc địa chỉ Unix Domain Socket
```c
#include <sys/un.h>

struct sockaddr_un {
    sa_family_t sun_family;    /* Luôn là AF_UNIX */
    char sun_path[108];        /* Đường dẫn file socket (ví dụ: /tmp/my_app.sock) */
};
```

> [!IMPORTANT]
> Khi bind Unix Domain Socket, một file socket đặc biệt sẽ được tạo ra trên đĩa. Khi tắt chương trình, **file này không tự động biến mất**! Trước khi gọi `bind()`, lập trình viên bắt buộc phải gọi `unlink("/tmp/my_app.sock")` để xóa file cũ, nếu không sẽ bị lỗi `EADDRINUSE (Address already in use)`.

### 6.5.2. Tính Năng Độc Quyền của Unix Domain Socket trong Embedded Linux
1. **Bảo mật phân quyền (Filesystem Permissions):** Có thể dùng `chmod` và `chown` trên file socket để giới hạn chỉ cho phép tiến trình chạy với user/group nhất định mới được phép kết nối.
2. **Xác thực danh tính tiến trình (Peer Credentials - `SO_PEERCRED`):**
   Server có thể trực tiếp hỏi Kernel xem tiến trình client đang kết nối tới có PID, UID, GID là bao nhiêu thông qua `getsockopt()`:
   ```c
   struct ucred cred;
   socklen_t len = sizeof(cred);
   getsockopt(client_fd, SOL_SOCKET, SO_PEERCRED, &cred, &len);
   printf("Client có PID = %d, UID = %d, GID = %d\n", cred.pid, cred.uid, cred.gid);
   ```
3. **Truyền File Descriptor giữa các tiến trình độc lập:**
   Thông qua cấu trúc `struct msghdr` và cờ điều khiển `SCM_RIGHTS`, một tiến trình có thể chuyển giao quyền truy cập của một file, socket hoặc driver `/dev` đang mở cho một tiến trình khác mà không cần tiến trình kia phải tự mở file!
