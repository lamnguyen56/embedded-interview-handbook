# 04. IPC - Signal (Tín Hiệu)

> **Tài liệu tham khảo gốc:** `EMB_LINUX/04-IPC-Signal/README.md`  
> **Chủ đề:** Cơ chế Tín hiệu (Signal) trong Lập trình Linux & Linux Nhúng

---

## 4.1. Giới thiệu và Nguyên lý cơ bản về Signal

Signal là một trong những cơ chế giao tiếp giữa các tiến trình (IPC - Inter-Process Communication) cổ xưa và cơ bản nhất trên hệ điều hành Unix/Linux. Về bản chất, **Signal là một ngắt phần mềm (Software Interrupt)** được sử dụng để thông báo cho một tiến trình biết rằng một sự kiện bất đồng bộ (asynchronous event) đã xảy ra.

### 4.1.1. Đặc điểm cốt lõi của Signal
- **Nhẹ và nhanh:** Chi phí tạo và gửi rất thấp vì được quản lý trực tiếp bởi kernel.
- **Dung lượng dữ liệu tối thiểu:** Signal tiêu chuẩn truyền thống chỉ mang theo số hiệu tín hiệu (Signal number - integer). Bản mở rộng Real-time signal mới có thể kèm thêm một giá trị dữ liệu nhỏ (union `sigval`).
- **Giao tiếp giữa các tiến trình độc lập:** Có thể gửi giữa bất kỳ hai tiến trình nào (chỉ cần thỏa mãn quyền hạn UID/GID).
- **Bất đồng bộ (Asynchronous):** Tiến trình nhận có thể bị ngắt ở bất kỳ thời điểm nào trong chu kỳ CPU để xử lý signal.

---

### 4.1.2. Nguồn gốc sinh ra Signal (Signal Origins)

```
        +-------------------------------------------------------+
        |                 NGUỒN PHÁT SIGNAL                     |
        +-------------------------------------------------------+
           |                 |                 |              |
           v                 v                 v              v
    [PHẦN CỨNG]        [NGƯỜI DÙNG]         [KERNEL]      [TIẾN TRÌNH KHÁC]
    - Chia cho 0       - Ctrl+C (SIGINT)   - Con kết     - Lệnh kill(pid, sig)
      (SIGFPE)         - Ctrl+Z (SIGTSTP)    thúc        - Hàm kill(),
    - Lỗi truy cập     - Ctrl+\ (SIGQUIT)    (SIGCHLD)     raise(),
      bộ nhớ                               - Hết timer     alarm()
      (SIGSEGV)                              (SIGALRM)
```

