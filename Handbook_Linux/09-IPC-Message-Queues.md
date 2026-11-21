# 09. IPC - Message Queues (Hàng Đợi Thông Điệp)

> **Tài liệu tham khảo gốc:** `EMB_LINUX/09-IPC-Message-Queues/README.md`  
> **Chủ đề:** Giới thiệu tổng quan phân loại IPC, Bản chất Message Queue, Hàng đợi thông điệp System V (`msgget`, `msgsnd`, `msgrcv`, `msgctl`), Hàng đợi thông điệp POSIX (`mq_open`, `mq_send`, `mq_receive`, `mq_notify`), Độ ưu tiên thông điệp, Bảng so sánh System V vs POSIX Message Queues.

---

## 9.1. Tổng Quan về Phân Loại IPC trong Linux

Các cơ chế giao tiếp liên tiến trình (IPC) trong Linux được chia thành 3 nhóm chức năng chính:

```
                                  CƠ CHẾ IPC
                                      |
         +----------------------------+----------------------------+
         |                                                         |
  [TRUYỀN DỮ LIỆU - Data Transfer]                         [ĐỒNG BỘ HÓA - Sync]
  1. Byte Stream:                                           1. Semaphore (SysV / POSIX)
     - Anonymous Pipe                                       2. File Locks (flock / fcntl)
     - Named Pipe (FIFO)                                    3. Mutex & Condition Variables
     - Stream Socket (TCP / AF_UNIX)
  2. Message:
     - System V Message Queue
     - POSIX Message Queue
     - Datagram Socket (UDP / AF_UNIX)
  3. Shared Memory:
     - System V Shared Memory
     - POSIX Shared Memory
```

### 9.1.1. Message Queue (Hàng đợi thông điệp) là gì?
Message Queue là một danh sách liên kết các thông điệp được duy trì và quản lý trực tiếp bởi **Kernel**:
- **Truyền theo gói tin (Message-Oriented):** Khác với Pipe (Byte Stream vô định hình), Message Queue truyền nhận từng thông điệp hoàn chỉnh nguyên vẹn.
- **Bất đồng bộ (Asynchronous):** Tiến trình gửi có thể đẩy tin nhắn vào hàng đợi rồi thoát ngay mà không cần đợi tiến trình nhận đang chạy.
- **Có định danh loại hoặc độ ưu tiên:** Tin nhắn có thể được gắn nhãn (type/priority) để tiến trình nhận có thể chọn lọc thông điệp cần xử lý trước mà không bắt buộc phải lấy theo thứ tự vào trước ra trước thông thường.

---

## 9.2. System V Message Queues (Hàng Đợi Truyền Thống)

### 9.2.1. Năm Bước Thực Thi Cốt Lõi:
1. Tạo khóa `key_t` bằng hàm `ftok()`.
2. Tạo hoặc mở hàng đợi bằng `msgget()`.
3. Ghi thông điệp bằng `msgsnd()`.
4. Đọc thông điệp bằng `msgrcv()`.
5. Hủy hàng đợi bằng `msgctl(..., IPC_RMID, ...)`.

---

### 9.2.2. Các Hàm API và Cấu Trúc Dữ Liệu System V

#### 1. Cấu trúc Message Buffer:
Bắt buộc trường đầu tiên phải là `long mtype` (> 0):
```c
struct msg_buffer {
    long mtype;       /* Loại thông điệp, bắt buộc > 0 */
    char mtext[512];  /* Nội dung dữ liệu (kích thước tùy ý) */
};
```

#### 2. Các System Call:
```c
#include <sys/ipc.h>
#include <sys/msg.h>

// 1. Tạo Key duy nhất
key_t ftok(const char *pathname, int proj_id);

// 2. Tạo hoặc lấy ID hàng đợi
int msgget(key_t key, int msgflg); // msgflg: IPC_CREAT | 0666

// 3. Gửi thông điệp
int msgsnd(int msqid, const void *msgp, size_t msgsz, int msgflg);

// 4. Nhận thông điệp
ssize_t msgrcv(int msqid, void *msgp, size_t msgsz, long msgtyp, int msgflg);

// 5. Điều khiển / Xóa hàng đợi
int msgctl(int msqid, int cmd, struct msqid_ds *buf);
```

**Bộ lọc `msgtyp` trong `msgrcv()`:**
- `msgtyp == 0`: Lấy thông điệp đầu tiên trong hàng đợi (chuẩn FIFO).
- `msgtyp > 0`: Lấy thông điệp đầu tiên có `mtype` đúng bằng giá trị `msgtyp`.
- `msgtyp < 0`: Lấy thông điệp có `mtype` nhỏ nhất thỏa mãn `mtype <= |msgtyp|`.

---

### 9.2.3. Mã nguồn Mẫu System V Message Queue

#### Sender (Bên Gửi):
```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ipc.h>
#include <sys/msg.h>

struct msg_buffer {
    long mtype;
    char mtext[256];
};

int main() {
    key_t key = ftok("/tmp", 'A');
    int msgid = msgget(key, 0666 | IPC_CREAT);

    struct msg_buffer msg;
    msg.mtype = 1; // Loại tin nhắn = 1
    strcpy(msg.mtext, "Xin chào từ System V Sender!");

    if (msgsnd(msgid, &msg, strlen(msg.mtext) + 1, 0) == -1) {
        perror("Lỗi msgsnd");
        exit(1);
    }

    printf("[Sender] Đã gửi thông điệp: %s\n", msg.mtext);
    return 0;
}
```

