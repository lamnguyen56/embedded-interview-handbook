# 02. Hệ Thống Tập Tin Linux (Linux File System & System Calls)

> **Tài liệu tham khảo gốc:** `EMB_LINUX/02-Linux-File-System/README.md`  
> **Chủ đề:** Triết lý "Everything is a file", Phân loại File, Cấu trúc cây thư mục FHS, Quyền truy cập, Quản lý phân vùng, Virtual File System (/proc, /sys, /dev), System Calls thao tác File, Page Cache, Bảng quản lý File nội bộ (Inode, Open File Table, File Descriptor Table), Khóa File (File Locking).

---

## 2.1. Giới thiệu về Hệ Thống Tập Tin Linux

### 2.1.1. Triết lý "Everything is a file" (Mọi thứ đều là tập tin)
Một trong những triết lý kiến trúc kinh điển nhất của Unix/Linux là: **Mọi tài nguyên hệ thống đều được trừu tượng hóa dưới dạng tập tin**.
- **File thông thường:** Văn bản, file nhị phân, hình ảnh, mã nguồn.
- **Thư mục (Directories):** Thực chất là file đặc biệt chứa danh sách các file khác và số inode tương ứng.
- **Thiết bị phần cứng:** Bàn phím, chuột, cổng UART, thẻ nhớ, phân vùng ổ đĩa đều xuất hiện dưới dạng các file trong `/dev`.
- **Thông tin kernel & tiến trình:** Được biểu diễn thông qua các file ảo trong `/proc` và `/sys`.
- **Cơ chế IPC:** Pipe, FIFO, Unix domain socket cũng được truy cập qua file descriptor hoặc đường dẫn file.

Nhờ triết lý này, các lập trình viên có thể sử dụng **một bộ API chuẩn duy nhất** (`open()`, `read()`, `write()`, `close()`, `ioctl()`) để tương tác với mọi đối tượng từ file trên ổ cứng cho đến chân GPIO hay cổng nối tiếp.

---

### 2.1.2. Bảy loại File trong Linux

Khi gõ lệnh `ls -l`, ký tự đầu tiên của chuỗi phân quyền (permission string) thể hiện loại file:

| Ký tự | Loại File | Tên tiếng Anh | Ý nghĩa & Mô tả | Ví dụ thực tế |
|:---:|:---|:---|:---|:---|
| `-` | **Regular file** | Tập tin thông thường | Chứa dữ liệu text hoặc binary | `/home/user/app.c`, `/bin/ls` |
| `d` | **Directory** | Thư mục | File danh mục chứa liên kết tới các file khác | `/etc`, `/usr/bin` |
| `c` | **Character device** | Thiết bị dạng ký tự | Giao tiếp luồng byte trực tiếp không đệm (unbuffered) | `/dev/ttyUSB0`, `/dev/null` |
| `b` | **Block device** | Thiết bị dạng khối | Đọc/ghi dữ liệu theo từng block (có cache/buffer) | `/dev/sda`, `/dev/mmcblk0p1` |
| `l` | **Symbolic link** | Liên kết mềm (Symlink) | Con trỏ trỏ tới đường dẫn file khác (như shortcut) | `/lib -> usr/lib` |
| `s` | **Socket** | Socket cục bộ | Điểm kết nối giao tiếp IPC (Unix Domain Socket) | `/run/systemd/private` |
| `p` | **Named Pipe (FIFO)** | Đường ống định danh | Kênh truyền dữ liệu một chiều giữa 2 tiến trình | `/tmp/my_fifo` |

---

### 2.1.3. Cấu trúc Cây Thư Mục Chuẩn FHS (Filesystem Hierarchy Standard)

Linux tổ chức toàn bộ dữ liệu dưới một gốc duy nhất là thư mục root `/`:

