# 10. IPC - Shared Memory (Bộ Nhớ Chia Sẻ)

> **Tài liệu tham khảo gốc:** `EMB_LINUX/10-IPC-Shared-Memory/README.md`  
> **Chủ đề:** Khái niệm Bộ nhớ chia sẻ (Shared Memory), Cơ chế Zero-copy và Tốc độ vượt trội, System V Shared Memory (`shmget`, `shmat`, `shmdt`, `shmctl`), POSIX Shared Memory (`shm_open`, `ftruncate`, `mmap`, `munmap`, `shm_unlink`), Thách thức đồng bộ hóa và Kỹ thuật kết hợp Semaphore/Mutex.

---

## 10.1. Giới thiệu về Bộ Nhớ Chia Sẻ (Shared Memory)

### 10.1.1. Shared Memory là gì?
Shared Memory là cơ chế IPC cho phép **hai hoặc nhiều tiến trình độc lập cùng ánh xạ và truy cập trực tiếp vào cùng một vùng nhớ vật lý (RAM)** trong hệ thống.

```
[Tiến trình A - Virtual Address]    [Tiến trình B - Virtual Address]
       \                                  /
        \                                /
         v                              v
     +--------------------------------------+
     |   VÙNG NHỚ VẬT LÝ DÙNG CHUNG TRÊN RAM |
     |      (Shared Physical Memory)        |
     +--------------------------------------+
```

### 10.1.2. Tại sao Shared Memory là cơ chế IPC NHANH NHẤT?
Trong tất cả các cơ chế IPC khác (Pipe, FIFO, Message Queue, Socket):
1. Tiến trình gửi ghi dữ liệu từ User Space vào Kernel Space buffer (**Copy lần 1** qua System Call).
2. Tiến trình nhận đọc dữ liệu từ Kernel Space buffer về User Space của mình (**Copy lần 2** qua System Call).
3. Tiêu tốn chi phí Context Switch giữa User Mode và Kernel Mode.

**Với Shared Memory:**
- Dữ liệu được ghi thẳng vào vùng nhớ RAM dùng chung. Ngay khi Tiến trình A vừa thay đổi 1 byte, Tiến trình B đã nhìn thấy sự thay đổi đó **tức thì (Zero-copy)**.
- **Không tốn thêm bất kỳ System Call nào** để copy dữ liệu qua lại giữa User Space và Kernel Space!

### 10.1.3. Nhược điểm chí mạng của Shared Memory
- **KHÔNG CÓ CƠ CHẾ ĐỒNG BỘ NỘI TẠI:** Bản thân Shared Memory không có hàng đợi, không tự động khóa. Nếu Tiến trình A đang ghi dở mà Tiến trình B đọc -> dữ liệu bị rác (Race Condition).
- **Bắt buộc phải kết hợp với cơ chế đồng bộ ngoài:** Trong thực tế, Shared Memory **luôn luôn đi kèm với Semaphore hoặc POSIX Mutex đặt trong shared memory** để bảo vệ truy cập đồng thời.

---

## 10.2. System V Shared Memory

System V quản lý các vùng nhớ chia sẻ bằng khóa số nguyên `key_t` và định danh `shmid`.

### 10.2.1. Sáu Bước Thực Thi:
1. `ftok()`: Tạo khóa `key_t`.
2. `shmget()`: Cấp phát vùng nhớ chia sẻ hoặc lấy ID vùng nhớ đã có.
3. `shmat()`: Ánh xạ (Attach) vùng nhớ vào không gian địa chỉ của tiến trình.
4. Đọc / Ghi dữ liệu trực tiếp qua con trỏ C.
5. `shmdt()`: Tách (Detach) vùng nhớ khỏi tiến trình.
6. `shmctl(..., IPC_RMID, ...)`: Đánh dấu xóa vùng nhớ khi không còn ai sử dụng.

