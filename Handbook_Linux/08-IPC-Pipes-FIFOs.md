# 08. IPC - Pipes và FIFOs (Đường Ống Vô Danh và Đường Ống Định Danh)

> **Tài liệu tham khảo gốc:** `EMB_LINUX/08-IPC-Pipes-FIFOs/README.md`  
> **Chủ đề:** Khái niệm Đường ống (Pipe), Đường ống vô danh (Anonymous Pipe), Giao tiếp 2 chiều (Bidirectional Communication), Đường ống định danh (FIFO / Named Pipe), Mô hình Client-Server với FIFO, Đóng gói thông điệp (Message Framing), Xử lý Timeout với `select()`.

---

## 8.1. Giới thiệu về Đường Ống (Pipes)

### 8.1.1. Pipe là gì?
Pipe (Đường ống) là một trong những cơ chế giao tiếp liên tiến trình (IPC) cổ điển và trực quan nhất của hệ điều hành Unix/Linux:
- **Đặc điểm cốt lõi:**
  - **Đơn công (Unidirectional / Half-duplex):** Dữ liệu chỉ chảy theo một chiều duy nhất — một đầu chỉ để ghi (Write-end) và đầu còn lại chỉ để đọc (Read-end).
  - **Cơ chế FIFO (First-In, First-Out):** Byte dữ liệu nào được ghi vào trước sẽ được đọc ra trước.
  - **Vô danh (Anonymous):** Pipe truyền thống không có tên trong hệ thống tập tin, chỉ tồn tại trong bộ nhớ RAM của Kernel và chỉ có thể sử dụng giữa các **tiến trình có quan hệ huyết thống (Cha - Con, Con - Con)** được sinh ra qua `fork()`.
  - **Dung lượng đệm hữu hạn:** Được duy trì bởi bộ đệm vòng tròn (Circular Buffer) trong Kernel (thường là 64KB trên Linux hiện đại).

```
[Tiến trình Ghi (Writer)] ---> fds[1] ===[ BUFFER TRONG KERNEL RAM ]===> fds[0] ---> [Tiến trình Đọc (Reader)]
```

---

### 8.1.2. Cơ Chế Đọc và Ghi trên Pipe

#### 1. Hành vi Đọc (Reading from a Pipe):
- **Đọc từ Pipe rỗng:** Nếu pipe chưa có dữ liệu và vẫn còn tiến trình mở đầu ghi, hàm `read()` sẽ **bị chặn (block)** cho đến khi có ít nhất 1 byte dữ liệu được ghi vào.
- **Tất cả đầu ghi đã đóng:** Nếu tất cả các tiến trình đã đóng đầu ghi `fds[1]`, hàm `read()` sẽ đọc hết các byte còn sót lại trong bộ đệm, sau đó trả về giá trị **`0` (End-of-File - EOF)**.
- **Tính nguyên tử (Atomicity):** Thao tác đọc/ghi dữ liệu có kích thước nhỏ hơn hoặc bằng hằng số `PIPE_BUF` (thường là 4096 bytes trên Linux) được Kernel đảm bảo là nguyên tử — không bị ngắt quãng hoặc xáo trộn bởi tiến trình khác.

#### 2. Hành vi Ghi (Writing to a Pipe):
- **Ghi vào Pipe đầy:** Khi bộ đệm kernel bị đầy (vượt quá 65536 bytes), hàm `write()` sẽ **bị chặn (block)** cho đến khi tiến trình đọc lấy bớt dữ liệu ra khỏi pipe.
- **Tất cả đầu đọc đã đóng (Broken Pipe):** Nếu tiến trình cố tình gọi `write()` vào một pipe mà **tất cả các đầu đọc `fds[0]` đã bị đóng**, Kernel sẽ lập tức gửi tín hiệu **`SIGPIPE`** đến tiến trình ghi (hành vi mặc định là chấm dứt tiến trình) và hàm `write()` trả về lỗi `EPIPE`.

---

## 8.2. Tạo và Sử Dụng Pipe trong C (`pipe()`)

```c
#include <unistd.h>

int pipe(int pipefd[2]);
```
- Mảng `pipefd[2]` nhận về 2 File Descriptor:
  - `pipefd[0]`: Đầu đọc (**Read end**).
  - `pipefd[1]`: Đầu ghi (**Write end**).
- Trả về `0` nếu thành công, `-1` nếu lỗi.

> [!IMPORTANT]
> **Quy tắc vàng khi dùng Pipe:** Phải gọi `pipe()` **TRƯỚC KHI** gọi `fork()`. Sau khi `fork()`, cả cha và con phải **lập tức đóng đầu pipe mà mình không sử dụng**. Nếu quên đóng đầu ghi thừa ở tiến trình cha, tiến trình con sẽ bị treo vĩnh viễn (hang) trong `read()` vì nghĩ rằng vẫn còn người có thể ghi dữ liệu!

