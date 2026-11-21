# 01. Kiến thức Chung (General Knowledge) - Makefile, Biên dịch C & Thư viện trong Linux

> **Tài liệu tham khảo gốc:** `EMB_LINUX/01-General-Knowlege/README.md`  
> **Chủ đề:** Tự động hóa bản dựng với Makefile, Các giai đoạn biên dịch mã nguồn C, Thư viện Tĩnh (Static Library) và Thư viện Chia sẻ (Shared Library)

---

## 1.1. Giới thiệu về Makefile và Công cụ `make`

### 1.1.1. Makefile là gì?
Makefile là một file kịch bản (script) được công cụ tự động hóa bản dựng `make` (GNU Make) sử dụng để quản lý và biên dịch các dự án phần mềm một cách tối ưu. Makefile bao gồm:
- **Cấu trúc dự án:** Danh sách các file nguồn, file header và mối quan hệ phụ thuộc (dependencies) giữa chúng.
- **Lệnh biên dịch (Build commands):** Các chỉ thị shell chỉ định trình biên dịch (`gcc`, `g++`, `arm-linux-gnueabihf-gcc`...), các cờ (flags) và quá trình liên kết (linking).
- **Quy tắc (Rules):** Công thức xác định mục tiêu cần tạo ra (target) dựa trên các file phụ thuộc (prerequisites).

`make` hoạt động dựa trên cơ chế **so sánh timestamp (thời gian chỉnh sửa gần nhất)** của target và file phụ thuộc:
- Nếu file nguồn mới hơn target (hoặc target chưa tồn tại), `make` sẽ thực thi lệnh để tạo lại target.
- Nếu target mới hơn tất cả các file nguồn phụ thuộc, `make` sẽ bỏ qua không biên dịch lại. Điều này giúp tiết kiệm thời gian đáng kể trong các dự án C/C++ lớn và hệ thống nhúng.

**Quy ước đặt tên file:**
- `Makefile` (khuyến nghị, `make` tự động tìm kiếm tên này đầu tiên).
- `makefile` (được hỗ trợ nhưng ít phổ biến hơn).
- `*.mk` (dùng cho các file Makefile phụ được nhúng vào file chính qua lệnh `include`).

---

### 1.1.2. Cách thực thi lệnh `make`

```bash
# Thực thi target mặc định (target đầu tiên xuất hiện trong Makefile)
make

# Chỉ định rõ file makefile khác
make -f custom_makefile.mk

# Biên dịch một target cụ thể
make clean
make all
make install
```

---

### 1.1.3. Biến trong Makefile (Makefile Variables)

#### Tại sao cần dùng biến?
- **Khái quát hóa:** Tránh việc viết lặp đi lặp lại tên trình biên dịch, đường dẫn, danh sách file.
- **Dễ bảo trì:** Khi đổi trình biên dịch (ví dụ từ `gcc` sang cross-compiler `arm-linux-gnueabihf-gcc`), chỉ cần sửa một dòng duy nhất.
- **Cú pháp truy xuất giá trị:** `$(TÊN_BIẾN)` hoặc `${TÊN_BIẾN}`.

#### Các biến Compiler và Linker tiêu chuẩn
```makefile
CC = gcc                    # Trình biên dịch C (hoặc aarch64-linux-gnu-gcc)
CXX = g++                   # Trình biên dịch C++
AR = ar                     # Công cụ đóng gói thư viện tĩnh
CFLAGS += -I./include       # Đường dẫn tìm file header (.h)
CFLAGS += -Wall -Wextra     # Bật tất cả các cảnh báo quan trọng
CFLAGS += -g                # Sinh debug symbols cho GDB
CFLAGS += -O2               # Tối ưu hóa hiệu năng mức 2
LDFLAGS += -L./lib          # Đường dẫn tìm kiếm thư viện (.a, .so)
LDFLAGS += -lpthread -lm    # Liên kết với thư viện pthread và math
```

#### Biến tự động (Automatic Variables)
Các biến đặc biệt được `make` gán giá trị tự động trong từng rule:

| Biến | Ý nghĩa |
|:---:|:---|
| `$@` | Tên của **target** hiện tại của rule |
| `$<` | File phụ thuộc **đầu tiên** (first prerequisite) |
| `$^` | **Tất cả** các file phụ thuộc (phân tách bởi dấu cách, không trùng lặp) |
| `$*` | Phần thân (stem) khớp với ký tự mẫu `%` |
| `$(@D)` | Thư mục chứa target |
| `$(@F)` | Tên file của target (bỏ phần thư mục) |

**Ví dụ quy tắc biên dịch file `.c` thành `.o`:**
```makefile
$(OBJ_DIR)/%.o: $(SRC_DIR)/%.c
	$(CC) $(CFLAGS) -c $< -o $@
```

---

### 1.1.4. Các hàm tích hợp sẵn trong Makefile (Built-in Functions)
Cú pháp: `$(tên_hàm tham_số1, tham_số2, ...)`

- `$(wildcard pattern)`: Tìm tất cả các file khớp mẫu. Ví dụ: `SRCS = $(wildcard src/*.c)`
- `$(patsubst pattern,replacement,text)`: Thay thế chuỗi theo mẫu. Ví dụ: `OBJS = $(patsubst src/%.c, obj/%.o, $(SRCS))`
- `$(shell command)`: Thực thi lệnh shell và lấy kết quả. Ví dụ: `ARCH = $(shell uname -m)`
- `$(foreach var,list,text)`: Duyệt qua từng phần tử trong danh sách.
- `$(if condition,then-part,else-part)`: Rẽ nhánh có điều kiện.

---

### 1.1.5. Phony Targets (`.PHONY`)
Target giả (Phony Target) là target **không tương ứng với bất kỳ file vật lý nào trên đĩa**. Nếu trong thư mục vô tình có một file tên là `clean`, lệnh `make clean` sẽ báo "clean is up to date" và không chịu chạy nếu không khai báo `.PHONY`.

```makefile
.PHONY: all clean run install test

clean:
	rm -rf $(OBJ_DIR) $(BIN_DIR)
```

---

### 1.1.6. Makefile mẫu chuẩn cho Dự án C Chuyên nghiệp

```makefile
# Khai báo trình biên dịch và flags
CC = gcc
CFLAGS = -Wall -Wextra -g -I./include
LDFLAGS = -lpthread -lm

# Cấu trúc thư mục
SRC_DIR = src
OBJ_DIR = obj
BIN_DIR = bin
INC_DIR = include

# Tự động quét file nguồn và sinh file object
SRCS = $(wildcard $(SRC_DIR)/*.c)
OBJS = $(patsubst $(SRC_DIR)/%.c, $(OBJ_DIR)/%.o, $(SRCS))
TARGET = $(BIN_DIR)/app_main

.PHONY: all clean run directories

all: directories $(TARGET)

# Tạo thư mục tự động nếu chưa có
directories:
	@mkdir -p $(OBJ_DIR) $(BIN_DIR)

# Biên dịch từng file .c thành .o
$(OBJ_DIR)/%.o: $(SRC_DIR)/%.c
	@echo "[CC] $< -> $@"
	$(CC) $(CFLAGS) -c $< -o $@

# Liên kết các file .o thành executable
$(TARGET): $(OBJS)
	@echo "[LD] $^ -> $@"
	$(CC) $^ -o $@ $(LDFLAGS)

run: all
	./$(TARGET)

clean:
	@echo "Dọn dẹp bản dựng..."
	rm -rf $(OBJ_DIR) $(BIN_DIR)
```

---

## 1.2. Bốn Giai đoạn Biên dịch Mã Nguồn C

Quá trình chuyển đổi từ mã nguồn C (`.c`) sang file thực thi nhị phân (ELF Binary trên Linux) trải qua 4 giai đoạn độc lập:

```
[source.c] 
    |
    v (1. Tiền xử lý - Preprocessing: cpp)
[source.i] 
    |
    v (2. Biên dịch - Compilation: cc1 / gcc)
[source.s] (Assembly code)
    |
    v (3. Hợp dịch - Assembly: as)
[source.o] (Object file / Relocatable Machine Code)
    |
    v (4. Liên kết - Linking: ld)
[executable] (ELF Binary)
```

