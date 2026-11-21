# 11. IPC - Semaphore (Cơ Chế Khóa Đèn Báo Đồng Bộ Hóa)

> **Tài liệu tham khảo gốc:** `EMB_LINUX/11-IPC-Semaphore/README.md`  
> **Chủ đề:** Khái niệm Semaphore, Phân loại Semaphore (Binary Semaphore vs Counting Semaphore), Thao tác Wait (P) và Post (V), System V Semaphore (`semget`, `semctl`, `semop`, `SEM_UNDO`), POSIX Semaphore (Named Semaphore & Unnamed Semaphore), Bảng so sánh và kinh nghiệm thực chiến.

---

## 11.1. Giới thiệu về Semaphore trong Linux

### 11.1.1. Semaphore là gì?
Semaphore là một cơ chế IPC chuyên trách cho việc **đồng bộ hóa (Synchronization)** giữa các tiến trình hoặc luồng. Về bản chất, Semaphore là một **biến đếm nguyên tử (Atomic Counter)** được quản lý trực tiếp bởi Kernel, dùng để kiểm soát quyền truy cập vào các tài nguyên hữu hạn dùng chung (như Shared Memory, thiết bị phần cứng phần cứng SPI/I2C, slot trong bộ đệm buffer).

### 11.1.2. Hai loại Semaphore chính:
1. **Binary Semaphore (Semaphore nhị phân):**
   - Giá trị chỉ có thể là **0** hoặc **1**.
   - Hoạt động tương tự như một **Mutex (Mutual Exclusion Lock)**: Đảm bảo tại một thời điểm chỉ có 1 tiến trình duy nhất được bước vào Critical Section.
2. **Counting Semaphore (Semaphore đếm):**
   - Giá trị là một số nguyên dương không âm (`>= 0`).
   - Đại diện cho số lượng tài nguyên khả dụng còn lại trong một nhóm (ví dụ: một hồ chứa 10 kết nối, hoặc 5 buffer trống).

---

## 11.2. Nguyên Lý Hoạt Động Cốt Lõi: Wait (P) và Post (V)

Hai thao tác cơ bản được nhà khoa học máy tính Edsger Dijkstra định nghĩa là **P** (Proberen - thử/giảm) và **V** (Verhogen - tăng):

```
                     +---------------------------------------+
                     |    GIÁ TRỊ SEMAPHORE BAN ĐẦU (S)      |
                     +---------------------------------------+
                                        |
               +------------------------+------------------------+
               |                                                 |
               v                                                 v
    [THAO TÁC WAIT / P / DECREMENT]                   [THAO TÁC POST / V / INCREMENT]
    - Nếu S > 0: S = S - 1, tiếp tục chạy.             - S = S + 1
    - Nếu S == 0: Tiến trình bị CHẶN (BLOCK),         - Nếu có tiến trình đang ngủ chờ:
      ngủ chờ Kernel đánh thức khi S > 0.               Kernel đánh thức 1 tiến trình dậy.
```

---

## 11.3. System V Semaphores (Bộ Semaphore Tập Hợp)

System V quản lý theo **Tập hợp các Semaphore (Semaphore Sets)** thay vì một semaphore đơn lẻ.

### 11.3.1. Các Hàm API Cốt Lõi:
```c
#include <sys/types.h>
#include <sys/ipc.h>
#include <sys/sem.h>

// 1. Tạo hoặc lấy Semaphore Set (nsems là số lượng semaphore trong set)
int semget(key_t key, int nsems, int semflg);

// 2. Điều khiển & Khởi tạo giá trị (SETVAL, IPC_RMID)
int semctl(int semid, int semnum, int cmd, ... /* union semun */);

// 3. Thực hiện thao tác Wait / Post nguyên tử
int semop(int semid, struct sembuf *sops, size_t nsops);
```

Cấu trúc `struct sembuf`:
```c
struct sembuf {
    unsigned short sem_num;  /* Chỉ số semaphore trong tập hợp (0, 1, ...) */
    short          sem_op;   /* Giá trị thay đổi:
                                -1 : Wait / P (Giảm đếm, block nếu = 0)
                                +1 : Post / V (Tăng đếm, đánh thức tiến trình)
                                 0 : Chờ cho đến khi semaphore về đúng số 0 */
    short          sem_flg;  /* Cờ điều khiển: IPC_NOWAIT, SEM_UNDO */
};
```

> [!IMPORTANT]
> **Cờ sống còn `SEM_UNDO`:**  
> Nếu một tiến trình đang giữ semaphore (đang khóa Critical Section) mà bị crash đột ngột (Segfault hoặc dính `SIGKILL`), semaphore sẽ bị khóa vĩnh viễn và các tiến trình khác sẽ bị Deadlock!  
> Khi đặt cờ **`SEM_UNDO`**, Linux Kernel sẽ theo dõi mọi thay đổi của tiến trình trên semaphore. Nếu tiến trình bị chết bất ngờ, Kernel sẽ **tự động hoàn tác (undo)** toàn bộ các thao tác `sem_op` của nó, giải phóng khóa cho các tiến trình khác!

---

## 11.4. POSIX Semaphores (Chuẩn Hiện Đại Khuyên Dùng)