### 10.2.2. Các System Call cốt lõi:
```c
#include <sys/ipc.h>
#include <sys/shm.h>

// Cấp phát segment
int shmget(key_t key, size_t size, int shmflg); // shmflg: IPC_CREAT | 0666

// Ánh xạ vào con trỏ
void *shmat(int shmid, const void *shmaddr, int shmflg); // shmaddr thường truyền NULL

// Tách ra khỏi tiến trình
int shmdt(const void *shmaddr);

// Điều khiển / Xóa segment
int shmctl(int shmid, int cmd, struct shmid_ds *buf); // cmd: IPC_RMID
```

#### Mã nguồn Mẫu: System V Shared Memory
**Writer (Ghi dữ liệu):**
```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ipc.h>
#include <sys/shm.h>
#include <unistd.h>

#define SHM_SIZE 1024

int main() {
    key_t key = ftok("/tmp", 'S');
    int shmid = shmget(key, SHM_SIZE, IPC_CREAT | 0666);
    if (shmid == -1) { perror("shmget"); exit(1); }

    char *shm_ptr = (char *)shmat(shmid, NULL, 0);
    if (shm_ptr == (void *)-1) { perror("shmat"); exit(1); }

    strcpy(shm_ptr, "Dữ liệu tốc độ cao từ System V Writer!");
    printf("[Writer] Đã ghi dữ liệu vào Shared Memory.\n");

    sleep(5); // Chờ reader đọc

    shmdt(shm_ptr);
    shmctl(shmid, IPC_RMID, NULL); // Đánh dấu xóa
    printf("[Writer] Đã dọn dẹp bộ nhớ.\n");
    return 0;
}
```

---

## 10.3. POSIX Shared Memory (Chuẩn Hiện Đại Khuyên Dùng)

POSIX Shared Memory kết hợp giữa file descriptor và cơ chế ánh xạ bộ nhớ `mmap()`. Đối tượng được đặt tên bắt đầu bằng `/` (ví dụ `/sensor_shm`).

### 10.3.1. Bảy Bước Thực Thi:
1. `shm_open()`: Mở hoặc tạo đối tượng shared memory (trả về file descriptor `fd`).
2. `ftruncate()`: Thiết lập kích thước cho vùng nhớ (bắt buộc khi tạo mới, mặc định ban đầu là 0 byte).
3. `mmap()`: Ánh xạ file descriptor vào không gian địa chỉ ảo của tiến trình với cờ `MAP_SHARED`.
4. Đọc / Ghi dữ liệu trực tiếp qua con trỏ.
5. `munmap()`: Hủy ánh xạ bộ nhớ.
6. `close()`: Đóng file descriptor.
7. `shm_unlink()`: Xóa tên đối tượng khỏi hệ thống (thường gọi bởi tiến trình tạo hoặc khi kết thúc chương trình).

### 10.3.2. Các System Call POSIX (`<sys/mman.h>`)
```c
#include <sys/mman.h>
#include <fcntl.h>
#include <unistd.h>

// 1. Mở / Tạo shared memory object
int shm_open(const char *name, int oflag, mode_t mode);

// 2. Định kích thước bộ nhớ
int ftruncate(int fd, off_t length);

// 3. Ánh xạ bộ nhớ
void *mmap(void *addr, size_t length, int prot, int flags, int fd, off_t offset);
// prot: PROT_READ | PROT_WRITE
// flags: MAP_SHARED (cực kỳ quan trọng để các tiến trình cùng thấy thay đổi)

// 4. Hủy ánh xạ
int munmap(void *addr, size_t length);

// 5. Xóa khỏi hệ điều hành
int shm_unlink(const char *name);
```

> [!TIP]
> Trên hệ điều hành Linux, các đối tượng POSIX Shared Memory thực chất được tạo ra dưới dạng các file ảo nằm trong thư mục **`/dev/shm/`** (được mount bằng `tmpfs` trên RAM). Bạn có thể dùng lệnh `ls -l /dev/shm/` để kiểm tra kích thước và xóa trực tiếp bằng lệnh `rm`!