1. **Từ phần cứng (Hardware Exceptions):** CPU phát hiện lỗi phần cứng, chuyển sang Kernel trap, Kernel gửi signal tương ứng đến tiến trình gây lỗi (Ví dụ: truy cập vùng nhớ cấm sinh ra `SIGSEGV`, thực hiện chia cho 0 sinh ra `SIGFPE`).
2. **Từ người dùng (Terminal / Keyboard):** Nhấn tổ hợp phím tắt trên terminal điều khiển (Ví dụ: `Ctrl+C` sinh `SIGINT`, `Ctrl+Z` sinh `SIGTSTP`, `Ctrl+\` sinh `SIGQUIT`).
3. **Từ Kernel:** Xảy ra sự kiện hệ thống (Ví dụ: Tiến trình con kết thúc báo `SIGCHLD` cho tiến trình cha, ghi vào pipe đã đóng đầu đọc sinh `SIGPIPE`, hết hạn timer sinh `SIGALRM`).
4. **Từ tiến trình khác:** Một tiến trình gọi system call `kill(pid, sig)` hoặc từ dòng lệnh `kill -<SIG> <PID>`.

---

### 4.1.3. Vòng đời của Signal (Signal Lifecycle)

Mỗi signal trải qua 3 giai đoạn chính:

```
[1. Generation] --------> [2. Pending / Delivery] --------> [3. Action / Execution]
(Sự kiện kích hoạt,       (Nằm trong pending set           (Tiến trình thực hiện:
 Kernel tạo signal)         của PCB chờ giao tới)           Bỏ qua / Xử lý / Mặc định)
```

1. **Phát sinh (Generation):** Một sự kiện kích hoạt (phần cứng, kernel, tiến trình) tạo ra signal.
2. **Chờ chuyển phát (Pending):** Signal đã được tạo nhưng chưa được đưa đến tiến trình (có thể do tiến trình đang bị mask/block signal này). Signal tồn tại ở trạng thái *pending* trong Process Control Block (PCB).
3. **Xử lý (Delivery / Execution):** Khi kernel chuyển giao signal cho tiến trình, tiến trình thực thi 1 trong 3 hành vi:
   - **Bỏ qua (Ignore):** Không làm gì cả, tiếp tục chạy bình thường (Ngoại lệ: `SIGKILL` và `SIGSTOP` không thể bị bỏ qua).
   - **Bắt và xử lý (Catch & Handle):** Kernel tạm dừng dòng thực thi chính, lưu context của tiến trình, chuyển sang chạy hàm **Signal Handler** do người dùng đăng ký, sau đó quay lại thực thi tiếp.
   - **Thực hiện hành vi mặc định (Default Action):** Terminate (kết thúc), Core dump (tạo file dump và kết thúc), Stop (tạm dừng tiến trình), Continue (tiếp tục chạy nếu đang tạm dừng).

---

### 4.1.4. Bảng các Signal Cơ Bản thường gặp trong Linux

| Tên Signal | Mã số | Ý nghĩa & Mô tả | Hành vi mặc định | Có thể Bắt (Catch)? | Có thể Bỏ qua (Ignore)? |
|:---|:---:|:---|:---|:---:|:---:|
| **SIGHUP** | 1 | Hangup (terminal đóng). Thường dùng để reload config | Terminate | Có | Có |
| **SIGINT** | 2 | Ngắt bàn phím (`Ctrl+C`) | Terminate | Có | Có |
| **SIGQUIT**| 3 | Thoát từ bàn phím (`Ctrl+\`), sinh Core Dump | Terminate + Core | Có | Có |
| **SIGKILL**| 9 | Buộc dừng ngay lập tức (Kernel trực tiếp kill) | Terminate | **KHÔNG** | **KHÔNG** |
| **SIGSEGV**| 11| Lỗi truy cập bộ nhớ không hợp lệ (Segmentation fault) | Terminate + Core | Có | Có |
| **SIGPIPE**| 13| Ghi dữ liệu vào pipe/socket mà đầu đọc đã đóng | Terminate | Có | Có |
| **SIGALRM**| 14| Báo thức thời gian từ `alarm()` | Terminate | Có | Có |
| **SIGTERM**| 15| Yêu cầu kết thúc lịch sự (cho phép dọn dẹp) | Terminate | Có | Có |
| **SIGUSR1**| 10| Tín hiệu người dùng định nghĩa số 1 | Terminate | Có | Có |
| **SIGUSR2**| 12| Tín hiệu người dùng định nghĩa số 2 | Terminate | Có | Có |
| **SIGCHLD**| 17| Tiến trình con kết thúc hoặc bị dừng | Ignore | Có | Có |
| **SIGCONT**| 18| Cho phép tiến trình tiếp tục chạy | Continue | Có | Có |
| **SIGSTOP**| 19| Tạm dừng tiến trình (không thể can thiệp) | Stop | **KHÔNG** | **KHÔNG** |
| **SIGTSTP**| 20| Tạm dừng từ terminal (`Ctrl+Z`) | Stop | Có | Có |

> [!IMPORTANT]
> Hai tín hiệu duy nhất **KHÔNG THỂ BẮT (Catch)**, **KHÔNG THỂ BỎ QUA (Ignore)**, và **KHÔNG THỂ CHẶN (Block)** là **`SIGKILL (9)`** và **`SIGSTOP (19)`**. Kernel luôn can thiệp trực tiếp để đảm bảo quyền quản trị hệ thống.

---

## 4.2. Xử lý và Đăng ký Signal Handler

### 4.2.1. Signal Handler là gì?
Signal Handler là một hàm callback trong user-space được gọi tự động khi tiến trình nhận được một signal chỉ định. 

Để đăng ký handler, Linux cung cấp 2 system call:
- `signal()`: Hàm truyền thống của chuẩn ANSI C, đơn giản nhưng có hạn chế về tính tương thích và hành vi giữa các bản Unix.
- `sigaction()`: Chuẩn POSIX khuyến nghị, mạnh mẽ, linh hoạt và an toàn hơn rất nhiều.

### 4.2.2. Đăng ký bằng `signal()`

```c
#include <signal.h>

typedef void (*sighandler_t)(int);
sighandler_t signal(int signo, sighandler_t handler);
```
- `signo`: Số hiệu signal cần bắt (ví dụ `SIGINT`).
- `handler`: Con trỏ tới hàm xử lý, hoặc hằng số `SIG_IGN` (bỏ qua), `SIG_DFL` (hành vi mặc định).
- Trả về: Handler trước đó, hoặc `SIG_ERR` nếu lỗi.

#### Ví dụ sử dụng `signal()`:
```c
#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <unistd.h>

volatile sig_atomic_t keep_running = 1;

void signal_handler(int signo) {
    switch (signo) {
        case SIGINT:
            printf("\n[Signal] Nhận SIGINT (Ctrl+C). Bấm lại lần nữa sẽ thoát thật!\n");
            // Đặt lại handler về hành vi mặc định cho lần bấm kế tiếp
            signal(SIGINT, SIG_DFL);
            break;
            
        case SIGTERM:
            printf("\n[Signal] Nhận SIGTERM. Đang dọn dẹp và thoát...\n");
            keep_running = 0;
            break;
            
        case SIGUSR1:
            printf("\n[Signal] Nhận SIGUSR1. Thực thi tác vụ đặc biệt!\n");
            break;
    }
}

int main() {
    // Đăng ký các handler
    if (signal(SIGINT, signal_handler) == SIG_ERR) {
        perror("Lỗi đăng ký SIGINT");
        return 1;
    }
    if (signal(SIGTERM, signal_handler) == SIG_ERR) {
        perror("Lỗi đăng ký SIGTERM");
        return 1;
    }
    if (signal(SIGUSR1, signal_handler) == SIG_ERR) {
        perror("Lỗi đăng ký SIGUSR1");
        return 1;
    }
    
    printf("PID tiến trình: %d\n", getpid());
    printf("Thử nghiệm:\n");
    printf("  - Nhấn Ctrl+C để gửi SIGINT\n");
    printf("  - Mở terminal khác gõ: kill %d\n", getpid());
    printf("  - Gõ: kill -USR1 %d\n", getpid());
    
    while (keep_running) {
        printf("Đang chạy vòng lặp chính...\n");
        sleep(2);
    }
    
    printf("Chương trình kết thúc an toàn.\n");
    return 0;
}
```

---

### 4.2.3. Đăng ký nâng cao bằng `sigaction()` (Chuẩn POSIX khuyên dùng)

```c
#include <signal.h>

int sigaction(int signo, const struct sigaction *act, struct sigaction *oldact);
```

Cấu trúc `struct sigaction`:
```c
struct sigaction {
    void     (*sa_handler)(int);                        // Con trỏ hàm handler thông thường
    void     (*sa_sigaction)(int, siginfo_t *, void *); // Con trỏ hàm nâng cao với siginfo_t
    sigset_t   sa_mask;                                 // Tập các signal sẽ bị chặn trong khi handler đang chạy
    int        sa_flags;                                // Các cờ điều khiển (SA_RESTART, SA_SIGINFO, ...)
    void     (*sa_restorer)(void);                      // Không sử dụng trong ứng dụng (dành cho kernel)
};
```

**Các cờ `sa_flags` quan trọng:**
- `SA_SIGINFO`: Sử dụng `sa_sigaction` thay vì `sa_handler`, cho phép nhận thêm thông tin chi tiết (PID người gửi, mã lỗi, giá trị kèm theo).
- `SA_RESTART`: Tự động khởi động lại (restart) các system call bị ngắt (như `read`, `write`, `accept`) thay vì trả về lỗi `EINTR`.
- `SA_NODEFER`: Không tự động block chính signal này khi đang thực thi handler.
- `SA_NOCLDSTOP`: Khi đăng ký `SIGCHLD`, chỉ nhận tín hiệu khi con terminate, không nhận khi con bị stop/continue.

#### Ví dụ đầy đủ với `sigaction()` và `SA_SIGINFO`:
```c
#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <unistd.h>
#include <string.h>

volatile sig_atomic_t sigusr1_count = 0;

// Handler nâng cao nhận kèm thông tin tiến trình gửi qua siginfo_t
void extended_handler(int signo, siginfo_t *info, void *context) {
    const char *msg;
    
    switch (signo) {
        case SIGUSR1: {
            sigusr1_count++;
            msg = "[Signal Handler] Nhận SIGUSR1\n";
            write(STDOUT_FILENO, msg, strlen(msg));
            
            if (info != NULL) {
                char buffer[128];
                int len = snprintf(buffer, sizeof(buffer), 
                                   "  -> Gửi từ Tiến trình PID: %d, UID: %d\n", 
                                   info->si_pid, info->si_uid);
                write(STDOUT_FILENO, buffer, len);
            }
            break;
        }
        case SIGINT:
            msg = "\n[Signal Handler] Nhận SIGINT (Ctrl+C). Đang thoát...\n";
            write(STDOUT_FILENO, msg, strlen(msg));
            _exit(0);
            break;
    }
}

int main() {
    struct sigaction sa;
    memset(&sa, 0, sizeof(sa));
    
    // Cấu hình handler nâng cao
    sa.sa_sigaction = extended_handler;
    sa.sa_flags = SA_SIGINFO | SA_RESTART;
    
    // Chặn tất cả signal khác trong thời gian handler đang xử lý
    sigfillset(&sa.sa_mask);
    
    if (sigaction(SIGUSR1, &sa, NULL) == -1) {
        perror("sigaction SIGUSR1");
        return 1;
    }
    if (sigaction(SIGINT, &sa, NULL) == -1) {
        perror("sigaction SIGINT");
        return 1;
    }
    
    printf("Tiến trình đang chạy với PID: %d\n", getpid());
    printf("Hãy thử gửi signal: kill -USR1 %d\n", getpid());
    
    while (1) {
        printf("Đang chờ... (Đã nhận SIGUSR1: %d lần)\n", sigusr1_count);
        sleep(3);
    }
    return 0;
}
```

---

### 4.2.4. Các quy tắc an toàn cốt tử khi viết Signal Handler (Async-Signal-Safety)

> [!CAUTION]
> Signal handler có thể ngắt chương trình tại bất kỳ thời điểm nào! Nếu trong hàm main đang gọi `malloc()` mà signal handler lại gọi tiếp `malloc()` hoặc `printf()`, xảy ra **deadlock** do tranh chấp lock nội bộ của glibc.

1. **Chỉ sử dụng các hàm Async-Signal-Safe:** Danh sách hàm an toàn theo POSIX bao gồm: `write()`, `_exit()`, `read()`, `signal()`, `sigaction()`, `time()`. Tránh tuyệt đối `printf()`, `malloc()`, `free()`, `sprintf()`, `fopen()`.
2. **Biến cờ hiệu toàn cục:** Phải khai báo với kiểu `volatile sig_atomic_t`:
   ```c
   volatile sig_atomic_t flag = 0;
   ```
   - `volatile`: Báo cho compiler không tối ưu hóa vào register, luôn đọc/ghi trực tiếp từ RAM.
   - `sig_atomic_t`: Đảm bảo thao tác đọc/ghi là nguyên tử (atomic), không bị ngắt giữa chừng trên kiến trúc CPU hiện tại.
3. **Handler càng ngắn càng tốt:** Thiết kế tốt nhất là handler chỉ set một cờ (flag), vòng lặp chính của ứng dụng kiểm tra cờ này để thực hiện logic nặng.

---

## 4.3. Quản lý, Gửi và Điều khiển Signal

### 4.3.1. Gửi Signal

#### 1. Dùng system call `kill()`:
```c
#include <signal.h>
int kill(pid_t pid, int signo);
```
Ý nghĩa của tham số `pid`:
- `pid > 0`: Gửi tới tiến trình có PID chỉ định.
- `pid == 0`: Gửi tới tất cả tiến trình trong cùng **Process Group** với tiến trình gọi.
- `pid == -1`: Gửi broadcast tới mọi tiến trình mà caller có quyền gửi (trừ tiến trình init / PID 1).
- `pid < -1`: Gửi tới tất cả tiến trình trong group có ID là `|pid|`.
- `signo == 0`: **Null Signal** (kiểm tra xem tiến trình `pid` có tồn tại và caller có quyền gửi signal không mà không thực sự gửi gì).

#### 2. Dùng lệnh trong Terminal:
```bash
kill -SIGNAL <PID>
# Ví dụ:
kill -9 1234       # Gửi SIGKILL ép tắt PID 1234
kill -15 1234      # Gửi SIGTERM yêu cầu tắt an toàn
kill -USR1 1234    # Gửi SIGUSR1
```

#### 3. Giao tiếp Cha - Con thông qua Signal:
```c
#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <unistd.h>
#include <sys/wait.h>

void parent_handler(int signo) {
    if (signo == SIGUSR1)
        printf("Cha (PID %d): Nhận SIGUSR1 từ con\n", getpid());
}

void child_handler(int signo) {
    if (signo == SIGUSR2)
        printf("Con (PID %d): Nhận SIGUSR2 từ cha\n", getpid());
}

int main() {
    signal(SIGUSR1, parent_handler);
    signal(SIGUSR2, child_handler);
    
    pid_t pid = fork();
    
    if (pid < 0) {
        perror("fork");
        exit(1);
    }
    
    if (pid == 0) { // Tiến trình con
        printf("Tiến trình con bắt đầu (PID: %d)\n", getpid());
        sleep(1);
        printf("Con: Gửi SIGUSR1 lên cha...\n");
        kill(getppid(), SIGUSR1);
        
        printf("Con: Chờ phản hồi từ cha...\n");
        pause(); // Tạm dừng cho đến khi nhận được signal
        printf("Con: Đã nhận phản hồi, kết thúc.\n");
        exit(0);
    } else { // Tiến trình cha
        printf("Tiến trình cha (PID: %d) đã tạo con (PID: %d)\n", getpid(), pid);
        pause(); // Chờ SIGUSR1 từ con
        
        sleep(1);
        printf("Cha: Gửi SIGUSR2 trả lời cho con...\n");
        kill(pid, SIGUSR2);
        
        wait(NULL); // Chờ con kết thúc để tránh zombie
        printf("Cha: Con đã thoát, cha thoát theo.\n");
    }
    return 0;
}
```

---

### 4.3.2. Chặn và Mở chặn Signal (Signal Masking & Blocking)

Khi một đoạn mã quan trọng (Critical Section) đang cập nhật dữ liệu dùng chung, việc bị một signal ngắt có thể làm dữ liệu bị hỏng (race condition). Lúc này, ta cần **chặn tạm thời (block)** các signal và mở lại sau khi hoàn thành.

#### Tập hợp Signal (`sigset_t`)
POSIX sử dụng kiểu `sigset_t` để biểu diễn tập hợp các signal:

```c
#include <signal.h>

int sigemptyset(sigset_t *set);               // Khởi tạo tập rỗng
int sigfillset(sigset_t *set);                // Khởi tạo tập chứa toàn bộ signal
int sigaddset(sigset_t *set, int signo);      // Thêm một signal vào tập
int sigdelset(sigset_t *set, int signo);      // Xóa một signal khỏi tập
int sigismember(const sigset_t *set, int sig);// Kiểm tra signal có trong tập không (1: có, 0: không)
```

#### Thiết lập Signal Mask với `sigprocmask()`
```c
int sigprocmask(int how, const sigset_t *newset, sigset_t *oldset);
```
Tham số `how`:
- `SIG_BLOCK`: Thêm `newset` vào mask hiện tại (phép hợp: current_mask | newset).
- `SIG_UNBLOCK`: Gỡ bỏ `newset` khỏi mask hiện tại (phép loại trừ).
- `SIG_SETMASK`: Gán trực tiếp mask mới bằng `newset`.

#### Kiểm tra các Signal đang chờ với `sigpending()`
```c
int sigpending(sigset_t *set);
```
Trả về danh sách các signal đã được gửi tới tiến trình nhưng đang bị block chưa được chuyển phát.

#### Ví dụ hoàn chỉnh: Bảo vệ Critical Section bằng Signal Mask
```c
#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <unistd.h>
#include <string.h>

void signal_handler(int signo) {
    printf("\n>>> [Handler] Đã nhận signal %d\n", signo);
}

void critical_section() {
    sigset_t block_set, old_set, pending_set;
    
    // Chuẩn bị mask: chặn SIGINT và SIGTERM
    sigemptyset(&block_set);
    sigaddset(&block_set, SIGINT);
    sigaddset(&block_set, SIGTERM);
    
    printf("\n=== VÀO CRITICAL SECTION (Chặn SIGINT & SIGTERM trong 5s) ===\n");
    sigprocmask(SIG_BLOCK, &block_set, &old_set);
    
    for (int i = 5; i > 0; i--) {
        printf("Đang thực hiện tác vụ trọng yếu... còn %d giây (Thử nhấn Ctrl+C)\n", i);
        sleep(1);
    }
    
    // Kiểm tra xem có signal nào đang pending không
    sigpending(&pending_set);
    if (sigismember(&pending_set, SIGINT)) {
        printf("-> Phát hiện SIGINT đang ở trạng thái PENDING!\n");
    }
    if (sigismember(&pending_set, SIGTERM)) {
        printf("-> Phát hiện SIGTERM đang ở trạng thái PENDING!\n");
    }
    
    printf("=== RỜI CRITICAL SECTION (Mở lại signal mask cũ) ===\n");
    // Khôi phục mask cũ -> các signal pending sẽ được kích hoạt ngay lập tức!
    sigprocmask(SIG_SETMASK, &old_set, NULL);
    printf("Đã mở chặn signal thành công.\n");
}

int main() {
    struct sigaction sa;
    memset(&sa, 0, sizeof(sa));
    sa.sa_handler = signal_handler;
    sa.sa_flags = SA_RESTART;
    
    sigaction(SIGINT, &sa, NULL);
    sigaction(SIGTERM, &sa, NULL);
    
    printf("Tiến trình bắt đầu. PID = %d\n", getpid());
    critical_section();
    
    printf("Tiến trình tiếp tục chạy bình thường. Nhấn Ctrl+C để thoát.\n");
    while (1) {
        sleep(2);
    }
    return 0;
}
```

---

## 4.4. Kinh nghiệm Thực chiến & Câu hỏi Phỏng vấn Embedded Linux

1. **Xử lý Zombie Process với `SIGCHLD`:**
   - Trong Linux, khi con terminate, nó trở thành Zombie nếu cha chưa gọi `wait()`/`waitpid()`.
   - **Giải pháp chuẩn:** Bắt `SIGCHLD` và gọi `waitpid(-1, &status, WNOHANG)` trong vòng lặp `while` để thu dọn toàn bộ các con đã chết mà không bị block.
   - **Mẹo Linux:** Đăng ký `signal(SIGCHLD, SIG_IGN);` - Kernel sẽ tự động thu dọn tiến trình con, không tạo Zombie!

2. **Tại sao không nên dùng `signal()` mà nên dùng `sigaction()`?**
   - Trên các hệ thống System V cũ, sau khi `signal()` kích hoạt handler, nó tự động reset handler về `SIG_DFL`.
   - `signal()` không chặn chính signal đó khi handler đang chạy, dễ gây đệ quy handler nếu signal tới liên tục.
   - `sigaction()` nhất quán trên mọi nền tảng POSIX, hỗ trợ `SA_RESTART`, `SA_SIGINFO`, và tự động mask signal.

3. **Hiện tượng Signal Coalescing (Mất Signal):**
   - Standard Signals (1-31) không có hàng đợi (no queue). Nếu 5 tín hiệu `SIGUSR1` cùng gửi tới khi tiến trình đang block nó, bit tương ứng trong pending mask chỉ được set là 1. Khi unblock, handler chỉ chạy **đúng 1 lần**.
   - Nếu cần đảm bảo không mất tín hiệu, phải sử dụng **POSIX Real-Time Signals** (`SIGRTMIN` đến `SIGRTMAX`).
