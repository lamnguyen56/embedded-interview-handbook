# 03. Tiến Trình trong Linux (Linux Process Management)

> **Tài liệu tham khảo gốc:** `EMB_LINUX/03-Linux-Process/README.md`  
> **Chủ đề:** Chương trình và Tiến trình, Tham số dòng lệnh (argc/argv), Bố cục bộ nhớ ảo (Process Memory Layout), Quản lý vòng đời tiến trình (`fork()`, `exec()`, `exit()`, `wait()`), Tiến trình Mồ côi (Orphan) và Tiến trình Ma (Zombie).

---

## 3.1. Phân biệt Chương trình (Program) và Tiến trình (Process)

### 3.1.1. Chương trình (Program)
- **Định nghĩa:** Là một tập hợp các chỉ thị mã máy và dữ liệu được lưu trữ tĩnh trên bộ nhớ lưu trữ thứ cấp (HDD, SSD, Flash eMMC).
- **Đặc điểm:** Thực thể bị động (passive entity), không tiêu tốn CPU hay RAM khi chưa được kích hoạt, tồn tại vĩnh viễn trên đĩa dưới định dạng nhị phân thực thi (ELF trên Linux).

### 3.1.2. Tiến trình (Process)
- **Định nghĩa:** Là một **thực thể đang thực thi (an instance of a program in execution)** của một chương trình.
- **Đặc điểm:** Thực thể chủ động (active entity), được hệ điều hành cấp phát không gian địa chỉ bộ nhớ ảo riêng biệt (Virtual Address Space), thời gian CPU (CPU time slices), file descriptors, trạng thái thanh ghi và con trỏ lệnh (Program Counter).
- Mỗi tiến trình được định danh bởi một số nguyên dương duy nhất trong toàn hệ thống gọi là **PID (Process ID)**.

### 3.1.3. Bảng so sánh Program vs Process

| Tiêu chí | Chương trình (Program) | Tiến trình (Process) |
|:---|:---|:---|
| **Bản chất** | Tĩnh (Static), lưu trên ổ đĩa | Động (Dynamic), nạp vào RAM và CPU |
| **Tài nguyên** | Không tiêu tốn CPU/RAM | Chiếm dụng RAM, CPU, File Descriptors |
| **Số lượng** | Chỉ có 1 file nhị phân trên đĩa | Có thể sinh ra nhiều tiến trình cùng lúc từ 1 file |
| **Vòng đời** | Tồn tại lâu dài đến khi bị xóa file | Sinh ra khi gọi `fork()`/`exec()`, mất đi khi `exit()` |
| **Sự cô lập** | N/A | Được bảo vệ nghiêm ngặt bởi MMU (Memory Management Unit) |

---

## 3.2. Tham số Dòng lệnh (Command-line Arguments: `argc` & `argv`)

Khi khởi chạy một tiến trình từ shell hoặc qua system call `exec`, ta có thể truyền tham số cho hàm `main`:

```c
int main(int argc, char *argv[])
```
- `argc` (Argument Count): Số lượng đối số được truyền vào (luôn >= 1, vì `argv[0]` chính là tên chương trình).
- `argv` (Argument Vector): Mảng các con trỏ trỏ tới chuỗi ký tự kết thúc bằng null (`\0`).
  - `argv[0]`: Tên chương trình.
  - `argv[1]` đến `argv[argc - 1]`: Các đối số thực tế.
  - `argv[argc]`: Luôn là con trỏ `NULL`.

#### Ví dụ xử lý tham số dòng lệnh:
```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, char *argv[]) {
    printf("Số lượng tham số nhận được: %d\n", argc);
    for (int i = 0; i < argc; i++) {
        printf("  argv[%d] = %s\n", i, argv[i]);
    }

    // Xử lý cờ đơn giản
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-h") == 0 || strcmp(argv[i], "--help") == 0) {
            printf("Hướng dẫn sử dụng: %s [-v] [-n count]\n", argv[0]);
            return 0;
        }
    }
    return 0;
}
```

---

## 3.3. Bố Cục Bộ Nhớ Ảo của Tiến trình (Process Memory Layout)

Mỗi tiến trình chạy trên Linux đều nhìn thấy một không gian địa chỉ ảo 32-bit (4GB) hoặc 64-bit hoàn toàn phẳng và độc lập nhờ phần cứng MMU:

```
Địa chỉ cao: 0xFFFFFFFF (32-bit) / 0xFFFFFFFFFFFFFFFF (64-bit)
+-------------------------------------------------------+
|              KERNEL SPACE (1GB trên 32-bit)          |
|  (Chỉ truy cập khi ở Kernel mode qua System Call)    |
+-------------------------------------------------------+ 0xC0000000
|              USER STACK (Ngăn xếp)                   |
|  - Biến cục bộ, tham số hàm, địa chỉ trả về          |
|  - Phát triển hướng XUỐNG dưới (Vùng địa chỉ thấp)   |
|                         |                             |
|                         v                             |
+-------------------------------------------------------+
|                         ^                             |
|                         |                             |
|       MEMORY MAPPING SEGMENT (mmap, shm, libs)        |
|  - Ánh xạ file, nạp thư viện động .so, POSIX shm      |
+-------------------------------------------------------+
|                         ^                             |
|                         |                             |
|              HEAP (Vùng nhớ động)                     |
|  - Cấp phát bằng malloc(), calloc(), new              |
|  - Phát triển hướng LÊN trên (Vùng địa chỉ cao)       |
+-------------------------------------------------------+
|              BSS SEGMENT (Uninitialized Data)         |
|  - Biến toàn cục & static chưa khởi tạo hoặc = 0      |
|  - Không chiếm dung lượng trên file ELF (chỉ lưu size)|
+-------------------------------------------------------+
|              DATA SEGMENT (Initialized Data)          |
|  - Biến toàn cục & static đã khởi tạo khác 0          |
|  - Chiếm dung lượng thực trong file ELF               |
+-------------------------------------------------------+
|              TEXT / CODE SEGMENT                      |
|  - Chứa mã máy thực thi của chương trình              |
|  - Read-Only & Executable (bảo vệ chống ghi đè code)  |
+-------------------------------------------------------+ 0x08048000
|              RESERVED / NULL POINTER TRAP             |
+-------------------------------------------------------+ 0x00000000
Địa chỉ thấp
```

### Chi tiết các phân vùng:
1. **Text Segment (Code):** Chứa các lệnh máy. Có cờ `r-x` (Read và Execute). Nhiều tiến trình chạy cùng 1 chương trình sẽ dùng chung phân vùng Text trong RAM vật lý để tiết kiệm bộ nhớ.
2. **Data Segment:** Chứa các biến toàn cục và `static` đã được gán giá trị khởi tạo khác 0 (Ví dụ: `int global_count = 10;`). Có cờ `rw-`.
3. **BSS Segment (Block Started by Symbol):** Chứa các biến toàn cục và `static` không được gán giá trị (hoặc gán = 0). Kernel tự động xóa sạch vùng này về 0 khi nạp tiến trình. Do đó, file ELF trên ổ đĩa không cần tốn dung lượng để lưu các số 0 này.
4. **Heap:** Vùng nhớ dành cho việc cấp phát động lúc runtime (`malloc()`, `realloc()`, `free()`). Đỉnh của Heap được quản lý bởi con trỏ `brk`/`sbrk`.
5. **Memory Mapping Segment:** Nằm giữa Heap và Stack, dùng cho system call `mmap()`, nạp các file thư viện dùng chung `libc.so`, POSIX Shared Memory.
6. **Stack:** Quản lý theo cơ chế LIFO. Lưu trữ các frame hàm: con trỏ trả về (Return Address), biến cục bộ của hàm, tham số truyền vào hàm. Khi hàm return, frame tương ứng tự động bị hủy. Kích thước mặc định thường là 8MB (kiểm tra bằng `ulimit -s`).

---

## 3.4. Vòng đời Tiến trình: `fork()`, `exec()`, `wait()`, `exit()`

### 3.4.1. Tạo tiến trình mới bằng `fork()`
Trong Linux, tiến trình mới được sinh ra bằng cách **nhân bản** một tiến trình hiện có thông qua system call `fork()`:

```c
#include <unistd.h>
#include <sys/types.h>

pid_t fork(void);
```

**Giá trị trả về độc nhất vô nhị:**
- `fork()` được gọi 1 lần nhưng **trả về 2 lần**:
  - Trả về **`0`** cho **tiến trình con**.
  - Trả về **`PID của con (> 0)`** cho **tiến trình cha**.
  - Trả về **`-1`** nếu tạo tiến trình thất bại (hết RAM hoặc vượt giới hạn max process).

#### Cơ chế Copy-on-Write (COW):
Trước đây, `fork()` sẽ copy toàn bộ bộ nhớ của cha sang con (rất tốn kém). Linux hiện đại sử dụng **Copy-on-Write (COW)**:
- Sau `fork()`, cha và con trỏ chung vào các trang bộ nhớ vật lý giống nhau, nhưng đánh dấu là **Read-Only**.
- Chỉ khi một trong hai tiến trình cố gắng **ghi** vào một trang nhớ, CPU mới kích hoạt Page Fault để Kernel nhân bản riêng trang nhớ đó ra một vị trí mới trên RAM. Điều này giúp `fork()` chạy cực nhanh!

---

### 3.4.2. Thay thế không gian thực thi bằng Họ hàm `exec`
Sau khi `fork()`, nếu tiến trình con muốn chạy một chương trình hoàn toàn mới (ví dụ lệnh `ls`, `ping`...), nó gọi họ hàm `exec`:

Các hàm trong họ `exec` (`execl`, `execlp`, `execle`, `execv`, `execvp`, `execvpe`):
- `l` (list): Tham số truyền dạng danh sách liệt kê, kết thúc bằng `NULL`.
- `v` (vector): Tham số truyền dạng mảng con trỏ `char *argv[]`.
- `p` (path): Tự động tìm kiếm file thực thi trong biến môi trường `PATH`.
- `e` (environment): Truyền mảng biến môi trường riêng.