### 1.2.1. Giai đoạn 1: Tiền xử lý (Preprocessing)
Trình tiền xử lý (`cpp` - C Preprocessor) xử lý các chỉ thị bắt đầu bằng dấu thăng `#`:
- **Xóa bỏ các dòng chú thích (comments):** Biến thành khoảng trắng.
- **Nở các macro (`#define`):** Thay thế macro bằng giá trị định nghĩa.
- **Bao hàm file header (`#include`):** Đọc nội dung file `.h` và dán trực tiếp vào vị trí gọi `#include`.
- **Biên dịch có điều kiện:** Xử lý `#ifdef`, `#ifndef`, `#if`, `#else`, `#endif`.

**Lệnh thực hiện:**
```bash
gcc -E main.c -o main.i
```

### 1.2.2. Giai đoạn 2: Biên dịch (Compilation)
Trình biên dịch thực hiện:
- Phân tích từ vựng (Lexical analysis), phân tích cú pháp (Syntax analysis), phân tích ngữ nghĩa (Semantic analysis).
- Tối ưu hóa mã nguồn theo các cờ `-O0`, `-O1`, `-O2`, `-O3`, `-Os` (tối ưu kích thước cho embedded).
- Chuyển đổi mã C đã tiền xử lý thành **mã hợp ngữ (Assembly Language)** đặc thù cho kiến trúc CPU đích (x86, ARM, RISC-V).

**Lệnh thực hiện:**
```bash
gcc -S main.i -o main.s
```

### 1.2.3. Giai đoạn 3: Hợp dịch (Assembly)
Trình hợp dịch (`as`) chuyển đổi mã hợp ngữ Assembly thành **mã máy (Machine Code - 0 & 1)**:
- Tạo ra file đối tượng (Object file: `.o`).
- File `.o` là mã máy có thể tái định vị (relocatable code): các lệnh máy đã được sinh ra, nhưng địa chỉ của các hàm ngoài (như `printf`) hoặc biến toàn cục từ file khác vẫn chưa có địa chỉ thực tế (đang để trống trong Symbol Table).

**Lệnh thực hiện:**
```bash
gcc -c main.s -o main.o
```

### 1.2.4. Giai đoạn 4: Liên kết (Linking)
Trình liên kết (`ld`) kết hợp nhiều file `.o` cùng với các thư viện (Static `.a` hoặc Shared `.so`) thành file thực thi hoàn chỉnh:
- **Phân giải ký hiệu (Symbol Resolution):** Tìm kiếm định nghĩa của các hàm và biến ngoại lai được tham chiếu trong mã.
- **Tái định vị địa chỉ (Relocation):** Gán địa chỉ bộ nhớ ảo cụ thể cho từng section code và data trong định dạng chuẩn ELF (Executable and Linkable Format).

**Lệnh thực hiện:**
```bash
gcc main.o -o my_program
```

---

## 1.3. Thư viện Tĩnh (Static Library) và Thư viện Chia sẻ (Shared Library)

### 1.3.1. Thư viện là gì?
Thư viện là tập hợp mã nguồn đã được biên dịch sẵn thành mã máy để nhiều chương trình khác nhau có thể tái sử dụng, giúp tăng tính module hóa và giảm thời gian phát triển.

---

### 1.3.2. Thư viện Tĩnh (Static Library - `.a`)

#### Nguyên lý hoạt động:
- Thư viện tĩnh thực chất là một file nén (archive) chứa nhiều file đối tượng `.o`.
- Tại **thời điểm build (Compile & Link time)**, trình liên kết `ld` sẽ trích xuất mã máy từ file `.a` và **dán trực tiếp vào file thực thi cuối cùng**.

#### Lệnh tạo và sử dụng thư viện tĩnh:
```bash
# 1. Biên dịch file nguồn thành file .o
gcc -c math_utils.c -o math_utils.o
gcc -c str_utils.c -o str_utils.o

# 2. Đóng gói các file .o thành file .a bằng lệnh ar (archiver)
ar rcs libutils.a math_utils.o str_utils.o
# Giải thích cờ: r (thêm/thay thế), c (tạo archive nếu chưa có), s (tạo chỉ mục index)

# 3. Liên kết chương trình với thư viện tĩnh
gcc main.c -o app -L. -lutils
```

---

### 1.3.3. Thư viện Chia sẻ / Thư viện Động (Shared Library - `.so`)

