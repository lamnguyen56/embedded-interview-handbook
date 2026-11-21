# 05. Luồng trong Linux (POSIX Threads - pthread)

> **Tài liệu tham khảo gốc:** `EMB_LINUX/05-Thread/README.md`  
> **Chủ đề:** Khái niệm Luồng (Thread), Đồng thời vs Song song (Concurrency vs Parallelism), Chuyển đổi ngữ cảnh (Context Switching), Vòng đời Thread, So sánh Process vs Thread, POSIX Threads API (`pthread_create`, `pthread_join`, `pthread_detach`), Đồng bộ hóa Luồng (Race Condition, Mutex, Deadlock, Condition Variables, Read-Write Locks).

---

## 5.1. Khái Niệm và Nguyên Lý Hoạt Động của Thread

### 5.1.1. Thread (Luồng thực thi) là gì?
Thread (hay còn gọi là Light-weight Process - LWP) là đơn vị nhỏ nhất có thể được bộ điều phối (scheduler) của hệ điều hành phân bổ thời gian thực thi trên CPU. 

Một tiến trình (process) có thể chứa nhiều thread:
- **Tất cả các thread trong cùng một tiến trình chia sẻ chung:**
  - Không gian địa chỉ bộ nhớ ảo (Virtual Address Space): Code Segment, Data Segment, BSS Segment, Heap.
  - Bảng File Descriptor (các file, socket đang mở).
  - Tín hiệu (Signal Dispositions), quyền hạn UID/GID, thư mục hiện hành.
- **Mỗi thread sở hữu riêng:**
  - **Thread ID (TID):** Số định danh luồng (`pthread_t`).
  - **Con trỏ lệnh (Program Counter - PC):** Vị trí lệnh máy đang thực thi của thread.
  - **Tập thanh ghi CPU (Register Set):** Lưu trạng thái tính toán tạm thời của CPU.
  - **Ngăn xếp riêng (Private Stack):** Lưu biến cục bộ và vết gọi hàm của riêng thread đó.
  - Mức độ ưu tiên lập lịch và Signal Mask.

```
+---------------------------------------------------------------+
|                      TIẾN TRÌNH (PROCESS)                     |
|                                                               |
|  [Code Segment]   [Data Segment / BSS]   [Heap Segment]       |
|  (Dùng chung)     (Dùng chung)           (Dùng chung)         |
|                                                               |
|  +--------------------+   +--------------------+              |
|  |     THREAD 1       |   |     THREAD 2       |              |
|  | - Stack riêng      |   | - Stack riêng      |              |
|  | - Registers riêng  |   | - Registers riêng  |              |
|  | - Thread ID (TID)  |   | - Thread ID (TID)  |              |
|  +--------------------+   +--------------------+              |
+---------------------------------------------------------------+
```

---

## 5.2. Đồng Thời (Concurrency), Song Song (Parallelism) & Chuyển Ngữ Cảnh (Context Switching)

### 5.2.1. Concurrency vs. Parallelism

```
1. CONCURRENCY (Đồng thời - Đơn nhân / 1 Core):
Core 1: [Thread 1] -> [Thread 2] -> [Thread 1] -> [Thread 2] (Chia sẻ thời gian)

2. PARALLELISM (Song song thực sự - Đa nhân / Multi-Core):
Core 1: [=========== Thread 1 ============]
Core 2: [=========== Thread 2 ============] (Chạy đồng thời tại cùng thời điểm)
```

- **Concurrency (Đồng thời):** Là khả năng hệ thống xử lý nhiều tác vụ bằng cách xen kẽ thời gian (Time-slicing). Trên CPU 1 Core, tại một thời điểm chỉ có 1 thread thực sự chạy, nhưng do chuyển đổi cực nhanh (vài mili-giây) nên tạo cảm giác như các tác vụ chạy song song.
- **Parallelism (Song song):** Đòi hỏi phần cứng phải có **nhiều Core CPU vật lý**. Hai hay nhiều tác vụ thực sự được tính toán đồng thời tại cùng một chu kỳ xung nhịp clock của vi xử lý.