```
/ (Root Directory)
├── bin         -> Các lệnh nhị phân thiết yếu cho toàn bộ user (ls, cp, sh)
├── sbin        -> Các lệnh quản trị hệ thống dành riêng cho root (fdisk, ifconfig, reboot)
├── boot        -> File nạp khởi động: Kernel image (zImage/uImage), Device Tree (dtb), U-Boot
├── dev         -> Các file đại diện cho thiết bị phần cứng (device nodes)
├── etc         -> Toàn bộ cấu hình hệ thống và script khởi động (inittab, network, fstab)
├── home        -> Thư mục cá nhân của người dùng thông thường
├── root        -> Thư mục cá nhân của siêu quản trị viên (root user)
├── lib         -> Thư viện động (.so) dùng chung cho các ứng dụng trong /bin và /sbin
├── media, mnt  -> Điểm gắn kết (mount point) cho USB, thẻ nhớ SD, ổ cứng ngoài
├── opt         -> Chứa phần mềm tùy chọn của bên thứ ba
├── proc        -> File system ảo cung cấp thông tin kernel và tiến trình thời gian thực
├── sys         -> File system ảo xuất thông tin phần cứng, bus, driver dưới dạng module hóa
├── tmp         -> Chứa dữ liệu tạm thời (thường tự xóa khi reboot hoặc là tmpfs trên RAM)
├── usr         -> Chứa ứng dụng, thư viện cấp cao của user (/usr/bin, /usr/include, /usr/lib)
└── var         -> Chứa dữ liệu thay đổi thường xuyên trong quá trình chạy (log, database, spool)
```

---

### 2.1.4. Phân Quyền Tập Tin (File Permissions & Ownership)

Mỗi file trong Linux thuộc sở hữu của một **User (Owner)** và một **Group**. Quyền hạn được chia làm 3 nhóm:
1. **User (u):** Chủ sở hữu file.
2. **Group (g):** Nhóm người dùng có chung quyền.
3. **Others (o):** Tất cả những người dùng khác trong hệ thống.

Mỗi nhóm có 3 bit quyền cơ bản:
- **Read (r - 4):** Quyền đọc nội dung file / Liệt kê danh sách file trong thư mục (`ls`).
- **Write (w - 2):** Quyền sửa nội dung file / Tạo và xóa file trong thư mục.
- **Execute (x - 1):** Quyền thực thi file như một chương trình / Truy cập vào thư mục (`cd`).

```
 Chuỗi quyền:  -  r w x  r - x  r - -
               |  \___/  \___/  \___/
               |    |      |      |
               |   User  Group  Others
            Loại file (Regular)
   Giá trị Octal:   7      5      4    -> chmod 754 file.txt
```

**Các bit quyền đặc biệt:**
- **SUID (Set UID - 4000):** Khi file thực thi được chạy, nó chạy với quyền của **chủ sở hữu file** (thay vì quyền của người đang gọi). Ví dụ: lệnh `passwd` cần SUID root để sửa file `/etc/shadow`.
- **SGID (Set GID - 2000):** Chương trình chạy với quyền của Group chủ quản / Thư mục có SGID thì file con tạo ra bên trong sẽ kế thừa Group của thư mục cha.
- **Sticky Bit (1000 - `t`):** Thường áp dụng cho thư mục dùng chung như `/tmp`. Chỉ có chủ sở hữu file hoặc root mới có quyền xóa file của mình, ngăn cản user này xóa file của user khác.

---

### 2.1.5. Virtual Filesystems: `/proc`, `/sys`, `/dev`

Trong Linux Nhúng, ba thư mục ảo này đóng vai trò quan trọng nhất trong việc giao tiếp giữa Kernel và Userspace:

#### 1. `/proc` (Process Information Pseudo-filesystem)
Không chiếm dung lượng trên ổ cứng, tồn tại hoàn toàn trên RAM:
- `/proc/cpuinfo`: Thông tin về kiến trúc CPU, clock speed, cores.
- `/proc/meminfo`: Tình trạng sử dụng RAM chi tiết.
- `/proc/<PID>/`: Mỗi tiến trình đang chạy có một thư mục riêng:
  - `/proc/<PID>/cmdline`: Lệnh khởi chạy tiến trình.
  - `/proc/<PID>/fd/`: Danh sách các file descriptor đang mở.
  - `/proc/<PID>/maps`: Bản đồ bộ nhớ ảo (Memory mapping).
  - `/proc/<PID>/status`: Trạng thái tiến trình (Memory usage, UID, GID).

#### 2. `/sys` (Sysfs Virtual Filesystem)
Cung cấp cái nhìn trực quan, phân cấp rõ ràng về cấu trúc phần cứng của Kernel:
- `/sys/class/gpio/`: Thao tác trực tiếp với GPIO qua userspace (echo export, direction, value).
- `/sys/class/leds/`: Điều khiển đèn LED trên board nhúng.
- `/sys/bus/i2c/`: Danh sách các thiết bị I2C được kernel phát hiện.
- `/sys/devices/`: Cây phân cấp thiết bị phần cứng thực tế.