#### Nguyên lý hoạt động:
- Mã nguồn thư viện phải được biên dịch với cờ **`-fPIC` (Position-Independent Code)**: cho phép mã máy thực thi ở bất kỳ địa chỉ bộ nhớ ảo nào mà không cần sửa đổi địa chỉ cơ sở.
- Tại **thời điểm build**, linker chỉ kiểm tra xem các hàm có tồn tại trong file `.so` hay không và lưu lại thông tin tham chiếu (symbol references). Mã máy thực tế **không được copy** vào file thực thi.
- Tại **thời điểm chạy (Runtime)**, trình nạp động của Linux (`/lib/ld-linux.so`) sẽ tìm nạp file `.so` vào RAM. Nếu đã có tiến trình khác đang nạp thư viện này, hệ điều hành sẽ ánh xạ chung vùng bộ nhớ Code Segment đó mà không cần cấp phát thêm RAM vật lý.

#### Lệnh tạo và sử dụng thư viện động:
```bash
# 1. Biên dịch thành PIC object file
gcc -fPIC -c math_utils.c -o math_utils.o
gcc -fPIC -c str_utils.c -o str_utils.o

# 2. Tạo shared library .so
gcc -shared -o libutils.so math_utils.o str_utils.o

# 3. Liên kết với chương trình
gcc main.c -o app -L. -lutils -Wl,-rpath=.
```

#### Cách hệ điều hành tìm file `.so` khi chạy:
Nếu không dùng `-Wl,-rpath`, khi chạy `./app` sẽ báo lỗi: `error while loading shared libraries: libutils.so: cannot open shared object file`. Để xử lý:
1. **Thiết lập biến môi trường:** `export LD_LIBRARY_PATH=.:$LD_LIBRARY_PATH`
2. **Cài vào thư mục hệ thống:** Copy file `.so` vào `/usr/local/lib` hoặc `/usr/lib`, sau đó chạy lệnh `sudo ldconfig`.
3. **Hardcode RPATH khi link:** `-Wl,-rpath,./lib` báo cho dynamic linker tìm kiếm ngay tại thư mục `./lib` tính từ vị trí chạy app.

---

### 1.3.4. Bảng So sánh Chi tiết Static Library vs Shared Library

| Tiêu chí | Thư viện Tĩnh (Static Library - `.a`) | Thư viện Động (Shared Library - `.so`) |
|:---|:---|:---|
| **Thời điểm liên kết** | Thời điểm build (Compile & Link time) | Thời điểm chạy chương trình (Runtime) |
| **Kích thước file thực thi** | Lớn (chứa toàn bộ code thư viện) | Nhỏ (chỉ chứa bảng tham chiếu ký hiệu) |
| **Sử dụng RAM hệ thống** | Tốn RAM (Mỗi tiến trình chạy là 1 bản copy riêng) | Tối ưu RAM (Nhiều tiến trình dùng chung 1 bản trong RAM) |
| **Phụ thuộc môi trường** | Độc lập hoàn toàn, dễ phân phối (Self-contained) | Phụ thuộc vào file `.so` có sẵn trên target board |
| **Cập nhật & Vá lỗi** | Phải biên dịch lại toàn bộ ứng dụng | Chỉ cần thay thế file `.so`, không cần build lại app |
| **Tốc độ khởi động** | Rất nhanh (không tốn thời gian dynamic linking) | Chậm hơn đôi chút ở phase load ban đầu |
| **Ứng dụng trong Embedded** | Rất chuộng cho firmware bootloader, recovery tool, rootfs siêu nhỏ tối giản | Chuộng cho hệ sinh thái lớn (Yocto rootfs, GUI Qt, GStreamer, OpenCV) |

---

## 1.4. Các Công cụ Debug Nhị phân Hữu ích trong Embedded Linux
- `nm <file.o / lib.so / executable>`: Liệt kê danh sách các symbol (hàm, biến) và trạng thái của chúng (T: text, U: undefined, D: data).
- `ldd <executable>`: Kiểm tra danh sách các thư viện `.so` mà chương trình đang phụ thuộc lúc runtime.
- `objdump -d <executable>`: Dịch ngược file nhị phân thành mã hợp ngữ (Disassembly).
- `readelf -h -d <file>`: Đọc thông tin header ELF (kiến trúc ARM/x86, endianness, SONAME, RPATH).
- `strip <file>`: Xóa toàn bộ debug symbols và symbol table để giảm kích thước file thực thi trước khi deploy lên board nhúng.