---

### 10.3.3. Mã nguồn Mẫu Hoàn Chỉnh: POSIX Shared Memory có Cờ Đồng Bộ

#### Cấu trúc dữ liệu dùng chung (`shared_data.h`):
```c
#ifndef SHARED_DATA_H
#define SHARED_DATA_H

#define SHM_NAME "/my_posix_shm"
#define SHM_SIZE sizeof(struct shared_buffer)

struct shared_buffer {
    volatile int ready; // Cờ đồng bộ: 0: Chưa sẵn sàng, 1: Đã có data, 2: Đã đọc xong
    char message[256];
};

#endif
```

#### Writer (Bên Ghi):
```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <fcntl.h>
#include <sys/mman.h>
#include <unistd.h>
#include "shared_data.h"

int main() {
    int fd = shm_open(SHM_NAME, O_CREAT | O_RDWR, 0666);
    if (fd == -1) { perror("shm_open"); exit(1); }

    ftruncate(fd, SHM_SIZE);

    struct shared_buffer *buf = (struct shared_buffer *)mmap(
        NULL, SHM_SIZE, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
    close(fd); // Có thể đóng fd ngay sau khi mmap thành công

    buf->ready = 0;
    strcpy(buf->message, "Thông điệp thời gian thực từ POSIX Writer!");
    buf->ready = 1; // Báo hiệu dữ liệu đã sẵn sàng

    printf("[Writer] Đã ghi dữ liệu. Chờ Reader đọc...\n");
    while (buf->ready != 2) {
        usleep(10000); // 10ms
    }

    printf("[Writer] Reader đã đọc xong. Đang dọn dẹp...\n");
    munmap(buf, SHM_SIZE);
    shm_unlink(SHM_NAME); // Xóa shared memory object
    return 0;
}
```

#### Reader (Bên Đọc):
```c
#include <stdio.h>
#include <stdlib.h>
#include <fcntl.h>
#include <sys/mman.h>
#include <unistd.h>
#include "shared_data.h"

int main() {
    int fd = shm_open(SHM_NAME, O_RDWR, 0666);
    if (fd == -1) { perror("shm_open"); exit(1); }

    struct shared_buffer *buf = (struct shared_buffer *)mmap(
        NULL, SHM_SIZE, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
    close(fd);

    printf("[Reader] Chờ Writer gửi dữ liệu...\n");
    while (buf->ready != 1) {
        usleep(10000); // 10ms
    }

    printf("[Reader] Đọc được dữ liệu: \"%s\"\n", buf->message);
    buf->ready = 2; // Báo lại cho Writer biết là đã đọc xong

    munmap(buf, SHM_SIZE);
    return 0;
}
```

---

## 10.4. Bảng So Sánh System V vs. POSIX Shared Memory

| Tiêu chí | System V Shared Memory | POSIX Shared Memory |
|:---|:---|:---|
| **Định danh** | Số nguyên `key_t` (tạo qua `ftok`) | Tên chuỗi ký tự dạng đường dẫn (Ví dụ: `/camera_shm`) |
| **API** | `shmget`, `shmat`, `shmdt`, `shmctl` | `shm_open`, `ftruncate`, `mmap`, `munmap`, `shm_unlink` |
| **Giao diện lập trình** | Cấu trúc chuyên biệt System V | Thống nhất với mô hình File Descriptor (`mmap`) |
| **Khả năng quản trị** | Quản lý qua lệnh `ipcs -m`, xóa bằng `ipcrm -m` | Tồn tại trực quan trong `/dev/shm`, quản lý bằng lệnh `ls`, `rm` |
| **Liên kết thư viện** | Thư viện C mặc định | Cần thêm cờ `-lrt` trên một số hệ thống cũ |
| **Khuyến nghị** | Dự án kế thừa mã nguồn cũ | **Tiêu chuẩn công nghiệp hiện đại cho Linux & Embedded Linux** |