#### 3. `/dev` (Device Nodes)
Chứa các node thiết bị được tạo bởi `udev` hoặc `mdev` (trong BusyBox). Mỗi node gắn liền với cặp số **Major Number** (chỉ định driver nào quản lý) và **Minor Number** (chỉ định thiết bị cụ thể nào trong nhóm driver đó).

---

## 2.2. Các System Call Thao Tác với File trong C

Các hàm cấp thấp trực tiếp gọi Kernel thông qua File Descriptor (số nguyên int >= 0):

```c
#include <fcntl.h>
#include <unistd.h>
#include <sys/stat.h>

int open(const char *pathname, int flags, ... /* mode_t mode */);
ssize_t read(int fd, void *buf, size_t count);
ssize_t write(int fd, const void *buf, size_t count);
off_t lseek(int fd, off_t offset, int whence);
int close(int fd);
int stat(const char *pathname, struct stat *statbuf);
```

### Các cờ `flags` quan trọng trong `open()`:
- `O_RDONLY`: Chỉ đọc.
- `O_WRONLY`: Chỉ ghi.
- `O_RDWR`: Cả đọc và ghi.
- `O_CREAT`: Tạo file nếu chưa có (khi dùng cờ này bắt buộc phải truyền tham số thứ 3 là `mode`, ví dụ `0644`).
- `O_TRUNC`: Nếu file đã tồn tại, xóa sạch nội dung về 0 byte.
- `O_APPEND`: Con trỏ ghi luôn tự động nhảy về cuối file trước mỗi thao tác ghi.
- `O_NONBLOCK`: Mở file ở chế độ không khóa (non-blocking).

#### Ví dụ: Copy file bằng System Call
```c
#include <stdio.h>
#include <stdlib.h>
#include <fcntl.h>
#include <unistd.h>

#define BUF_SIZE 4096

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "Cách dùng: %s <file_nguon> <file_dich>\n", argv[0]);
        return 1;
    }

    int src_fd = open(argv[1], O_RDONLY);
    if (src_fd == -1) {
        perror("Lỗi mở file nguồn");
        return 1;
    }

    // Tạo file đích với quyền 0644 (Owner: rw, Group: r, Other: r)
    int dst_fd = open(argv[2], O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (dst_fd == -1) {
        perror("Lỗi tạo file đích");
        close(src_fd);
        return 1;
    }

    char buffer[BUF_SIZE];
    ssize_t bytes_read, bytes_written;

    while ((bytes_read = read(src_fd, buffer, sizeof(buffer))) > 0) {
        bytes_written = write(dst_fd, buffer, bytes_read);
        if (bytes_written != bytes_read) {
            perror("Lỗi ghi dữ liệu");
            close(src_fd);
            close(dst_fd);
            return 1;
        }
    }

    close(src_fd);
    close(dst_fd);
    printf("Sao chép file thành công!\n");
    return 0;
}
```

---

## 2.3. Cấu Trúc Nội Bộ Quản Lý File của Linux Kernel

### 2.3.1. Page Cache và Cơ chế Sync
Để tránh nghẽn I/O ổ đĩa, Linux sử dụng cơ chế **Page Cache (đệm bộ nhớ trên RAM)**:
- **Khi đọc (Read):** Kernel kiểm tra xem dữ liệu có trong Page Cache không (Cache Hit). Nếu có, copy thẳng từ RAM vào buffer ứng dụng, không cần đọc disk.
- **Khi ghi (Write):** Dữ liệu được ghi vào Page Cache trước và đánh dấu là **"Dirty Page"** (Trang dơ). Kernel sẽ có tiến trình ngầm (`flush`/`kswapd`) định kỳ đồng bộ dirty pages xuống đĩa vật lý sau một khoảng thời gian.
- **Đảm bảo an toàn dữ liệu trên hệ thống nhúng:** Khi xảy ra mất điện đột ngột (Power Loss), dirty pages chưa kịp ghi sẽ bị mất! Vì vậy trong Embedded Linux cần dùng:
  - `fsync(int fd)`: Ép ghi toàn bộ data và metadata của file xuống storage.
  - `fdatasync(int fd)`: Chỉ ép ghi data của file (bỏ qua metadata) -> nhanh hơn.
  - `sync()`: Flush toàn bộ dirty pages của cả hệ điều hành.