### 8.2.1. Mã nguồn Mẫu: Giao tiếp 1 chiều Cha sang Con
```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <sys/wait.h>

int main() {
    int pipe_fd[2];
    pid_t pid;
    char buffer[128];
    const char *msg = "Thông điệp từ Cha gửi Con qua Pipe!";

    // 1. Tạo Pipe trước khi fork
    if (pipe(pipe_fd) == -1) {
        perror("Lỗi tạo pipe");
        exit(EXIT_FAILURE);
    }

    // 2. Fork tạo tiến trình con
    pid = fork();
    if (pid < 0) {
        perror("Lỗi fork");
        exit(EXIT_FAILURE);
    }

    if (pid > 0) { // TIẾN TRÌNH CHA (Đóng vai trò WRITER)
        close(pipe_fd[0]); // BẮT BUỘC: Đóng đầu đọc không dùng

        printf("[Cha - PID %d] Đang ghi dữ liệu vào pipe...\n", getpid());
        write(pipe_fd[1], msg, strlen(msg) + 1);

        close(pipe_fd[1]); // Ghi xong thì đóng đầu ghi để báo EOF cho con
        wait(NULL);        // Chờ con kết thúc
        printf("[Cha] Kết thúc.\n");
    } 
    else { // TIẾN TRÌNH CON (Đóng vai trò READER)
        close(pipe_fd[1]); // BẮT BUỘC: Đóng đầu ghi không dùng

        printf("[Con - PID %d] Đang chờ đọc dữ liệu từ pipe...\n", getpid());
        ssize_t bytes = read(pipe_fd[0], buffer, sizeof(buffer));
        if (bytes > 0) {
            printf("[Con] Nhận được: \"%s\"\n", buffer);
        }

        close(pipe_fd[0]); // Đóng đầu đọc
        printf("[Con] Hoàn thành và thoát.\n");
        exit(EXIT_SUCCESS);
    }
    return 0;
}
```

---

### 8.2.2. Giao tiếp 2 chiều (Bidirectional Communication) với 2 Pipes

Vì một pipe chỉ truyền 1 chiều, nếu muốn Cha và Con vừa gửi vừa nhận nói chuyện qua lại (Full-duplex), ta phải tạo **2 đường ống độc lập**:
- `parent_to_child[2]`: Cha ghi ở `[1]`, Con đọc ở `[0]`.
- `child_to_parent[2]`: Con ghi ở `[1]`, Cha đọc ở `[0]`.

```
[CHA] --- ghi vào parent_to_child[1] ---> [parent_to_child pipe] ---> đọc từ parent_to_child[0] --- [CON]
[CHA] <-- đọc từ child_to_parent[0] <--- [child_to_parent pipe] <--- ghi vào child_to_parent[1] --- [CON]
```

---

## 8.3. FIFOs - Named Pipes (Đường Ống Định Danh)

### 8.3.1. Điểm khác biệt giữa Pipe và FIFO
- Anonymous Pipe chỉ dùng được giữa Cha và Con.
- **FIFO (First-In, First-Out / Named Pipe):**
  - Xuất hiện công khai như một **file đặc biệt trên filesystem** (có chữ `p` trong `ls -l`).
  - Cho phép **hai tiến trình hoàn toàn độc lập, không có quan hệ huyết thống** giao tiếp với nhau chỉ cần biết đường dẫn file FIFO đó.
  - Dữ liệu thực tế vẫn được Kernel lưu trong RAM, không ghi xuống đĩa cứng (ổ đĩa chỉ lưu metadata node).

### 8.3.2. Tạo FIFO từ Shell và từ Mã C
- **Từ Shell:**
  ```bash
  mkfifo /tmp/my_fifo
  ls -l /tmp/my_fifo
  # prw-r--r-- 1 user user 0 Mar 9 12:00 /tmp/my_fifo
  ```
- **Từ C Code:**
  ```c
  #include <sys/types.h>
  #include <sys/stat.h>

  int mkfifo(const char *pathname, mode_t mode);
  ```

### 8.3.3. Cơ chế Khóa khi Mở FIFO (Blocking Open)
- Theo mặc định, khi một tiến trình mở FIFO ở chế độ chỉ đọc `open(..., O_RDONLY)`, hàm `open()` sẽ **bị chặn (block)** cho đến khi có một tiến trình khác mở cùng file FIFO đó ở chế độ ghi `open(..., O_WRONLY)`, và ngược lại.
- Nếu không muốn bị treo, có thể thêm cờ `O_NONBLOCK`:
  ```c
  int fd = open("/tmp/my_fifo", O_RDONLY | O_NONBLOCK);
  ```

---

## 8.4. Đóng Gói Thông Điệp (Message Framing) trên Stream của Pipe/FIFO

Vì Pipe và FIFO là **Byte Stream (luồng byte liên tục)**, không có khái niệm gói tin riêng biệt. Nếu bên gửi gọi `write()` 2 lần liên tiếp ("Xin" và "Chao"), bên nhận có thể đọc được liền tù tì 1 cục "XinChao". Để phân định từng gói tin, ta dùng 3 kỹ thuật sau:

1. **Dùng Ký tự Phân tách (Delimiter-based):** Kết thúc mỗi gói bằng ký tự đặc biệt (ví dụ `\n` như trong giao thức HTTP/FTP).
2. **Tiền tố Độ dài (Length-prefixed):** Mỗi gói tin luôn gửi 4 byte Header chứa độ dài `length`, theo sau là đúng `length` byte dữ liệu. (Rất chuẩn trong embedded networking).
3. **Kích thước Cố định (Fixed-length):** Mọi thông điệp đều có kích thước cố định (ví dụ struct 256 bytes).

#### Mẫu Đọc Pipe an toàn có Timeout bằng `select()`:
```c
#include <sys/select.h>
#include <unistd.h>
#include <stdio.h>

int read_with_timeout(int fd, void *buf, size_t count, int timeout_sec) {
    fd_set read_fds;
    FD_ZERO(&read_fds);
    FD_SET(fd, &read_fds);

    struct timeval tv;
    tv.tv_sec = timeout_sec;
    tv.tv_usec = 0;

    int ret = select(fd + 1, &read_fds, NULL, NULL, &tv);
    if (ret > 0) {
        return read(fd, buf, count); // Có dữ liệu, đọc an toàn
    } else if (ret == 0) {
        printf("Hết thời gian chờ (Timeout) sau %d giây!\n", timeout_sec);
        return 0;
    } else {
        perror("Lỗi select");
        return -1;
    }
}
```