> [!NOTE]
> Khi gọi `exec` thành công, toàn bộ Text, Data, Heap, Stack cũ của tiến trình con bị xóa sạch và thay thế hoàn toàn bằng chương trình mới, **nhưng PID vẫn giữ nguyên**! Hàm `exec` chỉ trả về khi bị lỗi.

#### Mẫu thiết kế chuẩn Fork - Exec:
```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/wait.h>

int main() {
    pid_t pid = fork();

    if (pid < 0) {
        perror("Fork thất bại");
        exit(1);
    } 
    else if (pid == 0) {
        // TIẾN TRÌNH CON
        printf("[Con - PID %d] Thực thi lệnh 'ls -l /tmp'...\n", getpid());
        char *args[] = {"ls", "-l", "/tmp", NULL};
        execvp("ls", args);
        
        // Đoạn này chỉ chạy nếu execvp thất bại
        perror("Exec thất bại");
        exit(1);
    } 
    else {
        // TIẾN TRÌNH CHA
        printf("[Cha - PID %d] Đang chờ tiến trình con (PID %d) hoàn thành...\n", getpid(), pid);
        int status;
        waitpid(pid, &status, 0); // Chặn chờ con kết thúc
        
        if (WIFEXITED(status)) {
            printf("[Cha] Con đã thoát bình thường với mã thoát = %d\n", WEXITSTATUS(status));
        }
    }
    return 0;
}
```

---

## 3.5. Tiến trình Mồ Côi (Orphan) và Tiến trình Ma (Zombie)

### 3.5.1. Tiến trình Mồ Côi (Orphan Process)
- **Định nghĩa:** Là tiến trình con mà **tiến trình cha đã kết thúc trước nó**.
- **Cách hệ điều hành xử lý:** Tiến trình mồ côi không gây hại cho hệ thống. Ngay khi cha chết, tiến trình `init` (PID 1) hoặc `systemd` sẽ tự động **nhận nuôi (adopt)** đứa con mồ côi này và chịu trách nhiệm gọi `wait()` để thu dọn khi nó kết thúc.

### 3.5.2. Tiến trình Ma (Zombie / Defunct Process)
- **Định nghĩa:** Là tiến trình con **đã chạy xong và gọi `exit()`**, nhưng **tiến trình cha chưa gọi hàm `wait()` hoặc `waitpid()`** để thu thập mã trạng thái kết thúc (exit status).
- **Hậu quả:** 
  - Mặc dù toàn bộ bộ nhớ RAM (Text, Heap, Stack) của con đã được giải phóng, nhưng mục thông tin (entry) của nó trong **Bảng Tiến Trình (Process Table)** của Kernel vẫn bị giữ lại.
  - Trong lệnh `ps aux`, tiến trình ma hiển thị trạng thái `Z` và có chữ `<defunct>`.
  - Nếu sinh ra quá nhiều zombie process, hệ thống sẽ bị **hết bảng PID (PID exhaustion)**, dẫn tới không thể tạo thêm bất kỳ tiến trình nào khác!

```
                    [VÒNG ĐỜI TIẾN TRÌNH CON]
   fork()
     |
     v
  [Running]
     |
     v gọi exit()
  [ZOMBIE (Defunct)] ---> Cha chưa gọi wait() -> Vẫn chiếm 1 slot PID trong Kernel!
     |
     +------------------> Cha gọi wait() / waitpid() -> Thu dọn sạch sẽ khỏi Process Table
```

### 3.5.3. Ba giải pháp Triệt để Ngăn chặn Zombie Process trong Embedded Linux

#### Giải pháp 1: Gọi `wait()` / `waitpid()` đồng bộ
Phù hợp khi cha cần kết quả của con trước khi chạy tiếp (như lệnh shell thực thi command).

#### Giải pháp 2: Xử lý bất đồng bộ qua Signal `SIGCHLD` (Khuyến nghị cho Server / Daemon)
Khi con terminate, Kernel tự động bắn signal `SIGCHLD` cho cha. Cha đăng ký handler và gọi `waitpid` non-blocking:
```c
#include <signal.h>
#include <sys/wait.h>

void sigchld_handler(int sig) {
    // Thu dọn toàn bộ các con đã chết mà không bị block
    while (waitpid(-1, NULL, WNOHANG) > 0);
}

// Trong hàm main:
struct sigaction sa;
sa.sa_handler = sigchld_handler;
sigemptyset(&sa.sa_mask);
sa.sa_flags = SA_RESTART | SA_NOCLDSTOP;
sigaction(SIGCHLD, &sa, NULL);
```

#### Giải pháp 3: Bỏ qua `SIGCHLD` (Mẹo tối ưu của Linux)
Chỉ cần thêm 1 dòng code trong hàm `main`:
```c
signal(SIGCHLD, SIG_IGN);
```
Theo chuẩn POSIX trên Linux, khi cha đặt cờ `SIG_IGN` cho `SIGCHLD`, Kernel sẽ tự động thu dọn toàn bộ tiến trình con khi chúng terminate mà **không tạo ra bất kỳ Zombie process nào**!