#### Receiver (Bên Nhận):
```c
#include <stdio.h>
#include <stdlib.h>
#include <sys/ipc.h>
#include <sys/msg.h>

struct msg_buffer {
    long mtype;
    char mtext[256];
};

int main() {
    key_t key = ftok("/tmp", 'A');
    int msgid = msgget(key, 0666 | IPC_CREAT);

    struct msg_buffer msg;
    // Nhận thông điệp có mtype = 1
    if (msgrcv(msgid, &msg, sizeof(msg.mtext), 1, 0) == -1) {
        perror("Lỗi msgrcv");
        exit(1);
    }

    printf("[Receiver] Đã nhận: %s\n", msg.mtext);

    // Thu dọn hàng đợi khỏi hệ thống
    msgctl(msgid, IPC_RMID, NULL);
    printf("[Receiver] Đã xóa hàng đợi thành công.\n");
    return 0;
}
```

---

## 9.3. POSIX Message Queues (Chuẩn Hiện Đại Khuyên Dùng)

POSIX Message Queue sử dụng giao diện dạng file descriptor (`mqd_t`), tên bắt đầu bằng dấu gạch chéo `/` (ví dụ `/sensor_queue`), và hỗ trợ **độ ưu tiên thực sự (Priority)** cũng như **thông báo bất đồng bộ qua Signal (Asynchronous Notification)**.

### 9.3.1. Các Hàm API POSIX (`<mqueue.h>`)

```c
#include <fcntl.h>
#include <sys/stat.h>
#include <mqueue.h>

// Mở hoặc tạo hàng đợi
mqd_t mq_open(const char *name, int oflag, mode_t mode, struct mq_attr *attr);

// Gửi tin nhắn kèm độ ưu tiên (prio càng cao càng được xử lý trước)
int mq_send(mqd_t mqdes, const char *msg_ptr, size_t msg_len, unsigned int msg_prio);

// Nhận tin nhắn (luôn trả về tin nhắn có prio cao nhất trước)
ssize_t mq_receive(mqd_t mqdes, char *msg_ptr, size_t msg_len, unsigned int *msg_prio);

// Đóng file descriptor
int mq_close(mqd_t mqdes);

// Xóa hàng đợi khỏi hệ điều hành
int mq_unlink(const char *name);
```

Cấu trúc thuộc tính `struct mq_attr`:
```c
struct mq_attr {
    long mq_flags;    /* Cờ: 0 hoặc O_NONBLOCK */
    long mq_maxmsg;   /* Số lượng thông điệp tối đa trong queue (ví dụ: 10) */
    long mq_msgsize;  /* Kích thước tối đa của 1 thông điệp (bytes) */
    long mq_curmsgs;  /* Số lượng thông điệp hiện đang có trong queue */
};
```

---

### 9.3.2. Tính năng Nâng cao của POSIX Message Queue

#### 1. Thông báo Bất đồng bộ qua Signal (`mq_notify`):
Thay vì phải có một thread chạy vòng lặp vô tận để đọc queue, tiến trình có thể đăng ký nhận một signal (ví dụ `SIGUSR1`) khi có tin nhắn mới xuất hiện trong một queue rỗng:
```c
struct sigevent sev;
sev.sigev_notify = SIGEV_SIGNAL;
sev.sigev_signo = SIGUSR1;
mq_notify(mq, &sev);
```

#### 2. Thao tác có Thời gian chờ (Timeout):
Hỗ trợ `mq_timedsend()` và `mq_timedreceive()` với cấu trúc `struct timespec` tuyệt đối, giúp tránh việc ứng dụng bị treo (deadlock/hang) khi hàng đợi bị đầy hoặc không có dữ liệu.

---

## 9.4. Bảng So Sánh Chi Tiết: System V vs. POSIX Message Queues

| Đặc tính | System V Message Queue | POSIX Message Queue |
|:---|:---|:---|
| **Định danh** | Số nguyên `key_t` (tạo qua `ftok`) | Tên chuỗi ký tự dạng đường dẫn (Ví dụ: `/my_queue`) |
| **Kiểu Descriptor** | Số nguyên `msqid` | Kiểu dữ liệu trừu tượng `mqd_t` |
| **Độ ưu tiên (Priority)** | Không có priority thực thụ (chỉ lọc theo trường `mtype`) | Có trường Priority riêng (`0` đến `32767`), số lớn ưu tiên cao hơn |
| **Thông báo Async** | **Không hỗ trợ** (chỉ có blocking hoặc polling) | **Hỗ trợ mạnh mẽ** qua `mq_notify` (Signal / Thread) |
| **Thao tác có Timeout** | Không hỗ trợ native | Hỗ trợ `mq_timedsend()` và `mq_timedreceive()` |
| **Kiểm soát dung lượng** | Phụ thuộc tham số hệ thống toàn cục | Tự do cấu hình `mq_maxmsg` và `mq_msgsize` khi tạo |
| **Vị trí trên File System** | Ẩn trong kernel (xem bằng lệnh `ipcs -q`) | Xuất hiện trong Virtual FS `/dev/mqueue` (có thể xem bằng `ls`) |
| **Khuyến nghị sử dụng** | Duy trì mã nguồn cũ (Legacy systems) | **Dự án phát triển mới và hệ thống nhúng thời gian thực** |