---

### 2.3.2. Mối quan hệ giữa 3 Bảng: File Descriptor Table, Open File Table và I-node Table

Hiểu rõ 3 bảng này là chìa khóa để trả lời mọi câu hỏi phỏng vấn về `fork()`, `dup()`, và File I/O:

```
[Tiến trình A]
FD Table:
  fd 0 (stdin)
  fd 1 (stdout)
  fd 2 (stderr)
  fd 3 ----------> [Open File Table Entry 1]
                     - File Offset: 100
                     - Status Flags: O_RDWR
                     - Ref Count: 1
                     - Inode Pointer -----\
                                           \
[Tiến trình B]                              v
FD Table:                                 [I-node Table Entry] (File: data.txt)
  fd 3 ----------> [Open File Table Entry 2]  - File Size
                     - File Offset: 0         - Permissions
                     - Status Flags: O_RDONLY - Disk Block Pointers
                     - Ref Count: 1           - Link Count
                     - Inode Pointer -----/
```

1. **Bảng File Descriptor (File Descriptor Table):** Nằm riêng trong cấu trúc `task_struct` của **từng tiến trình**. Ánh xạ số nguyên `fd` (0, 1, 2, 3...) trỏ sang một mục trong Bảng File Đang Mở.
2. **Bảng File Đang Mở (Open File Table):** Là bảng dùng chung trên **toàn bộ Kernel**. Mỗi lần gọi hàm `open()` sẽ sinh ra 1 entry trong bảng này. Nó lưu:
   - **File Offset:** Con trỏ đọc/ghi hiện tại của phiên mở này.
   - **Status Flags:** Chế độ mở (`O_RDWR`, `O_APPEND`...).
   - **Reference Count:** Đếm số lượng fd đang trỏ vào entry này (khi `fork()`, tiến trình con kế thừa fd thì ref count tăng lên 2).
3. **Bảng I-node (I-node Table):** Là cấu trúc đại diện cho file thực tế trên ổ cứng. Mỗi file chỉ có **duy nhất 1 Inode**, lưu thông tin metadata (size, permissions, timestamps, con trỏ trỏ tới các khối dữ liệu vật lý trên đĩa). Tên file không lưu trong Inode mà lưu trong thư mục!

> [!TIP]
> - Nếu 2 tiến trình độc lập cùng mở một file qua `open()`: Chúng có 2 mục riêng trong Open File Table, do đó con trỏ `offset` của chúng hoàn toàn độc lập, không ảnh hưởng nhau!
> - Nếu tiến trình cha mở file rồi gọi `fork()`: Cả cha và con dùng chung 1 mục trong Open File Table, nghĩa là **chia sẻ chung con trỏ `offset`**! Khi cha đọc 10 byte, con đọc tiếp theo sẽ bắt đầu từ byte thứ 11!

---

## 2.4. Khóa File (File Locking) trong Linux

Khi nhiều tiến trình cùng truy cập và cập nhật một file, cần có cơ chế khóa để tránh Race Condition làm hỏng file dữ liệu.

### So sánh `flock()` và `fcntl()`:
- `flock(fd, operation)`: Khóa **toàn bộ file**. API đơn giản nhưng không khóa được từng phần.
- `fcntl(fd, F_SETLK, &flock)`: Cho phép **khóa theo từng dải byte (Byte-range / Record locking)**. Rất linh hoạt và mạnh mẽ cho các file cơ sở dữ liệu.

#### Ví dụ: Dùng `flock()` khóa file ghi độc quyền
```c
#include <stdio.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/file.h>

int main() {
    int fd = open("/tmp/app.lock", O_RDWR | O_CREAT, 0666);
    if (fd == -1) return 1;

    printf("Đang xin quyền khóa file độc quyền...\n");
    // LOCK_EX: Khóa độc quyền, LOCK_NB: Không block, báo lỗi ngay nếu đã bị khóa
    if (flock(fd, LOCK_EX | LOCK_NB) == -1) {
        printf("Ứng dụng này đã đang chạy bởi một tiến trình khác!\n");
        close(fd);
        return 1;
    }

    printf("Khóa thành công! Tiến trình đang chạy duy nhất...\n");
    sleep(10); // Làm việc

    flock(fd, LOCK_UN); // Mở khóa
    close(fd);
    return 0;
}
```