### 5.2.2. Chuyển đổi ngữ cảnh (Context Switching)
Khi CPU chuyển quyền điều khiển từ Thread A sang Thread B:
1. Lưu lại toàn bộ trạng thái thanh ghi, con trỏ stack (`SP`), con trỏ lệnh (`PC`) của Thread A vào bộ nhớ.
2. Nạp trạng thái thanh ghi và con trỏ của Thread B.
3. Cho CPU nhảy tới vị trí con trỏ lệnh của Thread B để chạy tiếp.

> [!NOTE]
> **Context Switch giữa các Thread trong cùng một Process nhanh hơn rất nhiều so với Context Switch giữa hai Process khác nhau!**  
> Lý do: Các thread trong cùng process chia sẻ chung bảng phân trang (Page Table) và không gian nhớ ảo, nên CPU **không cần phải flush bộ nhớ đệm dịch địa chỉ TLB (Translation Lookaside Buffer)**.

---

## 5.3. Bảng So Sánh Chi Tiết: Process vs. Thread

| Tiêu chí | Tiến trình (Process) | Luồng (Thread) |
|:---|:---|:---|
| **Bộ nhớ** | Tách biệt hoàn toàn, cô lập độc lập | Chia sẻ chung Code, Data, Heap. Chỉ có Stack riêng |
| **Chi phí tạo & hủy** | Rất nặng (Tốn thời gian & RAM do cấp phát Virtual Memory) | Rất nhẹ (Chỉ tốn thêm ~2MB đến 8MB cho Stack riêng) |
| **Giao tiếp (IPC)** | Phức tạp, phải qua Kernel (Pipe, Socket, Message Queue) | Cực kỳ đơn giản, truy cập trực tiếp biến toàn cục |
| **Độ an toàn / Cách ly lỗi** | Rất an toàn (Một process bị crash/Segfault không ảnh hưởng process khác) | Kém an toàn (Một thread bị crash/Segfault sẽ kéo **toàn bộ process sập theo**) |
| **Định danh** | PID (Globally unique toàn hệ thống) | TID (Chỉ có ý nghĩa duy nhất bên trong Process đó) |
| **Context Switch Overhead** | Cao (Do phải đổi Page Table và flush TLB Cache) | Thấp (Giữ nguyên Page Table, tận dụng lại Cache L1/L2) |

---

## 5.4. Lập Trình POSIX Threads (pthreads) trong C

Thư viện chuẩn trên Linux là `pthread` (yêu cầu thêm cờ `-lpthread` khi biên dịch với `gcc`).

### 5.4.1. Tạo Thread: `pthread_create()`
```c
#include <pthread.h>

int pthread_create(pthread_t *thread, const pthread_attr_t *attr,
                   void *(*start_routine) (void *), void *arg);
```
- `thread`: Con trỏ lưu ID của thread vừa tạo.
- `attr`: Thuộc tính thread (truyền `NULL` để dùng cấu hình mặc định).
- `start_routine`: Con trỏ hàm mà thread sẽ thực thi (nhận tham số `void *` và trả về `void *`).
- `arg`: Đối số truyền vào cho hàm của thread.

### 5.4.2. Chờ Thread kết thúc: `pthread_join()`
```c
int pthread_join(pthread_t thread, void **retval);
```
- Tương tự như `waitpid()` của process: Thread gọi sẽ bị **chặn (block)** cho đến khi thread chỉ định kết thúc.
- Giúp thu hồi tài nguyên stack của thread và lấy giá trị trả về (`retval`).

### 5.4.3. Tách Thread: `pthread_detach()`
```c
int pthread_detach(pthread_t thread);
```
- Đưa thread vào trạng thái "tách biệt" (detached).
- Khi thread kết thúc, hệ thống **tự động giải phóng toàn bộ tài nguyên** mà không cần bất kỳ thread nào khác phải gọi `pthread_join()`.
- **Lưu ý:** Không thể gọi `pthread_join()` trên một detached thread.