POSIX cung cấp 2 biến thể:
1. **Named Semaphore (Có tên):** Dùng chuỗi tên dạng `/my_sem`. Rất tiện lợi cho các **tiến trình độc lập** giao tiếp với nhau mà không cần dùng chung bộ nhớ.
2. **Unnamed Semaphore (Không tên / Dựa trên bộ nhớ):** Tồn tại trực tiếp trong vùng RAM chung (Shared Memory hoặc biến toàn cục của Thread).

---

### 11.4.1. POSIX Named Semaphores (Giao tiếp Tiến trình Độc lập)

```c
#include <fcntl.h>
#include <sys/stat.h>
#include <semaphore.h>

// 1. Mở hoặc tạo Named Semaphore (value: giá trị khởi tạo, ví dụ 1 cho Mutex)
sem_t *sem_open(const char *name, int oflag, mode_t mode, unsigned int value);

// 2. Thao tác Wait (P) - Giảm 1, block nếu = 0
int sem_wait(sem_t *sem);
int sem_trywait(sem_t *sem);                                     // Không block
int sem_timedwait(sem_t *sem, const struct timespec *abs_timeout); // Có timeout

// 3. Thao tác Post (V) - Tăng 1
int sem_post(sem_t *sem);

// 4. Đóng trong tiến trình hiện tại
int sem_close(sem_t *sem);

// 5. Xóa hoàn toàn khỏi hệ thống
int sem_unlink(const char *name);
```

#### Mã nguồn Mẫu: Đồng bộ Ping - Pong giữa 2 Tiến trình độc lập
**Tiến trình A (`proc_a.c`):**
```c
#include <stdio.h>
#include <stdlib.h>
#include <semaphore.h>
#include <fcntl.h>
#include <unistd.h>

#define SEM_A "/sem_ping"
#define SEM_B "/sem_pong"

int main() {
    // Khởi tạo: Sem A = 1 (A chạy trước), Sem B = 0 (B ngủ chờ)
    sem_t *sem_a = sem_open(SEM_A, O_CREAT, 0660, 1);
    sem_t *sem_b = sem_open(SEM_B, O_CREAT, 0660, 0);

    for (int i = 0; i < 5; i++) {
        sem_wait(sem_a); // Chờ lượt A
        printf("[Tiến trình A] PING!\n");
        sleep(1);
        sem_post(sem_b); // Nhường lượt cho B
    }

    sem_close(sem_a);
    sem_close(sem_b);
    sem_unlink(SEM_A);
    sem_unlink(SEM_B);
    return 0;
}
```

**Tiến trình B (`proc_b.c`):**
```c
#include <stdio.h>
#include <stdlib.h>
#include <semaphore.h>
#include <fcntl.h>
#include <unistd.h>

#define SEM_A "/sem_ping"
#define SEM_B "/sem_pong"

int main() {
    sem_t *sem_a = sem_open(SEM_A, 0);
    sem_t *sem_b = sem_open(SEM_B, 0);

    for (int i = 0; i < 5; i++) {
        sem_wait(sem_b); // Chờ A gọi post
        printf("    [Tiến trình B] PONG!\n");
        sleep(1);
        sem_post(sem_a); // Nhường lại cho A
    }

    sem_close(sem_a);
    sem_close(sem_b);
    return 0;
}
```

---

### 11.4.2. POSIX Unnamed Semaphores (Đặt trong Shared Memory)

Khi hai tiến trình đã dùng chung vùng nhớ (qua `mmap`), biến `sem_t` có thể được đặt trực tiếp bên trong cấu trúc của vùng nhớ đó:

```c
#include <semaphore.h>

int sem_init(sem_t *sem, int pshared, unsigned int value);
int sem_destroy(sem_t *sem);
```
- Tham số **`pshared`** cực kỳ quan trọng:
  - `pshared == 0`: Semaphore dùng chung giữa các **Threads** trong cùng process.
  - `pshared != 0` (thường là 1): Semaphore dùng chung giữa các **Processes** (bắt buộc con trỏ `sem` phải nằm trong Shared Memory được ánh xạ với cờ `MAP_SHARED`).

---

## 11.5. Bảng So Sánh Chi Tiết: System V vs. POSIX Semaphores

| Đặc tính | System V Semaphores | POSIX Semaphores |
|:---|:---|:---|
| **Đơn vị quản lý** | Một tập hợp (Set) các semaphores | Từng semaphore riêng lẻ |
| **Định danh** | Số nguyên `key_t` -> `semid` | Named: Chuỗi tên `/my_sem`; Unnamed: Con trỏ `sem_t*` |
| **Độ phức tạp API** | Rất cao và cồng kềnh (`union semun`, mảng `sembuf`) | Đơn giản, trực quan, đồng nhất chuẩn POSIX |
| **Tính năng tự động phục hồi** | Có cờ **`SEM_UNDO`** tuyệt vời khi crash | Không có cơ chế undo native (phải dùng `pthread_mutex` robust) |
| **Vòng đời & Lưu trữ** | Lưu trong Kernel đến khi gọi `semctl(IPC_RMID)` | Named: Lưu trong `/dev/shm`; Unnamed: Đi theo vùng nhớ chứa nó |
| **Thao tác có Timeout** | Không hỗ trợ native | Hỗ trợ `sem_timedwait()` |
| **Khuyến nghị sử dụng** | Khi bắt buộc cần thao tác nguyên tử nhiều semaphore cùng lúc hoặc cần `SEM_UNDO` | **Khuyến nghị cho 95% dự án phát triển mới trên Embedded Linux** |