#### Ví dụ cơ bản: Tạo và Đồng bộ Thread
```c
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <unistd.h>

void *worker_func(void *arg) {
    int id = *(int *)arg;
    printf("[Thread %d] Đang xử lý công việc...\n", id);
    sleep(2);
    
    int *result = malloc(sizeof(int));
    *result = id * 100;
    pthread_exit((void *)result); // Trả về kết quả
}

int main() {
    pthread_t tid;
    int id = 1;
    void *retval;

    printf("[Main] Bắt đầu tạo worker thread...\n");
    if (pthread_create(&tid, NULL, worker_func, &id) != 0) {
        perror("Lỗi pthread_create");
        return 1;
    }

    // Chờ thread hoàn thành
    pthread_join(tid, &retval);
    printf("[Main] Thread đã xong. Kết quả nhận về = %d\n", *(int *)retval);

    free(retval);
    return 0;
}
```

---

## 5.5. Đồng Bộ Hóa Luồng (Thread Synchronization)

### 5.5.1. Race Condition (Tranh chấp tài nguyên)
Khi nhiều thread cùng đọc và ghi vào một biến dùng chung mà không có sự kiểm soát, kết quả cuối cùng phụ thuộc vào việc thread nào chạy trước.
Thao tác `counter++` trong ngôn ngữ C thực chất bao gồm **3 chỉ thị mã máy ở cấp CPU**:
1. Đọc giá trị từ RAM vào thanh ghi (Register).
2. Tăng giá trị trong thanh ghi lên 1.
3. Ghi giá trị từ thanh ghi ngược lại vào RAM.

Nếu Thread 1 đang ở bước 2 mà bị Context Switch sang Thread 2, cả hai thread sẽ cùng ghi đè một giá trị giống nhau, dẫn tới mất mát dữ liệu!

---

### 5.5.2. Mutex (Mutual Exclusion Lock)
Mutex là một ổ khóa giúp đảm bảo rằng tại một thời điểm **chỉ có duy nhất một thread** được phép bước vào thực thi đoạn mã bảo vệ (Critical Section).

```c
#include <pthread.h>

// 1. Khởi tạo
pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER; 
// Hoặc dynamic: pthread_mutex_init(&lock, NULL);

// 2. Khóa (Nếu đã có người khóa, thread sẽ ngủ chờ)
pthread_mutex_lock(&lock);

// === CRITICAL SECTION (Truy cập tài nguyên dùng chung an toàn) ===

// 3. Mở khóa
pthread_mutex_unlock(&lock);

// 4. Hủy (khi không dùng nữa)
pthread_mutex_destroy(&lock);
```

#### Nguy cơ Deadlock (Bế tắc) và Giải pháp:
- **Nguyên nhân 1 - Khóa kép (Double Lock):** Thread vô tình gọi `pthread_mutex_lock` 2 lần trên cùng 1 mutex thường mà không unlock -> Tự block chính mình vĩnh viễn. (Khắc phục: dùng cẩn thận hoặc dùng Mutex Đệ quy `PTHREAD_MUTEX_RECURSIVE`).
- **Nguyên nhân 2 - Khóa chéo (Circular Wait):** Thread 1 giữ Mutex A, chờ Mutex B. Thread 2 giữ Mutex B, chờ Mutex A.
- **Quy tắc vàng chống Deadlock:** Luôn luôn khóa các mutex theo **một thứ tự cố định và nhất quán** trong toàn bộ dự án (Ví dụ: Luôn khóa A trước rồi mới khóa B ở tất cả các hàm). Hoặc dùng `pthread_mutex_timedlock()` để timeout nếu chờ quá lâu.

---

### 5.5.3. Biến Điều Kiện (Condition Variables: `pthread_cond_t`)
Mutex dùng để khóa tài nguyên, còn Condition Variable dùng để **báo hiệu sự kiện (Signaling)** giữa các thread. Nó cho phép một thread đi ngủ (sleep) giải phóng CPU và tự động thức giấc khi có dữ liệu mới.

#### Ba hàm cốt lõi:
1. `pthread_cond_wait(&cond, &mutex)`: **Nguyên tử (atomically)** mở khóa mutex và đưa thread vào trạng thái ngủ chờ tín hiệu. Khi được đánh thức, nó tự động chiếm lại khóa mutex trước khi hàm trả về!
2. `pthread_cond_signal(&cond)`: Đánh thức **ít nhất 1 thread** đang ngủ chờ trên cond.
3. `pthread_cond_broadcast(&cond)`: Đánh thức **tất cả các thread** đang ngủ chờ trên cond.

#### Mẫu Producer - Consumer kinh điển bằng Mutex & Condition Variable:
```c
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <unistd.h>

#define CAPACITY 5

int queue[CAPACITY];
int count = 0;

pthread_mutex_t mtx = PTHREAD_MUTEX_INITIALIZER;
pthread_cond_t not_empty = PTHREAD_COND_INITIALIZER; // Báo cho Consumer
pthread_cond_t not_full = PTHREAD_COND_INITIALIZER;  // Báo cho Producer

void *producer(void *arg) {
    for (int i = 0; i < 10; i++) {
        pthread_mutex_lock(&mtx);

        // BẮT BUỘC dùng vòng lặp while để tránh Spurious Wakeup (thức giấc giả)
        while (count == CAPACITY) {
            printf("[Producer] Hàng đợi đầy, đang ngủ chờ...\n");
            pthread_cond_wait(&not_full, &mtx);
        }

        queue[count++] = i;
        printf("[Producer] Đã thêm phần tử %d (Số lượng hiện tại: %d)\n", i, count);

        // Đánh thức consumer
        pthread_cond_signal(&not_empty);
        pthread_mutex_unlock(&mtx);

        usleep(100000); // Giả lập thời gian sản xuất
    }
    return NULL;
}

void *consumer(void *arg) {
    for (int i = 0; i < 10; i++) {
        pthread_mutex_lock(&mtx);

        while (count == 0) {
            printf("[Consumer] Hàng đợi rỗng, đang ngủ chờ...\n");
            pthread_cond_wait(&not_empty, &mtx);
        }

        int item = queue[--count];
        printf("[Consumer] Đã lấy phần tử %d (Số lượng còn lại: %d)\n", item, count);

        // Đánh thức producer
        pthread_cond_signal(&not_full);
        pthread_mutex_unlock(&mtx);

        usleep(250000); // Giả lập thời gian tiêu thụ
    }
    return NULL;
}

int main() {
    pthread_t prod_tid, cons_tid;
    pthread_create(&prod_tid, NULL, producer, NULL);
    pthread_create(&cons_tid, NULL, consumer, NULL);

    pthread_join(prod_tid, NULL);
    pthread_join(cons_tid, NULL);

    printf("Hoàn thành bài toán Producer - Consumer an toàn!\n");
    return 0;
}
```

---

### 5.5.4. Read-Write Locks (`pthread_rwlock_t`)
Khi một tài nguyên được **đọc rất nhiều lần nhưng rất ít khi ghi** (ví dụ: bảng định tuyến mạng, danh bạ cấu hình):
- Nếu dùng Mutex thông thường, các thread đọc cũng phải xếp hàng tuần tự chờ nhau -> Rất lãng phí hiệu năng.
- **Read-Write Lock giải quyết bài toán này:**
  - Cho phép **nhiều thread cùng đọc đồng thời** (`pthread_rwlock_rdlock`).
  - Khi có một thread cần ghi (`pthread_rwlock_wrlock`), nó sẽ **độc quyền tuyệt đối** (chặn toàn bộ các thread đọc và các thread ghi khác cho đến khi ghi xong).
