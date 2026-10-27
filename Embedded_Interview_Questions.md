# TÀI LIỆU PHỎNG VẤN EMBEDDED SOFTWARE ENGINEER

> **Ứng viên:** NGUYEN THUA LAM  
> **Vị trí:** Embedded Software Engineer  
> **Kinh nghiệm:** 2+ năm trong automotive cluster platforms (FPT Automotive)

---

# PHẦN 1: CÂU HỎI PHỎNG VẤN EMBEDDED SOFTWARE

---

## 1. Ngôn ngữ C/C++ cho Embedded

### Câu 1: Pointer là gì? Giải thích sự khác nhau giữa pointer, pointer to pointer, và void pointer.

**Đáp án:**

**Pointer (con trỏ)** là một biến lưu trữ địa chỉ bộ nhớ của một biến khác.

```c
int a = 10;
int *p = &a;      // p trỏ đến a, *p = 10

int **pp = &p;    // pointer to pointer, **pp = 10

void *vp = &a;    // void pointer - có thể trỏ đến bất kỳ kiểu dữ liệu nào
int val = *(int *)vp; // Cần ép kiểu trước khi dereference
```

- **Pointer (`int *p`)**: Lưu địa chỉ của biến kiểu `int`.
- **Pointer to pointer (`int **pp`)**: Lưu địa chỉ của một pointer khác. Thường dùng khi cần thay đổi giá trị pointer trong hàm, hoặc mảng 2 chiều động.
- **Void pointer (`void *vp`)**: Pointer tổng quát, có thể trỏ đến bất kỳ kiểu dữ liệu nào. Không thể dereference trực tiếp mà phải ép kiểu. Thường dùng trong các hàm generic như `memcpy()`, `qsort()`.

**Lưu ý trong embedded:**
- Kích thước pointer phụ thuộc kiến trúc: 4 bytes (32-bit MCU), 8 bytes (64-bit SoC).
- Tránh dùng void pointer quá nhiều vì mất type safety.

---

### Câu 2: Function pointer là gì? Cho ví dụ ứng dụng trong embedded.

**Đáp án:**

**Function pointer** là con trỏ trỏ đến một hàm. Nó lưu địa chỉ bắt đầu của hàm trong vùng nhớ text/code.

```c
#include <stdio.h>

// Khai báo function pointer
typedef void (*uart_handler_t)(uint8_t data);

// Các hàm xử lý UART
void uart_rx_normal(uint8_t data) {
    printf("Normal mode: received 0x%02X\n", data);
}

void uart_rx_debug(uint8_t data) {
    printf("Debug mode: received 0x%02X\n", data);
}

// Sử dụng function pointer
uart_handler_t current_handler = uart_rx_normal;

void UART_IRQHandler(void) {
    uint8_t data = UART->DR; // Đọc data register
    current_handler(data);    // Gọi hàm thông qua function pointer
}

// Chuyển mode
void set_debug_mode(void) {
    current_handler = uart_rx_debug;
}
```

**Ứng dụng trong embedded:**
- **Callback functions**: Đăng ký hàm xử lý sự kiện (ISR handler, timer callback).
- **State machine**: Mỗi state có function pointer xử lý riêng.
- **Driver abstraction**: HAL layer dùng function pointer để abstract hardware cụ thể.
- **Jump table**: Thay thế switch-case dài bằng mảng function pointer.

---

### Câu 3: Function pointer array là gì? Cho ví dụ ứng dụng.

**Đáp án:**

**Function pointer array** là mảng các con trỏ hàm, cho phép gọi hàm theo index. Thường dùng làm **jump table** hoặc **dispatch table**.

```c
#include <stdint.h>

typedef enum {
    CMD_READ  = 0,
    CMD_WRITE = 1,
    CMD_RESET = 2,
    CMD_STATUS = 3,
    CMD_MAX
} command_t;

// Các hàm xử lý
void cmd_read(uint8_t *data)  { /* Đọc dữ liệu */ }
void cmd_write(uint8_t *data) { /* Ghi dữ liệu */ }
void cmd_reset(uint8_t *data) { /* Reset hệ thống */ }
void cmd_status(uint8_t *data){ /* Lấy trạng thái */ }

// Function pointer array (jump table)
typedef void (*cmd_handler_t)(uint8_t *data);

cmd_handler_t cmd_table[CMD_MAX] = {
    [CMD_READ]   = cmd_read,
    [CMD_WRITE]  = cmd_write,
    [CMD_RESET]  = cmd_reset,
    [CMD_STATUS] = cmd_status
};

// Xử lý command - O(1) thay vì dùng switch-case
void process_command(command_t cmd, uint8_t *data) {
    if (cmd < CMD_MAX && cmd_table[cmd] != NULL) {
        cmd_table[cmd](data);  // Gọi hàm tương ứng
    }
}
```

**Ưu điểm so với switch-case:**
- Thời gian truy cập O(1), không phụ thuộc số lượng case.
- Dễ mở rộng: chỉ cần thêm phần tử vào mảng.
- Code gọn hơn khi có nhiều command.

---

### Câu 4: Giải thích memory layout của một chương trình C (stack, heap, data, bss, text).

**Đáp án:**

```
Địa chỉ cao
┌──────────────────┐
│   Command Line   │  Arguments & Environment
│   Args & Env     │
├──────────────────┤
│      STACK       │  ↓ Grows downward
│                  │  Biến cục bộ, return address,
│                  │  function parameters
├──────────────────┤
│        ↕         │  (Khoảng trống)
├──────────────────┤
│      HEAP        │  ↑ Grows upward
│                  │  malloc(), calloc(), free()
├──────────────────┤
│  .bss (BSS)      │  Biến global/static CHƯA khởi tạo
│                  │  hoặc khởi tạo = 0
├──────────────────┤
│  .data           │  Biến global/static ĐÃ khởi tạo
│                  │  (giá trị khác 0)
├──────────────────┤
│  .rodata         │  Hằng số, string literals
├──────────────────┤
│  .text (Code)    │  Mã máy (instructions)
│                  │  Thường Read-Only
└──────────────────┘
Địa chỉ thấp
```

```c
int global_init = 100;       // .data
int global_uninit;           // .bss (tự động = 0)
static int static_var = 50;  // .data
const int constant = 42;     // .rodata

void function(void) {
    int local_var = 10;      // Stack
    static int s = 0;        // .data (tồn tại suốt chương trình)
    char *p = malloc(100);   // p trên Stack, 100 bytes trên Heap
    const char *str = "hello"; // str trên Stack, "hello" trong .rodata
    free(p);
}
```

**Trong embedded (bare-metal):**
- **.text** và **.rodata** thường nằm trong Flash/ROM.
- **.data** được copy từ Flash sang RAM khi startup (trong startup code).
- **.bss** được zero-initialized trong RAM khi startup.
- **Stack** và **Heap** nằm trong RAM, kích thước được cấu hình trong linker script.

---

### Câu 5: Giải thích `volatile`, `const`, `static`, `extern` trong embedded C.

**Đáp án:**

**1. `volatile`:**
Báo cho compiler rằng biến có thể thay đổi bất cứ lúc nào (ngoài luồng code hiện tại), nên KHÔNG được tối ưu hóa truy cập biến này.

```c
// Dùng cho: hardware register, biến trong ISR, biến chia sẻ giữa threads
volatile uint32_t *GPIO_ODR = (volatile uint32_t *)0x40020014;
volatile uint8_t flag = 0; // Được set trong ISR

void wait_for_flag(void) {
    while (flag == 0) {
        // Không có volatile, compiler có thể tối ưu thành vòng lặp vô hạn
        // vì nó nghĩ flag không thay đổi trong loop body
    }
}
```

**2. `const`:**
Biến không thể thay đổi sau khi khởi tạo. Trong embedded, `const` data thường được đặt trong Flash (tiết kiệm RAM).

```c
const uint8_t lookup_table[256] = { ... }; // Trong Flash/ROM
const volatile uint32_t *STATUS_REG = (const volatile uint32_t *)0x40020010;
// const: software không được ghi
// volatile: hardware có thể thay đổi giá trị
```

**3. `static`:**
- Biến cục bộ `static`: giữ giá trị qua các lần gọi hàm, scope vẫn trong hàm.
- Biến/hàm global `static`: giới hạn scope trong file (internal linkage).

```c
static int module_state = 0; // Chỉ truy cập được trong file này

void counter(void) {
    static int count = 0; // Chỉ khởi tạo 1 lần, giữ giá trị qua các lần gọi
    count++;
}
```

**4. `extern`:**
Khai báo biến/hàm được định nghĩa ở file khác (external linkage).

```c
// file: config.c
int system_config = 0x1234;

// file: main.c
extern int system_config; // Sử dụng biến từ config.c
```

---

### Câu 6: Struct padding và alignment là gì? Làm sao tối ưu kích thước struct?

**Đáp án:**

**Struct padding** là việc compiler chèn thêm bytes trống (padding) giữa các member trong struct để đảm bảo mỗi member được căn chỉnh (aligned) theo đúng boundary của nó.

**Quy tắc alignment:**
- Mỗi kiểu dữ liệu cần được căn chỉnh theo bội số của kích thước nó (trên hầu hết platform).
- `char` (1 byte): alignment = 1
- `short` (2 bytes): alignment = 2
- `int`/`float` (4 bytes): alignment = 4
- `double`/pointer 64-bit (8 bytes): alignment = 8

```c
// Struct KHÔNG tối ưu - 12 bytes (có padding)
struct Bad {
    char  a;    // offset 0, size 1
                // 3 bytes padding (để b ở offset 4)
    int   b;    // offset 4, size 4
    char  c;    // offset 8, size 1
                // 3 bytes padding (struct size phải là bội của alignment lớn nhất = 4)
}; // sizeof = 12

// Struct TỐI ƯU - 8 bytes (sắp xếp giảm dần kích thước)
struct Good {
    int   b;    // offset 0, size 4
    char  a;    // offset 4, size 1
    char  c;    // offset 5, size 1
                // 2 bytes padding
}; // sizeof = 8
```

**Cách tối ưu:**
1. **Sắp xếp member giảm dần theo kích thước.**
2. Dùng `__attribute__((packed))` (GCC) hoặc `#pragma pack(1)` để bỏ padding — nhưng cẩn thận vì gây **unaligned access** (chậm hơn hoặc fault trên một số MCU như ARM Cortex-M0).

```c
struct __attribute__((packed)) Packed {
    char  a;
    int   b;
    char  c;
}; // sizeof = 6, nhưng truy cập b có thể gây unaligned access
```

---

### Câu 7: Bitfield trong C là gì? Ưu nhược điểm khi dùng trong embedded?

**Đáp án:**

**Bitfield** cho phép định nghĩa member của struct với số bit cụ thể, giúp tiết kiệm bộ nhớ.

```c
// Ví dụ: thanh ghi điều khiển 8-bit
typedef struct {
    uint8_t enable   : 1;  // 1 bit
    uint8_t mode     : 2;  // 2 bits (0-3)
    uint8_t speed    : 3;  // 3 bits (0-7)
    uint8_t reserved : 2;  // 2 bits padding
} control_reg_t;

control_reg_t ctrl;
ctrl.enable = 1;
ctrl.mode = 2;
ctrl.speed = 5;
```

**Ưu điểm:**
- Tiết kiệm bộ nhớ (quan trọng trong MCU có RAM hạn chế).
- Code dễ đọc hơn so với bit manipulation thủ công.
- Mapping trực tiếp lên hardware register.

**Nhược điểm:**
- **Không portable**: Thứ tự bit (LSB first hay MSB first) phụ thuộc compiler và platform.
- **Không nên dùng trực tiếp với hardware registers** vì lý do trên — nên dùng bit mask thay thế.
- Không thể lấy địa chỉ (`&`) của bitfield member.
- Compiler có thể tạo read-modify-write không atomic.

```c
// Cách portable hơn: dùng bit mask
#define CTRL_ENABLE_MASK   (1U << 0)
#define CTRL_MODE_MASK     (3U << 1)
#define CTRL_SPEED_MASK    (7U << 3)

#define CTRL_SET_ENABLE(reg)       ((reg) |= CTRL_ENABLE_MASK)
#define CTRL_SET_MODE(reg, mode)   ((reg) = ((reg) & ~CTRL_MODE_MASK) | (((mode) & 0x3) << 1))
```

---

### Câu 8: Macro vs Inline function — khi nào dùng cái nào?

**Đáp án:**

| Đặc điểm | Macro (`#define`) | Inline function |
|-----------|-------------------|-----------------|
| Xử lý bởi | Preprocessor (text replacement) | Compiler |
| Type checking | Không | Có |
| Debugging | Khó (code đã được thay thế) | Dễ (có symbol info) |
| Side effects | Có thể gây lỗi | An toàn |
| Scope | Global (từ điểm define) | Theo C scope rules |
| Recursive | Không hỗ trợ | Hỗ trợ |

```c
// Macro - CÓ VẤN ĐỀ
#define SQUARE(x) ((x) * (x))
int a = 5;
int result = SQUARE(a++); // Lỗi! a++ được evaluate 2 lần
// Expand thành: ((a++) * (a++)) → Undefined Behavior

// Inline function - AN TOÀN
static inline int square(int x) {
    return x * x;
}
int result = square(a++); // OK, a++ chỉ evaluate 1 lần
```

**Khi nào dùng Macro:**
- Conditional compilation (`#ifdef`, `#ifndef`).
- Hằng số (`#define MAX_SIZE 100`).
- Stringification (`#`) và token pasting (`##`).
- Code generic không phụ thuộc type (dùng `_Generic` trong C11 nếu có).

**Khi nào dùng Inline:**
- Các hàm nhỏ, gọi thường xuyên (thay thế macro function).
- Cần type safety và debug dễ dàng.
- Theo khuyến nghị MISRA C.

---

### Câu 9: Dynamic memory allocation trong embedded — vấn đề gì cần lưu ý?

**Đáp án:**

Trong embedded, **hạn chế hoặc tránh dùng** `malloc()`/`free()` vì:

**1. Fragmentation (phân mảnh bộ nhớ):**
```
Ban đầu:   [████████████████████]  Free heap
Sau alloc: [A][B][C][D][E][F]     Các block
Sau free:  [A][_][C][_][E][F]     Giải phóng B, D
// Không thể cấp phát block lớn dù tổng free đủ!
```

**2. Non-deterministic (không xác định thời gian):**
- `malloc()` mất thời gian không cố định → không phù hợp real-time systems.
- `free()` có thể cần merge các free block.

**3. Memory leak:**
- Quên gọi `free()` → heap cạn dần, system crash sau thời gian dài.
- Đặc biệt nguy hiểm vì embedded system chạy liên tục, không restart.

**4. Heap overflow:**
- Heap và stack có thể đè lên nhau (stack grows down, heap grows up).

**Giải pháp thay thế:**

```c
// 1. Static allocation - cấp phát lúc compile
static uint8_t buffer[BUFFER_SIZE];

// 2. Memory pool - pre-allocate fixed-size blocks
#define POOL_BLOCK_SIZE  64
#define POOL_BLOCK_COUNT 16
static uint8_t pool[POOL_BLOCK_COUNT][POOL_BLOCK_SIZE];
static uint8_t pool_used[POOL_BLOCK_COUNT] = {0};

void *pool_alloc(void) {
    for (int i = 0; i < POOL_BLOCK_COUNT; i++) {
        if (!pool_used[i]) {
            pool_used[i] = 1;
            return pool[i];
        }
    }
    return NULL; // Pool exhausted
}

void pool_free(void *ptr) {
    for (int i = 0; i < POOL_BLOCK_COUNT; i++) {
        if (pool[i] == ptr) {
            pool_used[i] = 0;
            return;
        }
    }
}

// 3. Stack allocation (alloca) - cấp phát trên stack (cẩn thận stack overflow)
```

---

### Câu 10: Callback function là gì? Cho ví dụ trong embedded.

**Đáp án:**

**Callback function** là một hàm được truyền như tham số cho hàm khác, và được gọi lại (callback) khi một sự kiện xảy ra. Trong embedded, callback thường dùng trong:
- Xử lý ngắt (ISR callback)
- Timer callback
- Event-driven programming

```c
#include <stdint.h>
#include <stddef.h>

// Định nghĩa kiểu callback
typedef void (*gpio_callback_t)(uint8_t pin, uint8_t state);

// Mảng lưu callback cho mỗi pin
#define MAX_PINS 16
static gpio_callback_t pin_callbacks[MAX_PINS] = {NULL};

// Đăng ký callback
int gpio_register_callback(uint8_t pin, gpio_callback_t cb) {
    if (pin >= MAX_PINS) return -1;
    pin_callbacks[pin] = cb;
    return 0;
}

// Hủy đăng ký
void gpio_unregister_callback(uint8_t pin) {
    if (pin < MAX_PINS) {
        pin_callbacks[pin] = NULL;
    }
}

// ISR gọi callback khi có interrupt
void GPIO_IRQHandler(void) {
    for (uint8_t pin = 0; pin < MAX_PINS; pin++) {
        if (gpio_interrupt_pending(pin)) {
            gpio_clear_interrupt(pin);
            if (pin_callbacks[pin] != NULL) {
                pin_callbacks[pin](pin, gpio_read_pin(pin));
            }
        }
    }
}

// === Application code ===
void button_pressed(uint8_t pin, uint8_t state) {
    if (state == 0) { // Active low
        toggle_led();
    }
}

void main(void) {
    gpio_register_callback(PIN_BUTTON, button_pressed);
    while (1) {
        // Main loop
    }
}
```

**Ưu điểm callback:**
- Tách biệt driver layer và application layer (loose coupling).
- Driver không cần biết logic xử lý cụ thể.
- Dễ tái sử dụng driver cho các project khác.

---

### Câu 11: Sự khác nhau giữa `#include <header.h>` và `#include "header.h"`?

**Đáp án:**

- `#include <header.h>`: Tìm file trong **system include paths** (thư mục chuẩn của compiler, SDK). Dùng cho standard library và third-party library headers.
- `#include "header.h"`: Tìm file trong **thư mục hiện tại** trước, nếu không tìm thấy thì tìm trong system include paths. Dùng cho project headers.

```c
#include <stdio.h>       // System header
#include <stdint.h>       // System header
#include "my_driver.h"    // Project header
#include "config.h"       // Project header
```

**Header guard** để tránh include nhiều lần:
```c
// Cách 1: #ifndef guard
#ifndef MY_DRIVER_H
#define MY_DRIVER_H
// Nội dung header
#endif

// Cách 2: #pragma once (không chuẩn nhưng hầu hết compiler hỗ trợ)
#pragma once
```

---

### Câu 12: Giải thích sự khác nhau giữa `const int *p`, `int *const p`, và `const int *const p`.

**Đáp án:**

```c
int a = 10, b = 20;

// 1. Pointer to const: giá trị TRỎ ĐẾN không đổi, pointer có thể trỏ nơi khác
const int *p1 = &a;
// *p1 = 30;  // LỖI: không thể thay đổi giá trị
p1 = &b;      // OK: pointer có thể trỏ đến b

// 2. Const pointer: pointer KHÔNG THỂ trỏ nơi khác, giá trị trỏ đến có thể đổi
int *const p2 = &a;
*p2 = 30;     // OK: có thể thay đổi giá trị
// p2 = &b;   // LỖI: không thể thay đổi pointer

// 3. Const pointer to const: cả hai đều không đổi
const int *const p3 = &a;
// *p3 = 30;  // LỖI
// p3 = &b;   // LỖI
```

**Mẹo đọc:** Đọc từ phải sang trái:
- `const int *p` → p is a pointer to const int.
- `int *const p` → p is a const pointer to int.
- `const int *const p` → p is a const pointer to const int.

**Ứng dụng trong embedded:**
```c
// Hardware register (read-only status register)
const volatile uint32_t *STATUS = (const volatile uint32_t *)0x40020000;

// Const pointer to hardware register (địa chỉ cố định)
volatile uint32_t *const GPIO_ODR = (volatile uint32_t *)0x40020014;
```

---


## 2. RTOS & Bare-metal

### Câu 1: Phân biệt Task, Thread và Process.

**Đáp án:**

| Đặc điểm | Process | Thread | Task (RTOS) |
|-----------|---------|--------|-------------|
| Không gian bộ nhớ | Riêng biệt (isolated) | Chia sẻ trong cùng process | Chia sẻ (thường flat memory) |
| Context switch | Nặng (đổi page table, TLB flush) | Nhẹ hơn process | Nhẹ nhất (chỉ lưu registers + stack) |
| Overhead tạo mới | Cao | Trung bình | Thấp |
| Communication | IPC (pipe, socket, shared mem) | Shared memory trực tiếp | Shared variables, queue, mailbox |
| Crash isolation | Process khác không ảnh hưởng | Một thread crash → cả process crash | Một task crash → cả system crash |
| Ví dụ | Linux processes | pthreads | FreeRTOS tasks |

**Trong RTOS (FreeRTOS, Zephyr):**
- **Task** = Thread (hai thuật ngữ thường dùng thay thế nhau).
- Mỗi task có **riêng stack** nhưng **chung address space**.
- Mỗi task có **TCB (Task Control Block)**: lưu stack pointer, priority, state, ...

```c
// FreeRTOS example
void vTask1(void *pvParameters) {
    while (1) {
        // Task logic
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

int main(void) {
    xTaskCreate(vTask1, "Task1", 256, NULL, 1, NULL);
    // Stack size: 256 words, Priority: 1
    vTaskStartScheduler();
}
```

---

### Câu 2: Giải thích các thuật toán scheduling trong RTOS.

**Đáp án:**

**1. Priority-based Preemptive Scheduling:**
- Task có priority cao nhất sẵn sàng sẽ LUÔN chạy.
- Task đang chạy bị preempt ngay khi task priority cao hơn ready.
- Dùng phổ biến nhất trong RTOS (FreeRTOS, Zephyr, VxWorks).

```
Task A (Priority 3): ████          ██████
Task B (Priority 2):     ████              ████
Task C (Priority 1):         ████████████
                     ─────────────────────────────→ Time
```

**2. Round-Robin (cho cùng priority):**
- Các task có cùng priority sẽ luân phiên chạy, mỗi task chạy một **time slice**.
- Khi hết time slice, scheduler chuyển sang task tiếp theo cùng priority.

```
Task A (P1): ██  ██  ██  ██
Task B (P1):   ██  ██  ██  ██
             ────────────────→ Time
             ^  ^
             Time slice
```

**3. Cooperative Scheduling:**
- Task tự nguyện nhường CPU bằng cách gọi `yield()` hoặc hàm blocking.
- Không có preemption → task phải "hợp tác".
- Đơn giản nhưng một task có thể block toàn bộ system.

**4. Rate Monotonic Scheduling (RMS):**
- Dùng trong hard real-time systems.
- Task có period ngắn hơn được gán priority cao hơn.
- Schedulable nếu: $U = \sum_{i=1}^{n} \frac{C_i}{T_i} \leq n(2^{1/n} - 1)$

---

### Câu 3: Mutex vs Semaphore — khác nhau thế nào?

**Đáp án:**

| Đặc điểm | Mutex | Semaphore |
|-----------|-------|-----------|
| Mục đích | Mutual Exclusion (bảo vệ tài nguyên) | Signaling / Counting |
| Ownership | Có (chỉ task lock mới unlock được) | Không có ownership |
| Count | Binary (0 hoặc 1) | Counting (0 đến N) |
| Priority Inheritance | Hỗ trợ | Không hỗ trợ |
| Recursive | Có thể (recursive mutex) | Không |
| Use case | Protect shared resource | Sync between tasks/ISR |

```c
// === MUTEX: Bảo vệ tài nguyên dùng chung ===
SemaphoreHandle_t xMutex = xSemaphoreCreateMutex();

void task_write_uart(void *pv) {
    while (1) {
        if (xSemaphoreTake(xMutex, portMAX_DELAY) == pdTRUE) {
            // Critical section - chỉ 1 task truy cập UART
            uart_send("Data from task\n");
            xSemaphoreGive(xMutex);
        }
    }
}

// === BINARY SEMAPHORE: Signaling từ ISR đến Task ===
SemaphoreHandle_t xBinarySem = xSemaphoreCreateBinary();

void UART_IRQHandler(void) {
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;
    // Signal cho task xử lý
    xSemaphoreGiveFromISR(xBinarySem, &xHigherPriorityTaskWoken);
    portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
}

void task_process(void *pv) {
    while (1) {
        // Chờ signal từ ISR
        if (xSemaphoreTake(xBinarySem, portMAX_DELAY) == pdTRUE) {
            process_received_data();
        }
    }
}

// === COUNTING SEMAPHORE: Quản lý resource pool ===
SemaphoreHandle_t xCountSem = xSemaphoreCreateCounting(3, 3);
// Max 3, Initial 3 → 3 resources available
```

---

### Câu 4: Priority Inversion là gì? Cách giải quyết?

**Đáp án:**

**Priority Inversion** xảy ra khi task priority CAO bị block bởi task priority THẤP (gián tiếp qua shared resource).

```
Scenario (KHÔNG có priority inheritance):

Task H (High P):    ████░░░░░░░░░░░░░████  (bị block chờ mutex)
Task M (Medium P):      ██████████████      (chạy vì H bị block!)
Task L (Low P):     ████                 ██ (giữ mutex, bị M preempt)
                    ────────────────────────→ Time
                        ↑ L lock mutex
                            ↑ H muốn mutex → bị block
                            ↑ M preempt L → H phải chờ cả M!
```

**Vấn đề:** Task H (cao nhất) phải chờ cả Task M hoàn thành, dù M không liên quan đến resource. Thời gian block của H trở nên **không xác định** (unbounded).

**Giải pháp:**

**1. Priority Inheritance Protocol:**
- Khi task H chờ mutex mà task L đang giữ → tạm thời nâng priority của L lên bằng H.
- L chạy với priority cao → M không preempt được → L nhanh chóng unlock → H chạy.

```
Với Priority Inheritance:

Task H (High P):    ████░░██████████████
Task M (Medium P):                      ██████
Task L (Low P→H):   ████████                   (priority tạm nâng lên H)
                    ────────────────────→ Time
```

**2. Priority Ceiling Protocol:**
- Mỗi mutex có **ceiling priority** = priority cao nhất của tất cả task có thể dùng mutex đó.
- Khi task lock mutex → priority tạm nâng lên ceiling.
- Ngăn chặn hoàn toàn priority inversion và deadlock.

```c
// FreeRTOS sử dụng Priority Inheritance tự động cho Mutex
SemaphoreHandle_t xMutex = xSemaphoreCreateMutex();
// Binary Semaphore KHÔNG có priority inheritance
// → Dùng Mutex khi cần protect shared resource
```

---

### Câu 5: Deadlock là gì? Điều kiện và cách phòng tránh?

**Đáp án:**

**Deadlock** xảy ra khi hai hay nhiều task chờ lẫn nhau vĩnh viễn, không task nào có thể tiến lên.

```c
// Task A                          // Task B
xSemaphoreTake(mutexX, MAX);       xSemaphoreTake(mutexY, MAX);
xSemaphoreTake(mutexY, MAX);       xSemaphoreTake(mutexX, MAX);
// → Task A giữ X, chờ Y          // → Task B giữ Y, chờ X
// → DEADLOCK!
```

**4 điều kiện Coffman (cần đồng thời cả 4):**
1. **Mutual Exclusion**: Tài nguyên chỉ 1 task dùng tại 1 thời điểm.
2. **Hold and Wait**: Task giữ tài nguyên và chờ thêm tài nguyên khác.
3. **No Preemption**: Không thể cưỡng chế lấy tài nguyên từ task.
4. **Circular Wait**: Tồn tại chuỗi chờ vòng tròn (A→B→C→A).

**Cách phòng tránh:**

```c
// 1. Lock ordering: Luôn lock theo thứ tự cố định
// Task A                          // Task B
xSemaphoreTake(mutexX, MAX);       xSemaphoreTake(mutexX, MAX); // X trước
xSemaphoreTake(mutexY, MAX);       xSemaphoreTake(mutexY, MAX); // Y sau

// 2. Try-lock với timeout
if (xSemaphoreTake(mutexX, pdMS_TO_TICKS(100)) == pdTRUE) {
    if (xSemaphoreTake(mutexY, pdMS_TO_TICKS(100)) == pdTRUE) {
        // Cả hai mutex đã lock
        xSemaphoreGive(mutexY);
    }
    xSemaphoreGive(mutexX);
}

// 3. Giảm số lượng mutex: dùng 1 mutex bảo vệ nhiều resource
// 4. Dùng Priority Ceiling Protocol
```

---

### Câu 6: ISR (Interrupt Service Routine) — Quy tắc viết ISR trong embedded?

**Đáp án:**

**ISR** là hàm được gọi tự động khi có ngắt (interrupt) từ hardware. Vì ISR chạy trong interrupt context, cần tuân thủ các quy tắc:

**Nguyên tắc QUAN TRỌNG:**

1. **Ngắn gọn, nhanh nhất có thể** (< vài μs):
   - Chỉ đọc data, set flag, đưa data vào queue.
   - Xử lý nặng để cho task (deferred processing).

2. **KHÔNG gọi hàm blocking/chờ**:
   - Không `vTaskDelay()`, không `xSemaphoreTake()` (chỉ dùng `...FromISR()`).
   - Không `printf()`, không `malloc()`.

3. **Biến chia sẻ phải dùng `volatile`**.

4. **Phải clear interrupt flag** (nếu không, ISR gọi lặp vô hạn).

5. **Cẩn thận với reentrancy**.

```c
// ❌ SAI - ISR quá dài, gọi hàm blocking
void UART_IRQHandler(void) {
    char buffer[100];
    sprintf(buffer, "Received: %c", UART->DR);  // Quá chậm!
    printf("%s\n", buffer);                       // Blocking!
    process_data();                               // Xử lý nặng!
}

// ✅ ĐÚNG - ISR ngắn, defer xử lý cho task
volatile uint8_t rx_data;
volatile uint8_t rx_flag = 0;

void UART_IRQHandler(void) {
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;
    
    if (UART->SR & UART_SR_RXNE) {     // Check interrupt source
        rx_data = UART->DR;             // Đọc data (cũng clear flag)
        
        // Signal cho task xử lý
        xSemaphoreGiveFromISR(xRxSem, &xHigherPriorityTaskWoken);
    }
    
    portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
}

// Task xử lý data
void uart_task(void *pv) {
    while (1) {
        xSemaphoreTake(xRxSem, portMAX_DELAY);
        // Xử lý nặng ở đây - OK vì đang trong task context
        process_received_byte(rx_data);
    }
}
```

**Interrupt Latency** = Thời gian từ khi xảy ra sự kiện đến khi dòng đầu tiên của ISR chạy.
- Bao gồm: finish current instruction + save context + vector fetch + pipeline flush.
- ARM Cortex-M: ~12 cycles (với tail-chaining, zero-jitter).

---

### Câu 7: Spinlock là gì? Khi nào dùng Spinlock thay vì Mutex?

**Đáp án:**

**Spinlock** là cơ chế đồng bộ mà task **busy-wait (quay vòng)** liên tục kiểm tra lock thay vì sleep.

```c
// Pseudo-code spinlock
typedef volatile int spinlock_t;

void spin_lock(spinlock_t *lock) {
    while (__sync_lock_test_and_set(lock, 1)) {
        // Busy-wait: CPU liên tục kiểm tra
    }
}

void spin_unlock(spinlock_t *lock) {
    __sync_lock_release(lock);
}
```

| Đặc điểm | Spinlock | Mutex |
|-----------|----------|-------|
| Khi lock đã bị giữ | Busy-wait (tiêu tốn CPU) | Sleep (nhường CPU) |
| Context switch | Không | Có |
| Phù hợp | Critical section RẤT ngắn | Critical section dài |
| Dùng trong ISR | Có thể (trên multicore) | Không |
| Multicore | Rất phù hợp | Phù hợp |
| Single-core | KHÔNG nên dùng (waste CPU) | Phù hợp |

**Khi nào dùng Spinlock:**
- **Multi-core system**: Protect shared resource giữa các core, critical section rất ngắn.
- **ISR context trên multi-core**: Không thể sleep trong ISR.
- **Linux kernel**: `spin_lock_irqsave()` — lock + disable interrupt trên core hiện tại.

**Khi nào dùng Mutex:**
- **Single-core**: Spinlock trên single-core lãng phí CPU vì task giữ lock không thể chạy.
- **Critical section dài**: Overhead context switch < wasted CPU cycles từ busy-wait.

---

### Câu 8: Context Switching là gì? Quá trình diễn ra thế nào?

**Đáp án:**

**Context switching** là quá trình lưu trạng thái (context) của task đang chạy và khôi phục context của task tiếp theo.

**Context bao gồm:**
- Program Counter (PC)
- Stack Pointer (SP)
- General Purpose Registers (R0-R12 trên ARM)
- Status Register (xPSR trên ARM)
- FPU registers (nếu có)

**Quá trình trên ARM Cortex-M (FreeRTOS):**

```
1. Trigger: SysTick interrupt hoặc PendSV
   
2. Hardware tự động push (stacking):
   xPSR, PC, LR, R12, R3, R2, R1, R0 → Task A's stack

3. PendSV Handler (software):
   - Push R4-R11 → Task A's stack
   - Lưu SP hiện tại vào TCB của Task A
   - Gọi scheduler chọn task tiếp theo (Task B)
   - Load SP từ TCB của Task B
   - Pop R4-R11 ← Task B's stack

4. Return từ PendSV:
   Hardware tự động pop (unstacking):
   R0, R1, R2, R3, R12, LR, PC, xPSR ← Task B's stack

5. Task B tiếp tục chạy từ điểm dừng trước đó
```

**Overhead:**
- Thời gian: vài μs đến vài chục μs tùy MCU.
- Bộ nhớ: mỗi task cần stack riêng (thường 256 bytes - vài KB).
- ARM Cortex-M có **lazy stacking** cho FPU registers để giảm overhead.

---

### Câu 9: Watchdog Timer là gì? Các loại watchdog?

**Đáp án:**

**Watchdog Timer (WDT)** là timer phần cứng tự động reset hệ thống nếu software không "feed" (reload) đúng thời hạn. Mục đích: phát hiện và phục hồi từ software hang/crash.

**Các loại:**

**1. Independent Watchdog (IWDG):**
- Clock riêng (LSI), hoạt động độc lập với system clock.
- Nếu system clock fail, IWDG vẫn hoạt động.
- Chỉ cần feed trước khi timeout.

**2. Window Watchdog (WWDG):**
- Phải feed trong một **cửa sổ thời gian** (window): không quá sớm, không quá muộn.
- Phát hiện cả trường hợp software chạy quá nhanh (lỗi logic).

```
IWDG:   Feed bất kỳ lúc nào trước timeout
        |←────── timeout ──────→|
        ████████████████████████│ RESET!
        ↑ Feed OK  ↑ Feed OK

WWDG:   Feed chỉ trong window
        |← too early →|← window →|
        ████████████████│██████████│ RESET!
        ↑ Feed = RESET! ↑ Feed OK  ↑ No feed = RESET!
```

```c
// STM32 IWDG example
void watchdog_init(void) {
    IWDG->KR = 0x5555;        // Unlock access
    IWDG->PR = IWDG_PR_DIV64; // Prescaler
    IWDG->RLR = 1000;         // Reload value (~2s timeout)
    IWDG->KR = 0xCCCC;        // Start IWDG
}

void watchdog_feed(void) {
    IWDG->KR = 0xAAAA;        // Reload counter
}

// Main loop phải feed watchdog định kỳ
void main(void) {
    watchdog_init();
    while (1) {
        application_task();
        watchdog_feed(); // Nếu application_task() bị hang → không feed → RESET
    }
}
```

**Multi-core watchdog (liên quan đến kinh nghiệm của ứng viên):**
- Mỗi core có watchdog riêng.
- Failsafe mechanism: nếu một core fail, core khác phát hiện và xử lý.

---

### Câu 10: Timer trong embedded — các mode hoạt động?

**Đáp án:**

Timer là peripheral đếm xung clock, có nhiều mode:

**1. Timer Mode (Basic counting):**
- Đếm lên/xuống, tạo interrupt khi overflow/underflow.
- Dùng: delay chính xác, time measurement, periodic interrupt.

**2. Output Compare (OC) Mode:**
- So sánh counter với giá trị preset, tạo event khi match.
- Dùng: tạo tín hiệu PWM, toggle pin tại thời điểm chính xác.

**3. Input Capture (IC) Mode:**
- Capture giá trị counter khi có edge trên input pin.
- Dùng: đo tần số, đo pulse width, đo duty cycle.

**4. PWM Mode:**
- Tạo tín hiệu PWM với tần số và duty cycle configurate được.
- Dùng: điều khiển motor, LED dimming, DAC software.

```c
// STM32 Timer - PWM example (register level)
void timer_pwm_init(void) {
    RCC->APB1ENR |= RCC_APB1ENR_TIM2EN;  // Enable TIM2 clock
    
    TIM2->PSC = 84 - 1;      // Prescaler: 84MHz / 84 = 1MHz
    TIM2->ARR = 1000 - 1;    // Period: 1MHz / 1000 = 1kHz PWM
    TIM2->CCR1 = 500;        // Duty cycle: 500/1000 = 50%
    
    TIM2->CCMR1 = (6 << TIM_CCMR1_OC1M_Pos); // PWM Mode 1
    TIM2->CCER |= TIM_CCER_CC1E;              // Enable CH1 output
    TIM2->CR1 |= TIM_CR1_CEN;                 // Start timer
}

void set_duty_cycle(uint16_t duty) {
    TIM2->CCR1 = duty; // 0-999 → 0%-100%
}
```

---

### Câu 11: Bare-metal vs RTOS — khi nào chọn cái nào?

**Đáp án:**

| Tiêu chí | Bare-metal (Super Loop) | RTOS |
|-----------|------------------------|------|
| Complexity | Đơn giản | Trung bình - Phức tạp |
| Real-time response | Phụ thuộc loop timing | Deterministic (ưu tiên) |
| Multitasking | Polling / State machine | True preemptive multitasking |
| Memory overhead | Không | 5-20KB ROM + RAM cho mỗi task |
| Power consumption | Dễ tối ưu | Cần cấu hình tickless mode |
| Debugging | Đơn giản | Phức tạp hơn (race condition) |
| Phù hợp | Ứng dụng đơn giản, MCU nhỏ | Ứng dụng phức tạp, nhiều task |

```c
// Bare-metal super loop
void main(void) {
    system_init();
    while (1) {
        read_sensors();      // Chạy tuần tự
        process_data();      // Nếu hàm nào chậm → ảnh hưởng cả hệ thống
        update_display();
        check_communication();
    }
}

// RTOS - mỗi chức năng là task riêng
void sensor_task(void *pv) {
    while (1) {
        read_sensors();
        vTaskDelay(pdMS_TO_TICKS(10)); // 100Hz
    }
}
void display_task(void *pv) {
    while (1) {
        update_display();
        vTaskDelay(pdMS_TO_TICKS(50)); // 20Hz
    }
}
```

**Chọn Bare-metal khi:**
- MCU nhỏ (8-bit, RAM < 4KB).
- Ứng dụng đơn giản, ít tác vụ.
- Cần kiểm soát hoàn toàn timing.

**Chọn RTOS khi:**
- Nhiều tác vụ với mức ưu tiên khác nhau.
- Cần đáp ứng real-time.
- Dự án phức tạp, cần modularity.

---


## 3. Communication Protocols

### Câu 1: Giao thức I2C hoạt động như thế nào? Giải thích chi tiết.

**Đáp án:**

**I2C (Inter-Integrated Circuit)** là giao thức serial **half-duplex**, sử dụng 2 dây:
- **SDA** (Serial Data): Truyền/nhận dữ liệu.
- **SCL** (Serial Clock): Clock do Master tạo.

Cả hai dây đều dùng **open-drain** với **pull-up resistor** (thường 4.7kΩ).

**Đặc điểm:**
- Multi-master, multi-slave.
- Tốc độ: 100kHz (Standard), 400kHz (Fast), 1MHz (Fast-mode Plus), 3.4MHz (High-Speed).
- Addressing: 7-bit (128 địa chỉ) hoặc 10-bit (1024 địa chỉ).

**Quá trình truyền:**

```
Master Write:
    START │ Slave Addr (7bit) │ W(0) │ ACK │ Reg Addr │ ACK │ Data │ ACK │ STOP
    ──────┤──────────────────┤──────┤─────┤──────────┤─────┤──────┤─────┤──────
          │    Master gửi     │      │Slave│ Master   │Slave│Master│Slave│
          
Master Read:
    START │ Addr │ W │ ACK │ Reg │ ACK │ Re-START │ Addr │ R(1) │ ACK │ Data │ NACK │ STOP
    ──────┤──────┤───┤─────┤─────┤─────┤──────────┤──────┤──────┤─────┤──────┤──────┤──────
          │      │   │     │     │     │          │      │      │     │Slave │Master│
                                                                      │ gửi  │(kết  │
                                                                      │      │thúc) │
```

**Clock Stretching:**
- Slave giữ SCL LOW để yêu cầu master đợi (slave cần thời gian xử lý).
- Master phải kiểm tra SCL trước khi tiếp tục.

**Arbitration (Multi-master):**
- Khi 2 master cùng truyền, master nào gửi bit 1 nhưng đọc lại SDA = 0 → thua arbitration → ngừng truyền.
- Quá trình không phá hỏng dữ liệu (non-destructive).

```c
// I2C read example (STM32 HAL)
HAL_StatusTypeDef i2c_read_reg(uint8_t dev_addr, uint8_t reg, uint8_t *data, uint16_t len) {
    return HAL_I2C_Mem_Read(&hi2c1, dev_addr << 1, reg, 
                            I2C_MEMADD_SIZE_8BIT, data, len, 100);
}
```

---

### Câu 2: Giao thức SPI — các mode hoạt động và cách kết nối.

**Đáp án:**

**SPI (Serial Peripheral Interface)** là giao thức serial **full-duplex**, sử dụng 4 dây:
- **MOSI** (Master Out Slave In): Data từ Master → Slave.
- **MISO** (Master In Slave Out): Data từ Slave → Master.
- **SCLK** (Serial Clock): Clock do Master tạo.
- **CS/SS** (Chip Select): Active LOW, chọn slave.

**4 SPI Modes** (dựa trên CPOL và CPHA):

| Mode | CPOL | CPHA | Mô tả |
|------|------|------|--------|
| 0 | 0 | 0 | Clock idle LOW, sample on RISING edge |
| 1 | 0 | 1 | Clock idle LOW, sample on FALLING edge |
| 2 | 1 | 0 | Clock idle HIGH, sample on FALLING edge |
| 3 | 1 | 1 | Clock idle HIGH, sample on RISING edge |

```
CPOL=0, CPHA=0 (Mode 0):
SCLK:   ─┐┌┐┌┐┌┐┌┐┌┐┌┐┌┐┌─
          └┘└┘└┘└┘└┘└┘└┘└┘
MOSI:   ─X──X──X──X──X──X──X──X─  (data thay đổi ở falling, sample ở rising)
CS:     ─┘                      └─
```

**So sánh SPI vs I2C:**

| Đặc điểm | SPI | I2C |
|-----------|-----|-----|
| Số dây | 4 + (N-1) CS | 2 (SDA, SCL) |
| Tốc độ | Nhanh hơn (> 10MHz) | Chậm hơn (≤ 3.4MHz) |
| Duplex | Full-duplex | Half-duplex |
| Addressing | Hardware (CS pin) | Software (7/10-bit addr) |
| Slaves | Cần CS riêng cho mỗi slave | Nhiều slave trên 2 dây |
| Complexity | Đơn giản | Phức tạp hơn (ACK, arbitration) |

---

### Câu 3: UART — Cách hoạt động, baud rate, flow control.

**Đáp án:**

**UART (Universal Asynchronous Receiver-Transmitter)** là giao thức serial **asynchronous** (không có clock chung), dùng 2 dây:
- **TX** (Transmit): Gửi data.
- **RX** (Receive): Nhận data.

**Frame format:**

```
Idle │ Start │ D0 │ D1 │ D2 │ D3 │ D4 │ D5 │ D6 │ D7 │ Parity │ Stop │ Idle
 1   │   0   │ LSB ─────────────────────────────── MSB │ (opt)  │ 1(2) │  1
```

- **Start bit**: Luôn là 0 (kéo line xuống LOW).
- **Data bits**: 7, 8, hoặc 9 bits.
- **Parity** (tùy chọn): Even, Odd, None.
- **Stop bits**: 1 hoặc 2 bits (luôn là 1 = HIGH).

**Baud rate**: Số bit truyền mỗi giây. Hai bên PHẢI cùng baud rate.
- Phổ biến: 9600, 115200, 921600.
- Sai lệch cho phép: thường < 2-3%.

**Flow Control:**

**1. Hardware flow control (RTS/CTS):**
```
Device A                Device B
TX ────────────────────→ RX
RX ←──────────────────── TX
RTS ───────────────────→ CTS   (A sẵn sàng nhận → báo B)
CTS ←─────────────────── RTS   (B sẵn sàng nhận → báo A)
```
- **RTS** (Request To Send): "Tôi sẵn sàng nhận data".
- **CTS** (Clear To Send): "Bạn có thể gửi data".

**2. Software flow control (XON/XOFF):**
- Gửi ký tự XON (0x11) để tiếp tục, XOFF (0x13) để dừng.
- Đơn giản nhưng không dùng được cho binary data.

```c
// UART Init (STM32 register level)
void uart_init(uint32_t baud) {
    // Enable clock
    RCC->APB2ENR |= RCC_APB2ENR_USART1EN;
    
    // Baud rate: BRR = fck / baud
    USART1->BRR = SystemCoreClock / baud;
    
    // Enable TX, RX, USART
    USART1->CR1 = USART_CR1_TE | USART_CR1_RE | USART_CR1_UE;
}

void uart_send_byte(uint8_t data) {
    while (!(USART1->SR & USART_SR_TXE));  // Chờ TX buffer trống
    USART1->DR = data;
}

uint8_t uart_recv_byte(void) {
    while (!(USART1->SR & USART_SR_RXNE)); // Chờ có data
    return USART1->DR;
}
```

---

### Câu 4: CAN Bus — Arbitration, Error handling, CAN FD.

**Đáp án:**

**CAN (Controller Area Network)** là giao thức truyền thông phổ biến trong automotive, dùng 2 dây differential (CAN_H, CAN_L).

**Đặc điểm:**
- Multi-master, message-based (không có addressing như I2C).
- Tốc độ: CAN 2.0 lên đến 1Mbps, CAN FD lên đến 8Mbps (data phase).
- Khoảng cách: đến 1km (ở 50kbps).

**CAN Frame:**

```
SOF │ Identifier (11bit) │ RTR │ IDE │ r0 │ DLC(4) │ Data (0-8 bytes) │ CRC │ ACK │ EOF
```

**Arbitration (Phân xử bus):**
- Non-destructive bitwise arbitration.
- Dominant (0) thắng Recessive (1).
- Node có ID **nhỏ hơn** (nhiều bit 0 hơn) → priority **cao hơn**.

```
Node A (ID=0x100): 0 0 1 0 0 0 0 0 0 0 0  (binary: 00100000000)
Node B (ID=0x200): 0 1 0 ← Node B đọc lại bus = 0 (do A gửi 0)
                        ↑ B gửi 1 (recessive) nhưng bus = 0 (dominant)
                        → B thua arbitration, ngừng truyền, thử lại sau
```

**Error Handling — 5 loại lỗi:**
1. **Bit Error**: Node gửi bit nhưng đọc lại khác (trừ arbitration field).
2. **Stuff Error**: 6 bits cùng giá trị liên tiếp (vi phạm bit stuffing rule: sau 5 bit giống nhau phải chèn 1 bit ngược lại).
3. **CRC Error**: CRC nhận được không khớp CRC tính toán.
4. **Form Error**: Sai format ở fixed-form fields (EOF, ACK delimiter, ...).
5. **ACK Error**: Transmitter không nhận được ACK từ bất kỳ receiver nào.

**Error Counters (TEC/REC):**
- Mỗi node có Transmit Error Counter (TEC) và Receive Error Counter (REC).
- **Error Active** (TEC/REC < 128): Gửi Active Error Frame.
- **Error Passive** (128 ≤ TEC/REC < 256): Gửi Passive Error Frame.
- **Bus Off** (TEC ≥ 256): Node ngắt khỏi bus, cần 128 × 11 recessive bits để recover.

**CAN FD (Flexible Data-rate):**
- Tăng payload từ 8 lên **64 bytes**.
- Tăng tốc độ phase dữ liệu (data phase) lên **8Mbps** (arbitration phase vẫn ≤ 1Mbps).
- Thêm BRS (Bit Rate Switch) bit.

```c
// CANoe - liên quan đến kinh nghiệm testing của ứng viên
// CAPL script example
on message CAN1.0x100 {
    write("Received message ID=0x%X, DLC=%d", this.id, this.dlc);
    write("Data: %02X %02X %02X %02X", this.byte(0), this.byte(1), 
          this.byte(2), this.byte(3));
}
```

---

### Câu 5: So sánh CAN, CAN FD, LIN. Khi nào dùng giao thức nào?

**Đáp án:**

| Đặc điểm | CAN 2.0 | CAN FD | LIN |
|-----------|---------|--------|-----|
| Tốc độ | ≤ 1 Mbps | ≤ 8 Mbps (data) | ≤ 20 kbps |
| Payload | 0-8 bytes | 0-64 bytes | 0-8 bytes |
| Topology | Bus | Bus | Bus (1 master, N slaves) |
| Dây | 2 (differential) | 2 (differential) | 1 (single wire) |
| Multi-master | Có | Có | Không (master-slave) |
| Chi phí | Trung bình | Trung bình | Thấp |
| Ứng dụng | Powertrain, chassis | Firmware update, ADAS | Body (cửa sổ, gương, đèn) |

**Khi nào dùng:**
- **CAN**: Truyền thông real-time, safety-critical (ECU chính, ABS, airbag).
- **CAN FD**: Cần bandwidth lớn hơn CAN 2.0 (firmware update OTA, sensor data lớn).
- **LIN**: Ứng dụng đơn giản, không critical, tiết kiệm chi phí (điều khiển gương, ghế, cửa sổ).

---

### Câu 6: IPC (Inter-Process Communication) — Các phương pháp phổ biến.

**Đáp án:**

**IPC** là cơ chế cho phép các process/thread giao tiếp và đồng bộ dữ liệu.

| Phương pháp | Mô tả | Ưu điểm | Nhược điểm |
|-------------|--------|----------|------------|
| **Shared Memory** | Vùng nhớ chung giữa processes | Nhanh nhất | Cần synchronization |
| **Message Queue** | Hàng đợi tin nhắn | Async, type-safe | Overhead copy data |
| **Pipe/Named Pipe** | Stream data một chiều/hai chiều | Đơn giản | Chỉ related processes (pipe) |
| **Socket** | Communication qua network stack | Cross-network | Overhead lớn nhất |
| **Signal** | Thông báo sự kiện (async) | Nhẹ | Hạn chế thông tin |
| **Semaphore** | Đồng bộ giữa processes | Đơn giản | Chỉ sync, không truyền data |

**IDC (Inter-Core Communication)** — liên quan đến kinh nghiệm ứng viên:

Trong multi-core SoC (như TCC8030), các core giao tiếp qua:

```c
// 1. Shared Memory + Mailbox (hardware interrupt)
// Core A53 ghi data vào shared memory, gửi mailbox interrupt cho R5
volatile shared_mem_t *shm = (volatile shared_mem_t *)SHARED_MEM_BASE;

// Core A53 (sender)
void send_to_r5(uint8_t *data, uint32_t len) {
    memcpy((void *)shm->buffer, data, len);
    shm->length = len;
    __DSB(); // Data Synchronization Barrier - ensure write completed
    MAILBOX->SEND = R5_CORE_ID; // Trigger interrupt on R5
}

// Core R5 (receiver)
void mailbox_isr(void) {
    uint32_t len = shm->length;
    process_data((uint8_t *)shm->buffer, len);
    MAILBOX->ACK = A53_CORE_ID;
}
```

---

### Câu 7: Bit stuffing trong CAN là gì? Tại sao cần?

**Đáp án:**

**Bit stuffing** là kỹ thuật chèn thêm bit đảo sau **5 bits liên tiếp cùng giá trị** trên CAN bus.

```
Data gốc:    1 1 1 1 1 0 0 0 0 0 0 1 1
Sau stuffing: 1 1 1 1 1 [0] 0 0 0 0 0 [1] 1 1
                        ↑ stuff bit      ↑ stuff bit
```

**Tại sao cần:**
1. **Đồng bộ clock**: CAN dùng bit transition để đồng bộ (resynchronization). Nếu có quá nhiều bit giống nhau liên tiếp → receiver mất đồng bộ clock.
2. **Error detection**: Nếu receiver thấy 6 bits giống nhau liên tiếp → **Stuff Error**.

**Lưu ý:**
- Bit stuffing áp dụng từ SOF đến CRC (không áp dụng cho CRC delimiter, ACK, EOF).
- CAN FD có bit stuffing khác ở data phase (fixed stuff bits).

---

### Câu 8: I2C có thể giao tiếp tối đa bao nhiêu slave? Giải thích 7-bit và 10-bit addressing.

**Đáp án:**

**7-bit addressing:**
- Lý thuyết: 2^7 = 128 địa chỉ.
- Thực tế: **112 địa chỉ** khả dụng (16 địa chỉ reserved: 0x00-0x07 và 0x78-0x7F).
- Giới hạn thực: phụ thuộc **bus capacitance** (max 400pF) → thường ~20-30 devices.

**10-bit addressing:**
- 2^10 = 1024 địa chỉ.
- Tương thích ngược với 7-bit: dùng reserved address 11110XX để mở rộng.

```
7-bit address frame:
│ S │ A6 A5 A4 A3 A2 A1 A0 │ R/W │ ACK │

10-bit address frame:
│ S │ 1 1 1 1 0 A9 A8 │ R/W │ ACK │ A7 A6 A5 A4 A3 A2 A1 A0 │ ACK │
        (header)                         (2nd byte)
```

**Bus capacitance và Pull-up resistor:**
- Mỗi device thêm ~10-15pF capacitance.
- Pull-up resistor: quá nhỏ → nhiều dòng (hỏng pin), quá lớn → rise time chậm (lỗi ở tốc độ cao).
- Tính toán: $R_{pull-up} = \frac{V_{CC} - V_{OL}}{I_{sink}}$, thường 1kΩ - 10kΩ.

---

### Câu 9: SPI — Giải thích daisy-chain connection và multi-slave.

**Đáp án:**

**Cách 1: Independent Slave (CS riêng cho mỗi slave):**
```
Master ─── MOSI ──→ Slave 1, Slave 2, Slave 3 (parallel)
       ←── MISO ─── Slave 1, Slave 2, Slave 3 (cần tri-state)
       ─── SCLK ──→ Slave 1, Slave 2, Slave 3 (parallel)
       ─── CS1  ──→ Slave 1
       ─── CS2  ──→ Slave 2
       ─── CS3  ──→ Slave 3
```
- Mỗi slave cần 1 CS pin → tốn GPIO.
- Chỉ 1 slave active tại một thời điểm.

**Cách 2: Daisy-Chain (nối tiếp):**
```
Master MOSI → Slave 1 MOSI→MISO → Slave 2 MOSI→MISO → Slave 3 MISO → Master MISO
       SCLK → Slave 1, Slave 2, Slave 3 (parallel)
       CS   → Slave 1, Slave 2, Slave 3 (parallel, 1 CS duy nhất)
```
- Chỉ cần 1 CS pin.
- Data "chảy" qua từng slave.
- Master gửi N × data_size bits, slave cuối cùng nhận data đầu tiên.
- Dùng phổ biến trong LED driver (WS2812), shift register.

---

### Câu 10: Giải thích giao thức FPDLink III (liên quan đến kinh nghiệm ứng viên).

**Đáp án:**

**FPDLink III (Flat Panel Display Link III)** là giao thức truyền video serial hóa tốc độ cao của Texas Instruments, phổ biến trong automotive display systems.

**Đặc điểm:**
- Truyền video HD qua 1 cặp dây differential (STP/coaxial cable).
- Khoảng cách: lên đến 15m.
- Hỗ trợ back-channel: I2C/UART bidirectional qua cùng cable (cho touch, control).
- Serializer (SER) + Deserializer (DES) pair.

**Liên quan đến kinh nghiệm ứng viên:**
- **DS90UB947-Q1**: FPDLink III Serializer (phía SoC/GPU).
- **DS90UB948-Q1**: FPDLink III Deserializer (phía Display).

```
SoC (TCC8030)                              Display Panel
┌──────────┐    FPDLink III Cable    ┌──────────┐
│          │    (1 differential pair) │          │
│  GPU  ──→│ DS90UB947 ══════════════ DS90UB948 │──→ LCD
│          │ (Serializer)            │(Deserializer)│
│          │                         │          │
│  I2C  ←→│ Back-channel ←─────────→│ Touch IC │
│          │ (I2C/GPIO over same     │          │
│          │  cable)                 │          │
└──────────┘                         └──────────┘
```

**Driver development tasks:**
- Cấu hình serializer/deserializer qua I2C.
- Setup video format (resolution, color depth, timing).
- Configure back-channel cho touch panel.
- Handle link training, error detection, re-link.

---


## 4. Embedded Linux

### Câu 1: Giải thích quá trình boot của Linux Embedded.

**Đáp án:**

```
Power ON
    │
    ▼
┌──────────────┐
│  ROM Code     │  CPU chạy code từ ROM nội (fixed address)
│  (Boot ROM)   │  Load bootloader từ Flash/eMMC/SD
└──────┬───────┘
       ▼
┌──────────────┐
│  Bootloader   │  U-Boot (phổ biến nhất)
│  (U-Boot)     │  - Khởi tạo DRAM, clock, peripherals cơ bản
│               │  - Load kernel image + DTB từ storage
│               │  - Truyền bootargs cho kernel
└──────┬───────┘
       ▼
┌──────────────┐
│  Linux Kernel │  - Decompress (nếu zImage/Image.gz)
│               │  - Setup MMU, page tables
│               │  - Init subsystems (scheduler, memory, VFS, ...)
│               │  - Parse Device Tree (DTB)
│               │  - Mount root filesystem
│               │  - Start init process (PID 1)
└──────┬───────┘
       ▼
┌──────────────┐
│  Init System  │  systemd / SysVinit / BusyBox init
│               │  - Mount filesystems
│               │  - Start services/daemons
│               │  - Reach default target/runlevel
└──────┬───────┘
       ▼
┌──────────────┐
│  User Space   │  Applications, GUI, network services...
└──────────────┘
```

**U-Boot flow chi tiết:**
1. **SPL (Secondary Program Loader)**: Code nhỏ chạy từ SRAM, init DRAM, load full U-Boot.
2. **U-Boot proper**: Chạy từ DRAM, cung cấp console, network boot, ...
3. Load kernel: `fatload mmc 0:1 ${loadaddr} zImage`
4. Load DTB: `fatload mmc 0:1 ${fdtaddr} board.dtb`
5. Boot: `bootz ${loadaddr} - ${fdtaddr}`

**Bootargs example:**
```
console=ttyS0,115200 root=/dev/mmcblk0p2 rootfstype=ext4 rw
```

---

### Câu 2: Device Tree là gì? Tại sao cần Device Tree?

**Đáp án:**

**Device Tree (DT)** là cấu trúc dữ liệu mô tả hardware cho kernel, thay thế việc hard-code thông tin hardware trong kernel source.

**Tại sao cần:**
- Trước Device Tree, mỗi board ARM cần file board setup riêng trong kernel → rất nhiều file, khó maintain.
- Device Tree tách biệt mô tả hardware và kernel code → 1 kernel binary chạy được nhiều board khác nhau (chỉ khác DTB file).

**Device Tree Source (.dts):**
```dts
/dts-v1/;

/ {
    compatible = "mycompany,myboard";
    
    cpus {
        cpu@0 {
            compatible = "arm,cortex-a53";
            clock-frequency = <1200000000>;
        };
    };
    
    memory@80000000 {
        device_type = "memory";
        reg = <0x80000000 0x40000000>; /* 1GB at 0x80000000 */
    };
    
    i2c1: i2c@44004000 {
        compatible = "vendor,i2c-controller";
        reg = <0x44004000 0x1000>;
        #address-cells = <1>;
        #size-cells = <0>;
        clock-frequency = <400000>;
        
        /* I2C device: ds90ub948 deserializer */
        deserializer@2c {
            compatible = "ti,ds90ub948";
            reg = <0x2c>;
        };
        
        /* I2C device: touch panel */
        touch@48 {
            compatible = "vendor,touch-ic";
            reg = <0x48>;
            interrupt-parent = <&gpio1>;
            interrupts = <5 IRQ_TYPE_EDGE_FALLING>;
        };
    };
};
```

**Quy trình:**
1. Viết `.dts` (Device Tree Source).
2. Compile bằng `dtc` → `.dtb` (Device Tree Blob - binary).
3. Bootloader load `.dtb` và truyền cho kernel.
4. Kernel parse `.dtb` tại boot time → tạo `platform_device` cho mỗi node.
5. Drivers match với `compatible` string → probe được gọi.

---

### Câu 3: Kernel module là gì? Cách viết và load kernel module.

**Đáp án:**

**Kernel module** là code có thể load/unload vào kernel tại runtime mà không cần recompile hoặc reboot. Dùng cho drivers, filesystems, network protocols.

```c
/* hello_module.c */
#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/init.h>

MODULE_LICENSE("GPL");
MODULE_AUTHOR("Nguyen Thua Lam");
MODULE_DESCRIPTION("Hello World Kernel Module");

static int __init hello_init(void) {
    printk(KERN_INFO "Hello, Embedded World!\n");
    return 0; // 0 = success
}

static void __exit hello_exit(void) {
    printk(KERN_INFO "Goodbye, Embedded World!\n");
}

module_init(hello_init);
module_exit(hello_exit);
```

**Makefile:**
```makefile
obj-m += hello_module.o

KDIR := /lib/modules/$(shell uname -r)/build

all:
	make -C $(KDIR) M=$(PWD) modules

clean:
	make -C $(KDIR) M=$(PWD) clean
```

**Commands:**
```bash
# Compile
make

# Load module
sudo insmod hello_module.ko

# Check loaded modules
lsmod | grep hello

# View kernel log
dmesg | tail

# Unload module
sudo rmmod hello_module

# Auto-load with dependency resolution
sudo modprobe module_name
sudo modprobe -r module_name  # Remove
```

**Kernel module vs Built-in:**

| Đặc điểm | Module (.ko) | Built-in |
|-----------|-------------|----------|
| Load time | Runtime | Boot time |
| Memory | Chỉ khi cần | Luôn trong RAM |
| Update | Không cần reboot | Cần rebuild kernel + reboot |
| Debugging | Dễ hơn (insmod/rmmod) | Khó hơn |
| Config | `CONFIG_XXX=m` | `CONFIG_XXX=y` |

---

### Câu 4: Character Device Driver — Cách viết driver đơn giản.

**Đáp án:**

**Character device** xử lý data như stream of bytes (đọc/ghi tuần tự). Ví dụ: UART, GPIO, sensor.

```c
#include <linux/module.h>
#include <linux/fs.h>
#include <linux/cdev.h>
#include <linux/uaccess.h>

#define DEVICE_NAME "mychardev"
#define BUF_SIZE    1024

static dev_t dev_num;
static struct cdev my_cdev;
static struct class *my_class;
static char kernel_buffer[BUF_SIZE];
static int data_size = 0;

static int dev_open(struct inode *inode, struct file *file) {
    printk(KERN_INFO "mychardev: opened\n");
    return 0;
}

static int dev_release(struct inode *inode, struct file *file) {
    printk(KERN_INFO "mychardev: closed\n");
    return 0;
}

static ssize_t dev_read(struct file *file, char __user *buf, 
                        size_t len, loff_t *offset) {
    int bytes_to_read = min((int)len, data_size - (int)*offset);
    if (bytes_to_read <= 0) return 0;
    
    if (copy_to_user(buf, kernel_buffer + *offset, bytes_to_read)) {
        return -EFAULT;
    }
    *offset += bytes_to_read;
    return bytes_to_read;
}

static ssize_t dev_write(struct file *file, const char __user *buf,
                         size_t len, loff_t *offset) {
    int bytes_to_write = min((int)len, BUF_SIZE);
    
    if (copy_from_user(kernel_buffer, buf, bytes_to_write)) {
        return -EFAULT;
    }
    data_size = bytes_to_write;
    return bytes_to_write;
}

static struct file_operations fops = {
    .owner = THIS_MODULE,
    .open = dev_open,
    .release = dev_release,
    .read = dev_read,
    .write = dev_write,
};

static int __init mychardev_init(void) {
    // 1. Allocate device number
    alloc_chrdev_region(&dev_num, 0, 1, DEVICE_NAME);
    
    // 2. Initialize cdev
    cdev_init(&my_cdev, &fops);
    cdev_add(&my_cdev, dev_num, 1);
    
    // 3. Create device class and device file (/dev/mychardev)
    my_class = class_create(THIS_MODULE, DEVICE_NAME);
    device_create(my_class, NULL, dev_num, NULL, DEVICE_NAME);
    
    printk(KERN_INFO "mychardev: registered with major=%d, minor=%d\n",
           MAJOR(dev_num), MINOR(dev_num));
    return 0;
}

static void __exit mychardev_exit(void) {
    device_destroy(my_class, dev_num);
    class_destroy(my_class);
    cdev_del(&my_cdev);
    unregister_chrdev_region(dev_num, 1);
    printk(KERN_INFO "mychardev: unregistered\n");
}

module_init(mychardev_init);
module_exit(mychardev_exit);
MODULE_LICENSE("GPL");
```

**Sử dụng từ user space:**
```bash
echo "Hello Driver" > /dev/mychardev
cat /dev/mychardev   # Output: Hello Driver
```

---

### Câu 5: Virtual Memory và MMU trong Linux Embedded.

**Đáp án:**

**Virtual Memory** cho phép mỗi process có không gian địa chỉ riêng (virtual address space), được ánh xạ đến physical memory thông qua **MMU (Memory Management Unit)**.

```
Process A                    Physical Memory          Process B
┌──────────┐                 ┌──────────┐             ┌──────────┐
│ 0x0000   │──┐              │          │         ┌──│ 0x0000   │
│ .text    │  │              │  Frame 0 │←────────┘  │ .text    │
│ 0x1000   │  └──────────────│  Frame 1 │            │ 0x1000   │
│ .data    │──────────────→  │  Frame 2 │←───────────│ .data    │
│          │                 │  Frame 3 │            │          │
│ 0xBFFF   │                 │  Frame 4 │←──┐       │ 0xBFFF   │
│ stack    │──────────────→  │  Frame 5 │   └───────│ stack    │
│ 0xC000   │                 │  ...     │            │ 0xC000   │
│ kernel   │──┐  ┌──────────│  Frame N │  ┌────────│ kernel   │
└──────────┘  └──┘           └──────────┘  │        └──────────┘
              (kernel space chung)          │
```

**Page Table:**
- Virtual address → Physical address.
- Page size: thường 4KB (ARM).
- Multi-level: ARM64 dùng 4-level page table.

**TLB (Translation Lookaside Buffer):**
- Cache của page table trong MMU.
- TLB hit → translate nhanh (1 cycle).
- TLB miss → phải walk page table (chậm hơn nhiều).

**Ứng dụng trong embedded Linux:**
- **Memory protection**: Process không thể truy cập memory của process khác.
- **Memory mapping**: `mmap()` ánh xạ device register vào user space.

```c
#include <sys/mman.h>
#include <fcntl.h>

// User space access hardware register via /dev/mem
int fd = open("/dev/mem", O_RDWR | O_SYNC);
volatile uint32_t *gpio = mmap(NULL, 4096, PROT_READ | PROT_WRITE,
                               MAP_SHARED, fd, GPIO_BASE_ADDR);
gpio[OFFSET/4] = value; // Access hardware register
munmap((void *)gpio, 4096);
close(fd);
```

---

### Câu 6: Yocto Project — Khái niệm và workflow.

**Đáp án:**

**Yocto Project** là framework tạo custom Linux distribution cho embedded systems.

**Khái niệm chính:**

| Thuật ngữ | Giải thích |
|-----------|------------|
| **Layer** | Tập hợp recipes/configs có liên quan (meta-layer). Ví dụ: `meta-ti`, `meta-raspberrypi` |
| **Recipe (.bb)** | File định nghĩa cách build 1 package (source, dependencies, compile, install) |
| **BitBake** | Build engine (giống Make nhưng cho toàn bộ distro) |
| **Machine** | Mô tả hardware target (SoC, bootloader, kernel config) |
| **Distro** | Mô tả software policies (init system, package format, features) |
| **Image** | Recipe đặc biệt tạo root filesystem (tập hợp packages) |
| **BSP Layer** | Board Support Package - layer cho hardware cụ thể |

**Cấu trúc thư mục:**
```
poky/
├── meta/                    # Core layer (OpenEmbedded-Core)
├── meta-poky/               # Poky distro layer
├── meta-yocto-bsp/          # Reference BSP
├── meta-custom/             # Custom layer
│   ├── conf/
│   │   └── layer.conf
│   ├── recipes-core/
│   │   └── myapp/
│   │       └── myapp_1.0.bb
│   └── recipes-kernel/
└── build/
    └── conf/
        ├── local.conf       # Build configuration
        └── bblayers.conf    # Layer list
```

**Recipe example (.bb):**
```bitbake
SUMMARY = "My Custom Application"
LICENSE = "MIT"
LIC_FILES_CHKSUM = "file://LICENSE;md5=xxx"

SRC_URI = "git://github.com/user/myapp.git;branch=main;protocol=https"
SRCREV = "abc123..."

S = "${WORKDIR}/git"

inherit cmake

do_install() {
    install -d ${D}${bindir}
    install -m 0755 ${B}/myapp ${D}${bindir}
}
```

**Workflow:**
```bash
# 1. Setup build environment
source oe-init-build-env build

# 2. Configure (local.conf)
MACHINE = "tcc8030"
DISTRO = "poky"

# 3. Build image
bitbake core-image-minimal

# 4. Output: build/tmp/deploy/images/tcc8030/
#    - zImage, dtb, rootfs.ext4, u-boot.bin
```

---

### Câu 7: V4L2 framework là gì? (liên quan đến kinh nghiệm ứng viên)

**Đáp án:**

**V4L2 (Video4Linux2)** là API/framework chuẩn của Linux cho video capture và output devices (camera, video encoder/decoder, ...).

**Kiến trúc:**
```
User Space:     Application (OpenCV, GStreamer, custom app)
                    │
                    │ ioctl(), mmap(), read()
                    ▼
Kernel Space:   V4L2 Framework
                    │
                    ├── v4l2_device (đại diện SoC video subsystem)
                    ├── video_device (/dev/videoN)
                    ├── v4l2_subdev (sensor, ISP, serializer, ...)
                    └── videobuf2 (buffer management)
                    │
Hardware:       Camera sensor → MIPI CSI-2 → ISP → Memory (DMA)
```

**User space workflow:**
```c
#include <linux/videodev2.h>
#include <sys/ioctl.h>

int fd = open("/dev/video0", O_RDWR);

// 1. Query capabilities
struct v4l2_capability cap;
ioctl(fd, VIDIOC_QUERYCAP, &cap);

// 2. Set format
struct v4l2_format fmt = {0};
fmt.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
fmt.fmt.pix.width = 1920;
fmt.fmt.pix.height = 1080;
fmt.fmt.pix.pixelformat = V4L2_PIX_FMT_YUYV;
ioctl(fd, VIDIOC_S_FMT, &fmt);

// 3. Request buffers (MMAP method)
struct v4l2_requestbuffers req = {0};
req.count = 4;
req.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
req.memory = V4L2_MEMORY_MMAP;
ioctl(fd, VIDIOC_REQBUFS, &req);

// 4. Map buffers, queue buffers
// 5. Start streaming
enum v4l2_buf_type type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
ioctl(fd, VIDIOC_STREAMON, &type);

// 6. Dequeue buffer → process frame → re-queue
struct v4l2_buffer buf = {0};
buf.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
buf.memory = V4L2_MEMORY_MMAP;
ioctl(fd, VIDIOC_DQBUF, &buf); // Get frame
// Process frame...
ioctl(fd, VIDIOC_QBUF, &buf);  // Return buffer

// 7. Stop streaming
ioctl(fd, VIDIOC_STREAMOFF, &type);
close(fd);
```

---

### Câu 8: DLT (Diagnostic Log and Trace) là gì? (liên quan đến kinh nghiệm ứng viên)

**Đáp án:**

**DLT** là giao thức logging chuẩn trong automotive (AUTOSAR / GENIVI), cho phép thu thập log từ nhiều ứng dụng/ECU một cách có cấu trúc.

**Đặc điểm:**
- Centralized logging: 1 DLT daemon thu thập log từ tất cả applications.
- Log levels: FATAL, ERROR, WARN, INFO, DEBUG, VERBOSE.
- Có thể enable/disable log tại runtime (qua DLT Viewer).
- Hỗ trợ binary payload (hiệu quả hơn text).
- Network logging: gửi log qua TCP/UDP đến PC (DLT Viewer).

**Kiến trúc:**
```
Application 1 ─┐
Application 2 ─┤──→ DLT Daemon ──→ DLT Viewer (PC)
Application 3 ─┤        │              │
Kernel logs  ──┘        │              └── File logging
                        └── Console
```

**Multi-core DLT** (liên quan CV ứng viên):
- Mỗi core chạy DLT client riêng.
- DLT daemon trên main core thu thập log từ tất cả cores.
- Cần đồng bộ timestamp giữa các core.

```c
#include <dlt/dlt.h>

DLT_DECLARE_CONTEXT(ctx);

int main() {
    DLT_REGISTER_APP("APP1", "My Application");
    DLT_REGISTER_CONTEXT(ctx, "CTX1", "Main Context");
    
    DLT_LOG(ctx, DLT_LOG_INFO, DLT_STRING("Application started"));
    DLT_LOG(ctx, DLT_LOG_DEBUG, DLT_STRING("Sensor value:"), DLT_INT(42));
    DLT_LOG(ctx, DLT_LOG_ERROR, DLT_STRING("Failed to init"), DLT_INT(-1));
    
    DLT_UNREGISTER_CONTEXT(ctx);
    DLT_UNREGISTER_APP();
    return 0;
}
```

---

### Câu 9: Phân biệt user space và kernel space trong Linux.

**Đáp án:**

| Đặc điểm | User Space | Kernel Space |
|-----------|-----------|--------------|
| Quyền | Restricted (Ring 3 x86, EL0 ARM) | Full access (Ring 0 x86, EL1 ARM) |
| Truy cập HW | Qua system call / driver | Trực tiếp |
| Crash | Chỉ process đó crash | Kernel panic → system crash |
| Memory | Virtual, isolated | Full physical access |
| API | libc (POSIX) | Kernel internal API |
| Debug | GDB, strace | printk, ftrace, kgdb |

**Communication giữa User/Kernel space:**

```
User Space                  Kernel Space
┌─────────┐                ┌─────────────┐
│ App     │ ── syscall ──→ │ System Call  │
│         │ ← return ──── │ Handler      │
│         │                │             │
│ mmap()  │ ──────────────→│ ioremap()   │
│         │                │             │
│ /dev/x  │ ── open/read →│ file_ops    │
│ /sys/x  │ ── read/write→│ sysfs       │
│ /proc/x │ ── read ─────→│ procfs      │
│         │                │             │
│ ioctl() │ ──────────────→│ ioctl handler│
│         │                │             │
│ netlink │ ←────────────→│ netlink     │
└─────────┘                └─────────────┘

copy_to_user()   : Kernel → User (kiểm tra quyền, không crash nếu lỗi)
copy_from_user() : User → Kernel
```

---

### Câu 10: Linux A/B Partition Update là gì? (liên quan đến kinh nghiệm ứng viên)

**Đáp án:**

**A/B Partition Update** (còn gọi là **seamless update**) là cơ chế cập nhật firmware/OS sử dụng 2 bộ partition song song (Slot A và Slot B).

```
eMMC/Flash Layout:
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│Bootloader│ Slot A   │ Slot B   │ User     │ Misc/    │
│          │(boot_a+  │(boot_b+  │ Data     │ Metadata │
│          │ system_a)│ system_b)│(shared)  │          │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

**Quy trình update:**

```
1. Đang chạy Slot A (active)
   ┌─────────┐  ┌─────────┐
   │ Slot A  │  │ Slot B  │
   │ [ACTIVE]│  │ [OLD]   │
   │ v1.0    │  │ v0.9    │
   └─────────┘  └─────────┘

2. Download update → ghi vào Slot B (inactive)
   ┌─────────┐  ┌─────────┐
   │ Slot A  │  │ Slot B  │
   │ [ACTIVE]│  │ [UPDATE]│
   │ v1.0    │  │ v1.1    │  ← Ghi firmware mới
   └─────────┘  └─────────┘

3. Mark Slot B = active, reboot
   ┌─────────┐  ┌─────────┐
   │ Slot A  │  │ Slot B  │
   │ [FALLBK]│  │ [ACTIVE]│
   │ v1.0    │  │ v1.1    │  ← Boot vào đây
   └─────────┘  └─────────┘

4. Nếu v1.1 boot thành công → confirm
   Nếu v1.1 boot FAIL → rollback về Slot A (v1.0)
```

**Ưu điểm:**
- **Brick-proof**: Nếu update fail → rollback về slot cũ.
- **Minimal downtime**: Ghi update khi hệ thống đang chạy, chỉ cần 1 lần reboot.
- **Atomic**: Update toàn bộ hoặc không update gì cả.

**Implementation (liên quan đến kinh nghiệm ứng viên - USB software update):**
```bash
# Bootloader (U-Boot) check active slot
# env: slot_active=a hoặc slot_active=b

if test "${slot_active}" = "a"; then
    setenv bootargs "root=/dev/mmcblk0p2 ..."  # system_a
else
    setenv bootargs "root=/dev/mmcblk0p3 ..."  # system_b
fi

# Update script
dd if=update.img of=/dev/mmcblk0p3 bs=4M  # Write to inactive slot
# Update metadata to switch slot
fw_setenv slot_active b
fw_setenv slot_b_tries 3  # Số lần thử boot
reboot
```

---


## 5. Automotive Specific

### Câu 1: A-SPICE là gì? Giải thích quy trình SWE.1 đến SWE.6.

**Đáp án:**

**A-SPICE (Automotive SPICE)** là mô hình đánh giá năng lực quy trình phát triển phần mềm trong ngành automotive, dựa trên ISO/IEC 15504 (SPICE).

**Capability Levels:**
- Level 0: Incomplete
- Level 1: Performed
- Level 2: Managed
- Level 3: Established

**SWE (Software Engineering) Processes:**

| Process | Tên | Mô tả | Output |
|---------|-----|--------|--------|
| **SWE.1** | Software Requirements Analysis | Phân tích yêu cầu phần mềm từ system requirements | SRS (Software Requirements Specification) |
| **SWE.2** | Software Architectural Design | Thiết kế kiến trúc tổng thể, chia modules | SAD (Software Architecture Document) |
| **SWE.3** | Software Detailed Design | Thiết kế chi tiết từng module, interface | SDD (Software Detailed Design Document) |
| **SWE.4** | Software Unit Construction | Viết code, unit testing | Source code, Unit test results |
| **SWE.5** | Software Integration Test | Test tích hợp các modules | Integration test report |
| **SWE.6** | Software Qualification Test | Test toàn bộ SW đáp ứng requirements | Qualification test report |

**V-Model mapping:**
```
SWE.1 (Requirements) ←──────────────────────→ SWE.6 (Qualification Test)
    ↓                                              ↑
SWE.2 (Architecture) ←─────────────────→ SWE.5 (Integration Test)
    ↓                                          ↑
SWE.3 (Detailed Design) ←──────→ Unit Test
    ↓                              ↑
    SWE.4 (Coding) ──────────────┘
```

**Traceability (quan trọng):**
- Mỗi requirement phải trace được từ SWE.1 → SWE.2 → SWE.3 → SWE.4.
- Mỗi test case phải trace ngược lại requirement tương ứng.
- Tool hỗ trợ: Enterprise Architect, DOORS, Polarion.

---

### Câu 2: V-Model trong phát triển phần mềm automotive.

**Đáp án:**

**V-Model** là mô hình phát triển phần mềm trong đó mỗi giai đoạn phát triển (bên trái V) có giai đoạn kiểm thử tương ứng (bên phải V).

```
System Requirements ──────────────────────────── System Testing
        │                                              ↑
        ▼                                              │
Software Requirements ────────────────── Software Qualification Test (SWE.6)
        │                                          ↑
        ▼                                          │
Software Architecture ──────────── Integration Test (SWE.5)
        │                                  ↑
        ▼                                  │
Detailed Design ──────────── Unit Test
        │                        ↑
        ▼                        │
        └── Coding (SWE.4) ─────┘
```

**Đặc điểm:**
- **Verification**: Kiểm tra từng bước xem đúng chưa ("Are we building the product right?").
- **Validation**: Kiểm tra sản phẩm cuối có đáp ứng yêu cầu ("Are we building the right product?").
- Mỗi document ở bên trái là cơ sở để tạo test case ở bên phải.
- Phù hợp với safety-critical systems (automotive, aviation, medical).

---

### Câu 3: MISRA C là gì? Cho ví dụ một số rules quan trọng.

**Đáp án:**

**MISRA C (Motor Industry Software Reliability Association)** là tập hợp guidelines cho lập trình C trong safety-critical systems, đặc biệt automotive.

**Phân loại rules:**
- **Mandatory**: PHẢI tuân thủ, không có ngoại lệ.
- **Required**: PHẢI tuân thủ, cho phép deviation với justification.
- **Advisory**: NÊN tuân thủ, khuyến nghị.

**Một số rules quan trọng:**

```c
// Rule 1: Không dùng goto
// ❌
goto error_handler;
// ✅
if (error) { handle_error(); return; }

// Rule 2: Mỗi switch phải có default case
// ❌
switch (state) {
    case STATE_IDLE: break;
    case STATE_RUN: break;
}
// ✅
switch (state) {
    case STATE_IDLE: break;
    case STATE_RUN:  break;
    default:         handle_error(); break; // MISRA required
}

// Rule 3: Không dùng dynamic memory (malloc/free)
// ❌ (MISRA Rule 21.3)
char *p = (char *)malloc(100);
// ✅
static char buffer[100]; // Static allocation

// Rule 4: Không cast giữa pointer và integer (trừ khi cần thiết)
// ❌ (MISRA Rule 11.4)
int *p = (int *)0x40020000;
// ✅ (với deviation document)
volatile uint32_t *const GPIO = (volatile uint32_t *)0x40020000U;

// Rule 5: Biến phải được khởi tạo trước khi sử dụng
// ❌
int x;
if (condition) x = 10;
use(x); // x có thể chưa khởi tạo nếu condition = false
// ✅
int x = 0;

// Rule 6: Hàm phải có một điểm return duy nhất
// (MISRA Advisory - nhiều project relax rule này)

// Rule 7: Không implicit type conversion, dùng explicit cast
// ❌
uint16_t a = 1000;
uint8_t b = a;  // Implicit truncation!
// ✅
uint8_t b = (uint8_t)(a & 0xFFU);

// Rule 8: Comments không lồng nhau
// ❌
/* outer /* inner */ still comment? */
// ✅
/* outer comment */
/* inner comment */
```

**Tools kiểm tra MISRA compliance:**
- PC-lint, Polyspace, QAC, Coverity, cppcheck (free, partial support).

---

### Câu 4: Functional Safety (ISO 26262) — Khái niệm cơ bản.

**Đáp án:**

**ISO 26262** là tiêu chuẩn an toàn chức năng cho hệ thống điện/điện tử trong xe ô tô.

**ASIL (Automotive Safety Integrity Level):**

| ASIL | Mức độ | Ví dụ | Yêu cầu |
|------|--------|-------|---------|
| QM | Không safety-critical | Radio, đèn nội thất | Quy trình QM thông thường |
| A | Thấp | Đèn hậu | FMEA cơ bản |
| B | Trung bình | Cluster, đèn pha | Static analysis, review |
| C | Cao | ABS, ESC | Unit test, integration test, MISRA C |
| D | Rất cao | Airbag, steering | Formal verification, full coverage |

**Khái niệm quan trọng:**

**1. Safety Goal**: Mục tiêu an toàn ở system level.
- Ví dụ: "Cluster phải hiển thị tốc độ chính xác" (sai tốc độ → nguy hiểm).

**2. Safety Mechanism**: Cơ chế phát hiện và xử lý lỗi.
```c
// Ví dụ: Dual-channel redundancy
uint16_t read_speed_primary(void);
uint16_t read_speed_secondary(void);

void check_speed_safety(void) {
    uint16_t speed1 = read_speed_primary();
    uint16_t speed2 = read_speed_secondary();
    
    if (abs(speed1 - speed2) > THRESHOLD) {
        // Mismatch detected → enter safe state
        display_warning();
        // Hiển thị tốc độ = 0 hoặc last known good value
    }
}
```

**3. FTTI (Fault Tolerant Time Interval)**: Thời gian cho phép từ khi lỗi xảy ra đến khi đạt safe state.

**4. Safe State**: Trạng thái an toàn khi phát hiện lỗi (ví dụ: tắt motor, hiển thị warning).

**5. Watchdog/Failsafe** (liên quan đến kinh nghiệm ứng viên):
- Multi-core watchdog: mỗi core giám sát lẫn nhau.
- Nếu core xử lý display fail → core giám sát phát hiện → hiển thị warning hoặc safe screen.

---

### Câu 5: AUTOSAR là gì? Kiến trúc AUTOSAR Classic vs Adaptive.

**Đáp án:**

**AUTOSAR (AUTomotive Open System ARchitecture)** là kiến trúc phần mềm chuẩn cho ECU trong automotive.

**AUTOSAR Classic (cho ECU truyền thống, RTOS):**
```
┌──────────────────────────────────────┐
│        Application Layer (SWC)       │  Software Components
├──────────────────────────────────────┤
│           RTE (Runtime Env)          │  Communication middleware
├──────────────────────────────────────┤
│        BSW (Basic Software)          │
│  ┌─────────┬──────────┬───────────┐  │
│  │Services │ECU Abstr.│ Complex   │  │
│  │Layer    │Layer     │ Drivers   │  │  
│  ├─────────┴──────────┴───────────┤  │
│  │     MCAL (Microcontroller      │  │  Hardware abstraction
│  │     Abstraction Layer)         │  │
│  └────────────────────────────────┘  │
├──────────────────────────────────────┤
│            Microcontroller           │  Hardware
└──────────────────────────────────────┘
```

**AUTOSAR Adaptive (cho high-performance ECU, Linux-based):**
- Dựa trên POSIX (Linux).
- Service-oriented architecture (SOA).
- Dynamic deployment, update at runtime.
- Dùng cho ADAS, IVI, central gateway.

**So sánh:**

| Đặc điểm | Classic | Adaptive |
|-----------|---------|----------|
| OS | RTOS | POSIX (Linux) |
| Language | C | C++14/17 |
| Communication | Signal-based | Service-oriented (SOME/IP) |
| Configuration | Compile-time | Runtime |
| Target | MCU (Cortex-M/R) | High-performance SoC |
| Use case | Traditional ECU | ADAS, IVI, gateway |

---

### Câu 6: MISRA C — Rule về pointer arithmetic. Tại sao cần hạn chế?

**Đáp án:**

MISRA C hạn chế pointer arithmetic vì dễ gây:
- Buffer overflow
- Access ngoài vùng nhớ hợp lệ
- Undefined Behavior

```c
// ❌ Pointer arithmetic không an toàn
int arr[10];
int *p = arr;
p = p + 20;  // Ngoài bounds! → Undefined Behavior
*p = 42;     // Crash hoặc corrupt memory

// ❌ Trừ 2 pointer khác nguồn
int a[10], b[10];
ptrdiff_t diff = &a[5] - &b[3]; // Undefined! Khác array

// ✅ An toàn - dùng array indexing
int arr[10];
for (int i = 0; i < 10; i++) {
    arr[i] = i; // Rõ ràng, bounds checkable
}

// ✅ Nếu cần pointer arithmetic, kiểm tra bounds
void safe_memset(uint8_t *buf, uint8_t val, size_t size, size_t buf_size) {
    if (size > buf_size) {
        size = buf_size; // Clamp
    }
    for (size_t i = 0; i < size; i++) {
        buf[i] = val;
    }
}
```

---

### Câu 7: Giải thích Diagnostic Communication trong Automotive (UDS/OBD).

**Đáp án:**

**UDS (Unified Diagnostic Services - ISO 14229):**
- Giao thức diagnostic chuẩn cho ECU.
- Chạy trên CAN (ISO 15765), DoIP (Ethernet), ...
- Cho phép tester (máy chẩn đoán) giao tiếp với ECU.

**Các services phổ biến:**

| Service ID | Tên | Mô tả |
|-----------|------|-------|
| 0x10 | DiagnosticSessionControl | Chuyển session (Default, Extended, Programming) |
| 0x11 | ECUReset | Reset ECU |
| 0x22 | ReadDataByIdentifier | Đọc data (DID) |
| 0x2E | WriteDataByIdentifier | Ghi data (DID) |
| 0x27 | SecurityAccess | Unlock ECU (seed-key) |
| 0x31 | RoutineControl | Thực hiện routine (self-test, ...) |
| 0x34 | RequestDownload | Bắt đầu download firmware |
| 0x36 | TransferData | Truyền firmware data |
| 0x37 | RequestTransferExit | Kết thúc download |
| 0x3E | TesterPresent | Keep session alive |

**DTC (Diagnostic Trouble Code):**
- Mã lỗi lưu trong ECU khi phát hiện fault.
- Format: P0XXX (Powertrain), B0XXX (Body), C0XXX (Chassis), U0XXX (Network).

---

### Câu 8: Giải thích System Profiling trong Embedded Linux.

**Đáp án:**

**System profiling** là quá trình đo lường và phân tích hiệu năng hệ thống.

**CPU Load/Memory profiling (liên quan CV ứng viên):**

```bash
# 1. CPU load measurement
top -d 1          # Real-time CPU/memory usage
mpstat -P ALL 1   # Per-core CPU usage
pidstat -u 1      # Per-process CPU usage

# 2. Memory profiling
free -h           # Total memory usage
cat /proc/meminfo # Detailed memory info
pmap <PID>        # Process memory map
valgrind --tool=massif ./app  # Heap profiling

# 3. System tracing
strace -f -T ./app            # System call trace with timing
ltrace ./app                  # Library call trace
perf record -g ./app          # Performance profiling
perf report                   # Analyze results

# 4. Kernel tracing
trace-cmd record -e sched -e irq    # Kernel events
ftrace                                # Function tracer (via debugfs)
```

**Custom profiling trong code:**
```c
#include <time.h>

struct timespec start, end;

clock_gettime(CLOCK_MONOTONIC, &start);
// Code to profile
function_to_measure();
clock_gettime(CLOCK_MONOTONIC, &end);

long elapsed_ns = (end.tv_sec - start.tv_sec) * 1000000000L 
                  + (end.tv_nsec - start.tv_nsec);
printf("Elapsed: %ld ns (%ld us)\n", elapsed_ns, elapsed_ns / 1000);
```

---

## 6. Hardware & Debugging

### Câu 1: Multi-core architecture — Giải thích A53, A7, R5 trong automotive SoC.

**Đáp án:**

Trong automotive SoC (ví dụ: TCC8030 mà ứng viên đã làm việc):

| Core | ARM Cortex-A53 | ARM Cortex-A7 | ARM Cortex-R5 |
|------|---------------|---------------|---------------|
| Profile | Application | Application | Real-time |
| ISA | ARMv8-A (64/32-bit) | ARMv7-A (32-bit) | ARMv7-R (32-bit) |
| Pipeline | 8-stage, in-order | 8-stage, in-order | 8-stage, dual-issue |
| MMU | Có | Có | MPU (Memory Protection) |
| Cache | L1 I/D + shared L2 | L1 I/D + shared L2 | L1 I/D (tightly coupled) |
| OS | Linux, Android | Linux, RTOS | RTOS, Bare-metal |
| Mục đích | Main processing, UI | Secondary processing | Safety, real-time |
| Tính năng | High performance | Power efficient | Deterministic, lockstep |

**Tại sao cần nhiều loại core:**
```
┌──────────────────────────────────────────┐
│                  SoC TCC8030             │
│                                          │
│  ┌──────────────┐  ┌──────────────┐      │
│  │  Cortex-A53  │  │  Cortex-A7   │      │
│  │  (4 cores)   │  │  (2 cores)   │      │
│  │              │  │              │      │
│  │  Linux/QNX   │  │  RTOS/Linux  │      │
│  │  UI Rendering│  │  Audio/Nav   │      │
│  │  App Logic   │  │  Connectivity│      │
│  └──────────────┘  └──────────────┘      │
│                                          │
│  ┌──────────────┐  ┌──────────────┐      │
│  │  Cortex-R5   │  │  GPU/DSP     │      │
│  │  (2 cores)   │  │              │      │
│  │  Safety      │  │  Graphics    │      │
│  │  Watchdog    │  │  Video decode│      │
│  │  CAN/LIN     │  │              │      │
│  │  Boot manage │  │              │      │
│  └──────────────┘  └──────────────┘      │
│                                          │
│  Shared Memory / Mailbox / IPC           │
└──────────────────────────────────────────┘
```

---

### Câu 2: Memory-Mapped I/O là gì?

**Đáp án:**

**Memory-Mapped I/O (MMIO)** là phương pháp truy cập hardware registers thông qua địa chỉ bộ nhớ thông thường. Mỗi peripheral register được ánh xạ vào một địa chỉ trong memory map.

```c
// STM32F411 - GPIO Port A base address: 0x40020000
#define GPIOA_BASE    0x40020000U
#define GPIOA_MODER   (*(volatile uint32_t *)(GPIOA_BASE + 0x00))
#define GPIOA_ODR     (*(volatile uint32_t *)(GPIOA_BASE + 0x14))
#define GPIOA_IDR     (*(volatile uint32_t *)(GPIOA_BASE + 0x10))

// Set PA5 as output
GPIOA_MODER &= ~(3U << 10);  // Clear bits [11:10]
GPIOA_MODER |=  (1U << 10);  // Set bit 10 (output mode)

// Toggle PA5
GPIOA_ODR ^= (1U << 5);

// Read PA0
uint32_t pin_state = (GPIOA_IDR & (1U << 0));
```

**Memory-Mapped I/O vs Port-Mapped I/O (x86):**

| | Memory-Mapped I/O | Port-Mapped I/O |
|--|-------------------|-----------------|
| Address space | Chung với memory | Riêng (I/O space) |
| Instructions | Load/Store (LDR/STR) | IN/OUT (x86 specific) |
| Architecture | ARM, MIPS, RISC-V | x86 |
| Dùng C | `*(volatile uint32_t *)addr` | Cần inline asm hoặc intrinsic |

---

### Câu 3: JTAG/SWD debugging — Giải thích.

**Đáp án:**

**JTAG (Joint Test Action Group - IEEE 1149.1):**
- Giao thức debug chuẩn, dùng 4-5 dây: TDI, TDO, TCK, TMS, (TRST optional).
- Hỗ trợ: boundary scan, flash programming, real-time debugging.
- Có thể chain nhiều device trên cùng JTAG bus (daisy-chain).

**SWD (Serial Wire Debug):**
- Giao thức debug của ARM, chỉ dùng **2 dây**: SWDIO, SWCLK.
- Chức năng tương đương JTAG nhưng ít pin hơn.
- Chỉ dùng cho ARM cores (không daisy-chain được).

| Đặc điểm | JTAG | SWD |
|-----------|------|-----|
| Số dây | 4-5 | 2 |
| Architecture | Universal | ARM only |
| Daisy-chain | Có | Không |
| Tốc độ | Tương đương | Tương đương |
| Pin count | Nhiều hơn | Ít hơn (tốt cho MCU nhỏ) |

**Debug probe tools (liên quan CV ứng viên):**
- **GHS Probe**: Green Hills Software probe — dùng với MULTI IDE, hỗ trợ multi-core debug.
- **J-Link**: Segger J-Link, phổ biến cho development.
- **ST-Link**: Cho STM32 (ứng viên có kinh nghiệm STM32).

**GDB Remote Debug:**
```bash
# Start GDB server (OpenOCD)
openocd -f interface/stlink.cfg -f target/stm32f4x.cfg

# Connect GDB
arm-none-eabi-gdb firmware.elf
(gdb) target remote :3333
(gdb) monitor reset halt
(gdb) load
(gdb) break main
(gdb) continue
(gdb) print variable_name
(gdb) x/10x 0x20000000  # Examine memory
(gdb) info registers
```

---

### Câu 4: PicoScope — Cách sử dụng trong automotive testing.

**Đáp án:**

**PicoScope** là oscilloscope USB dùng cho đo lường và phân tích tín hiệu trong automotive.

**Ứng dụng trong automotive testing (liên quan CV ứng viên):**

1. **CAN bus analysis:**
   - Đo dạng sóng CAN_H, CAN_L.
   - Kiểm tra differential voltage (CAN_H - CAN_L ≈ 2V dominant, 0V recessive).
   - Phát hiện lỗi: reflection, ringing, termination issues.

2. **LIN bus analysis:**
   - Đo waveform, kiểm tra break field, sync field.
   - Đo timing (baud rate accuracy).

3. **Power supply analysis:**
   - Đo ripple, noise trên supply rails.
   - Đo inrush current.
   - Kiểm tra power sequencing.

4. **Signal integrity:**
   - Đo rise/fall time.
   - Đo jitter, overshoot, undershoot.
   - I2C/SPI waveform verification.

```
CAN Bus waveform (PicoScope view):
CAN_H: ──┐    ┌──┐    ┌──────────
          │    │  │    │
     3.5V │    │  │    │
     2.5V ├────┘  └────┘  (recessive = 2.5V)
          │
CAN_L: ──┘    └──┘    └──────────
     2.5V ├────┐  ┌────┐  (recessive = 2.5V)
     1.5V │    │  │    │
          │    │  │    │
          └────┘  └────┘
          Dominant  Rec   Dominant
```

---

### Câu 5: CANoe — Giải thích cách sử dụng trong system testing.

**Đáp án:**

**CANoe** (Vector) là công cụ phân tích, simulation và testing cho automotive networks (CAN, CAN FD, LIN, Ethernet, FlexRay).

**Chức năng chính:**

1. **Bus Monitoring**: Theo dõi và ghi lại tất cả messages trên bus.
2. **Simulation**: Mô phỏng ECU không có sẵn (remaining bus simulation).
3. **Testing**: Chạy automated test cases (CAPL scripts).
4. **Diagnostics**: Gửi UDS requests, đọc DTC.

**CAPL (Communication Access Programming Language):**
```c
// Gửi CAN message mỗi 100ms
on timer sendTimer {
    message 0x100 msg;
    msg.dlc = 8;
    msg.byte(0) = speed & 0xFF;
    msg.byte(1) = (speed >> 8) & 0xFF;
    output(msg);
    setTimer(sendTimer, 100);
}

// Nhận và kiểm tra CAN message
on message 0x200 {
    int rpm = this.byte(0) | (this.byte(1) << 8);
    write("RPM = %d", rpm);
    
    // Test assertion
    if (rpm > MAX_RPM) {
        testStepFail("RPM exceeded limit!");
    } else {
        testStepPass("RPM within range");
    }
}

// Test case
testcase TC_SpeedDisplay() {
    // Gửi tốc độ = 100 km/h
    message 0x100 msg;
    msg.byte(0) = 100;
    output(msg);
    
    // Chờ và kiểm tra response
    testWaitForTimeout(1000);
    
    // Verify cluster display
    testStepPass("Speed display test passed");
}
```

---

### Câu 6: GDB — Các lệnh debug quan trọng trong embedded.

**Đáp án:**

```bash
# === Kết nối ===
target remote :3333              # Connect to debug server
target remote /dev/ttyUSB0       # Serial connection

# === Breakpoints ===
break main                       # Break at function
break file.c:42                  # Break at line
break *0x08000100                # Break at address
watch variable                   # Watchpoint (break khi variable thay đổi)
info breakpoints                 # List breakpoints
delete 1                         # Delete breakpoint #1

# === Execution ===
continue (c)                     # Continue execution
step (s)                         # Step into (vào trong hàm)
next (n)                         # Step over (qua hàm)
finish                           # Run until current function returns
until 50                         # Run until line 50

# === Inspect ===
print variable (p)               # Print variable value
print/x variable                 # Print in hex
print *array@10                  # Print 10 elements of array
display variable                 # Auto-print mỗi khi dừng

# === Memory ===
x/16xb 0x20000000               # 16 bytes, hex format
x/4xw 0x40020000                # 4 words (32-bit), hex
x/10i $pc                       # 10 instructions from PC

# === Registers ===
info registers                   # All registers
print $sp                       # Stack pointer
print $pc                       # Program counter
set $r0 = 0x42                  # Modify register

# === Stack ===
backtrace (bt)                  # Call stack
frame 2                         # Switch to frame #2
info locals                     # Local variables in current frame
info args                       # Function arguments

# === Multi-core (GHS Probe) ===
info threads                    # List all cores/threads
thread 2                        # Switch to core 2
thread apply all bt             # Backtrace all cores
```

---

### Câu 7: SoC (System on Chip) — Các thành phần chính.

**Đáp án:**

**SoC** tích hợp nhiều thành phần trên một chip:

```
┌─────────────────────────────────────────────────┐
│                    SoC                           │
│                                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │  CPU     │ │  GPU    │ │  DSP    │           │
│  │ (Multi-  │ │         │ │         │           │
│  │  core)   │ │         │ │         │           │
│  └────┬─────┘ └────┬────┘ └────┬────┘           │
│       │            │           │                 │
│  ═════╪════════════╪═══════════╪══ Bus (AXI/AHB) │
│       │            │           │                 │
│  ┌────┴─────┐ ┌────┴────┐ ┌───┴─────┐          │
│  │ Memory   │ │ DMA     │ │ Interrupt│          │
│  │Controller│ │ Engine  │ │Controller│          │
│  │(DDR)     │ │         │ │ (GIC)   │          │
│  └──────────┘ └─────────┘ └─────────┘          │
│                                                  │
│  ┌─────────────────────────────────────┐        │
│  │         Peripherals                  │        │
│  │  UART  SPI  I2C  CAN  USB  Ethernet │        │
│  │  GPIO  Timer  ADC  DAC  PWM         │        │
│  └─────────────────────────────────────┘        │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │  SRAM    │ │  ROM     │ │  eFuse   │        │
│  │  (On-chip│ │  (Boot)  │ │  (OTP)   │        │
│  └──────────┘ └──────────┘ └──────────┘        │
└─────────────────────────────────────────────────┘
```

**Bus Architecture:**
- **AXI**: High-performance bus (CPU, GPU, DMA).
- **AHB**: High-speed peripherals (USB, Ethernet).
- **APB**: Low-speed peripherals (UART, SPI, I2C, GPIO).

---

## 7. Software Engineering

### Câu 1: Git branching strategies — Gitflow vs Trunk-based.

**Đáp án:**

**Gitflow:**
```
main     ─●──────────────────●──────────────●── (releases only)
           \                / \            /
release     \──────────────●   \──────────●
              \           /     \        /
develop  ──────●─────●───●──────●───●───●────── (integration)
                \   /         \   /
feature-1        ●─●           ●─●
feature-2          ●─────●
```
- `main`: Code production, chỉ merge từ release/hotfix.
- `develop`: Branch tích hợp, merge feature branches vào đây.
- `feature/*`: Feature mới, branch từ develop.
- `release/*`: Chuẩn bị release, fix bugs.
- `hotfix/*`: Fix bug critical trên production.

**Trunk-based development:**
```
main  ──●──●──●──●──●──●──●──●──●── (continuous integration)
         \/ \/ \/ \/ \/
         Short-lived feature branches (< 1-2 days)
```

**So sánh:**

| | Gitflow | Trunk-based |
|---|---------|-------------|
| Branch lifetime | Dài (weeks) | Ngắn (hours-days) |
| Complexity | Phức tạp | Đơn giản |
| CI/CD | Khó hơn | Dễ hơn |
| Team size | Lớn | Nhỏ-Trung bình |
| Release | Scheduled | Continuous |
| Automotive | Phù hợp (V-model) | Ít phổ biến |

---

### Câu 2: Unit Testing trong Embedded — Strategies và frameworks.

**Đáp án:**

**Tại sao Unit Test quan trọng trong Embedded?**
- Phát hiện bug sớm (trước khi deploy lên hardware).
- A-SPICE yêu cầu (SWE.4).
- MISRA C compliance checking.
- Regression testing khi sửa code.

**Strategies:**

1. **Test on Host (PC)**: Chạy test trên PC, mock hardware dependencies.
2. **Test on Target**: Chạy test trực tiếp trên MCU/SoC.
3. **Hardware-in-the-Loop (HIL)**: Simulate hardware + chạy real firmware.

**Framework phổ biến:**
- **Unity** (C): Lightweight, phổ biến trong embedded.
- **CppUTest** (C/C++): xUnit style.
- **Google Test** (C++): Feature-rich.
- **CMock**: Mock generation cho C.

```c
// Unity framework example
#include "unity.h"
#include "crc.h"

void setUp(void) {
    // Chạy trước mỗi test
}

void tearDown(void) {
    // Chạy sau mỗi test
}

void test_crc8_zero_data(void) {
    uint8_t data[] = {0x00};
    uint8_t result = crc8(data, 1);
    TEST_ASSERT_EQUAL_HEX8(0x00, result);
}

void test_crc8_known_pattern(void) {
    uint8_t data[] = {0x01, 0x02, 0x03};
    uint8_t result = crc8(data, 3);
    TEST_ASSERT_EQUAL_HEX8(0x48, result); // Expected CRC
}

void test_crc8_null_pointer(void) {
    uint8_t result = crc8(NULL, 0);
    TEST_ASSERT_EQUAL_HEX8(0x00, result);
}

int main(void) {
    UNITY_BEGIN();
    RUN_TEST(test_crc8_zero_data);
    RUN_TEST(test_crc8_known_pattern);
    RUN_TEST(test_crc8_null_pointer);
    return UNITY_END();
}
```

**Mocking hardware:**
```c
// Thay vì gọi hardware trực tiếp:
// uint8_t value = READ_REG(SENSOR_REG);

// Tạo mock:
static uint8_t mock_sensor_value = 0;
uint8_t mock_read_sensor(void) {
    return mock_sensor_value;
}

void test_sensor_high_temp(void) {
    mock_sensor_value = 0xFF; // Simulate high temperature
    int result = check_temperature();
    TEST_ASSERT_EQUAL(TEMP_ALERT, result);
}
```

---

### Câu 3: Build systems — CMake vs Make.

**Đáp án:**

**Make (Makefile):**
```makefile
CC = arm-none-eabi-gcc
CFLAGS = -mcpu=cortex-m4 -mthumb -O2 -Wall
LDFLAGS = -T linker.ld -nostdlib

SRCS = main.c uart.c spi.c
OBJS = $(SRCS:.c=.o)

all: firmware.elf

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

firmware.elf: $(OBJS)
	$(CC) $(LDFLAGS) $^ -o $@

firmware.bin: firmware.elf
	arm-none-eabi-objcopy -O binary $< $@

clean:
	rm -f $(OBJS) firmware.elf firmware.bin

.PHONY: all clean
```

**CMake (CMakeLists.txt):**
```cmake
cmake_minimum_required(VERSION 3.16)

# Cross-compilation toolchain
set(CMAKE_SYSTEM_NAME Generic)
set(CMAKE_C_COMPILER arm-none-eabi-gcc)

project(Firmware C)

set(CMAKE_C_FLAGS "-mcpu=cortex-m4 -mthumb -O2 -Wall")
set(CMAKE_EXE_LINKER_FLAGS "-T ${CMAKE_SOURCE_DIR}/linker.ld -nostdlib")

add_executable(firmware
    src/main.c
    src/uart.c
    src/spi.c
)

target_include_directories(firmware PRIVATE include/)

# Generate .bin from .elf
add_custom_command(TARGET firmware POST_BUILD
    COMMAND arm-none-eabi-objcopy -O binary firmware firmware.bin
)
```

**So sánh:**

| | Make | CMake |
|---|------|-------|
| Type | Build tool | Build system generator |
| Cross-platform | Chủ yếu Unix | Windows, Linux, macOS |
| Learning curve | Đơn giản | Trung bình |
| Out-of-source build | Manual | Mặc định |
| IDE integration | Hạn chế | Tốt (VS, CLion, Eclipse) |
| Dependency management | Manual | find_package(), FetchContent |
| Automotive | Ít dùng | Phổ biến (đặc biệt với AUTOSAR Adaptive) |

---


# PHẦN 2: CÂU HỎI LIVE CODING (20 BÀI THỰC CHIẾN EMBEDDED C)

---

## Bài 1: Implement Circular Buffer (Ring Buffer)

### Đề bài
Viết một module Ring Buffer (FIFO) lưu trữ byte (`uint8_t`) dùng trong giao tiếp UART/SPI. Yêu cầu:
- Hỗ trợ khởi tạo buffer với kích thước cấu hình trước (power of 2 hoặc kích thước bất kỳ).
- Các hàm: `ring_buffer_init`, `ring_buffer_push`, `ring_buffer_pop`, `ring_buffer_is_empty`, `ring_buffer_is_full`, `ring_buffer_available`.
- Hoạt động an toàn cho mô hình 1 Producer (ISR) - 1 Consumer (Main task) mà không cần khóa ngắt nếu dùng atomic index.

### Phân tích giải thuật
- Dùng mảng cố định `buffer[BUFFER_SIZE]`.
- Hai chỉ số: `head` (nơi ghi byte tiếp theo) và `tail` (nơi đọc byte tiếp theo).
- Nếu `head == tail`: Buffer trống.
- Nếu `(head + 1) % BUFFER_SIZE == tail`: Buffer đầy (bỏ phí 1 slot) hoặc dùng một biến đếm `count`.
- Để tối ưu vi điều khiển, nếu `BUFFER_SIZE` là lũy thừa của 2 ($2^N$), phép chia lấy dư `% BUFFER_SIZE` có thể thay bằng phép AND bit: `& (BUFFER_SIZE - 1)`.

### Code Implementation

```c
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#define RING_BUF_SIZE 256  // Phải là lũy thừa của 2 để tối ưu bitwise AND

typedef struct {
    uint8_t buffer[RING_BUF_SIZE];
    volatile uint16_t head; // Producer cập nhật
    volatile uint16_t tail; // Consumer cập nhật
} RingBuffer_t;

void RingBuffer_Init(RingBuffer_t *rb) {
    if (rb == NULL) return;
    rb->head = 0;
    rb->tail = 0;
}

bool RingBuffer_IsEmpty(const RingBuffer_t *rb) {
    return (rb->head == rb->tail);
}

bool RingBuffer_IsFull(const RingBuffer_t *rb) {
    return (((rb->head + 1) & (RING_BUF_SIZE - 1)) == rb->tail);
}

uint16_t RingBuffer_Available(const RingBuffer_t *rb) {
    return ((rb->head - rb->tail) & (RING_BUF_SIZE - 1));
}

// Gọi từ ISR hoặc Task Producer
bool RingBuffer_Push(RingBuffer_t *rb, uint8_t data) {
    uint16_t next_head = (rb->head + 1) & (RING_BUF_SIZE - 1);
    if (next_head == rb->tail) {
        return false; // Buffer đầy, không thể ghi đè
    }
    rb->buffer[rb->head] = data;
    rb->head = next_head;
    return true;
}

// Gọi từ Main Task Consumer
bool RingBuffer_Pop(RingBuffer_t *rb, uint8_t *data) {
    if (RingBuffer_IsEmpty(rb)) {
        return false; // Buffer rỗng
    }
    *data = rb->buffer[rb->tail];
    rb->tail = (rb->tail + 1) & (RING_BUF_SIZE - 1);
    return true;
}
```

### Độ phức tạp
- Thời gian: $O(1)$ cho tất cả các thao tác Push, Pop, IsEmpty, IsFull.
- Không gian: $O(N)$ bộ nhớ tĩnh, không cấp phát heap động, không rò rỉ bộ nhớ.

---

## Bài 2: Implement Simple Memory Pool Allocator (Fixed Block Allocator)

### Đề bài
Trong hệ thống Automotive và Functional Safety (ISO 26262), việc gọi `malloc`/`free` từ heap tiêu chuẩn bị cấm vì gây phân mảnh bộ nhớ (fragmentation) và không có thời gian phản hồi xác định (non-deterministic execution time). Hãy viết một Fixed-Size Block Memory Allocator quản lý một vùng nhớ tĩnh gồm $N$ khối (block), mỗi khối có kích thước $M$ bytes.

### Phân tích giải thuật
- Dùng một mảng byte tĩnh hoặc buffer được cấp phát từ trước.
- Liên kết các khối rỗng (free blocks) bằng một Single Linked List nằm ngay bên trong vùng nhớ của các block đó (Free-list embedded pointer).
- `allocate()`: Lấy block đầu tiên từ free-list ($O(1)$).
- `deallocate()`: Đưa block được trả về vào đầu free-list ($O(1)$).

### Code Implementation

```c
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

typedef struct BlockNode {
    struct BlockNode *next;
} BlockNode_t;

typedef struct {
    uint8_t *pool_memory;
    size_t block_size;
    size_t total_blocks;
    size_t free_blocks;
    BlockNode_t *free_list;
} MemoryPool_t;

bool MemoryPool_Init(MemoryPool_t *pool, void *raw_memory, size_t block_size, size_t total_blocks) {
    if (!pool || !raw_memory || block_size < sizeof(BlockNode_t) || total_blocks == 0) {
        return false;
    }

    pool->pool_memory = (uint8_t *)raw_memory;
    pool->block_size = block_size;
    pool->total_blocks = total_blocks;
    pool->free_blocks = total_blocks;
    pool->free_list = NULL;

    // Khởi tạo singly linked list xâu chuỗi tất cả các block rỗng
    for (size_t i = 0; i < total_blocks; i++) {
        BlockNode_t *curr = (BlockNode_t *)(pool->pool_memory + (i * block_size));
        curr->next = pool->free_list;
        pool->free_list = curr;
    }
    return true;
}

void* MemoryPool_Alloc(MemoryPool_t *pool) {
    if (!pool || pool->free_list == NULL) {
        return NULL; // Hết bộ nhớ
    }

    BlockNode_t *allocated = pool->free_list;
    pool->free_list = allocated->next;
    pool->free_blocks--;
    return (void *)allocated;
}

bool MemoryPool_Free(MemoryPool_t *pool, void *ptr) {
    if (!pool || !ptr) return false;

    // Kiểm tra con trỏ có thuộc phạm vi quản lý của pool không
    uint8_t *byte_ptr = (uint8_t *)ptr;
    if (byte_ptr < pool->pool_memory || 
        byte_ptr >= (pool->pool_memory + (pool->block_size * pool->total_blocks))) {
        return false; // Pointer ngoài vùng nhớ hợp lệ
    }

    // Đưa block vào đầu danh sách free
    BlockNode_t *released = (BlockNode_t *)ptr;
    released->next = pool->free_list;
    pool->free_list = released;
    pool->free_blocks++;
    return true;
}
```

### Độ phức tạp
- Thời gian: $O(1)$ cho cả `Alloc` và `Free`, hoàn toàn deterministic, đáp ứng tiêu chuẩn Hard Real-time.
- Không gian: Không tốn overhead lưu metadata riêng lẻ (tận dụng chính payload rỗng làm node con trỏ).

---

## Bài 3: Bit Manipulation Exercises (Bộ bài tập xử lý bit)

### Đề bài
Viết các macro / hàm C thực hiện các thao tác:
1. Set, Clear, Toggle, Check bit $n$ của một biến 32-bit.
2. Đếm số lượng bit 1 (Population Count / Hamming Weight).
3. Đảo ngược thứ tự 8 bit (Reverse bits).
4. Đổi vị trí 2 nibble trong 1 byte (Swap Nibbles: 4-bit cao đổi 4-bit thấp).
5. Kiểm tra một số nguyên có phải là lũy thừa của 2 (Power of 2).

### Code Implementation

```c
#include <stdint.h>
#include <stdbool.h>

// 1. Bit Operations Macro
#define SET_BIT(reg, bit)    ((reg) |= (1UL << (bit)))
#define CLEAR_BIT(reg, bit)  ((reg) &= ~(1UL << (bit)))
#define TOGGLE_BIT(reg, bit) ((reg) ^= (1UL << (bit)))
#define CHECK_BIT(reg, bit)  (((reg) >> (bit)) & 1UL)

// 2. Count Set Bits (Brian Kernighan's Algorithm: O(số bit 1))
uint8_t CountSetBits(uint32_t n) {
    uint8_t count = 0;
    while (n > 0) {
        n &= (n - 1); // Xóa bit 1 thấp nhất
        count++;
    }
    return count;
}

// 3. Reverse Bits of a Byte (O(1) dùng bitmask swap)
uint8_t ReverseBits8(uint8_t b) {
    b = ((b & 0xF0) >> 4) | ((b & 0x0F) << 4);
    b = ((b & 0xCC) >> 2) | ((b & 0x33) << 2);
    b = ((b & 0xAA) >> 1) | ((b & 0x55) << 1);
    return b;
}

// 4. Swap Nibbles (Ví dụ 0xAB -> 0xBA)
uint8_t SwapNibbles(uint8_t b) {
    return ((b & 0x0F) << 4) | ((b & 0xF0) >> 4);
}

// 5. Check Power of 2 (Ví dụ: 1, 2, 4, 8, 16...)
bool IsPowerOfTwo(uint32_t n) {
    if (n == 0) return false;
    return (n & (n - 1)) == 0;
}
```

---

## Bài 4: Implement Singly Linked List (Insert, Delete, Reverse)

### Đề bài
Viết danh sách liên kết đơn trong C với các hàm: Thêm node vào đầu, xóa node theo giá trị, và đảo ngược danh sách (Reverse list) tại chỗ (in-place) mà không dùng mảng phụ và không dùng đệ quy (đệ quy dễ gây tràn stack trong embedded).

### Code Implementation

```c
#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>

typedef struct Node {
    int32_t data;
    struct Node *next;
} Node_t;

// Thêm vào đầu O(1)
bool List_InsertHead(Node_t **head, int32_t val) {
    Node_t *new_node = (Node_t *)malloc(sizeof(Node_t));
    if (!new_node) return false;
    new_node->data = val;
    new_node->next = *head;
    *head = new_node;
    return true;
}

// Xóa node đầu tiên khớp giá trị O(N)
bool List_DeleteValue(Node_t **head, int32_t val) {
    Node_t *curr = *head;
    Node_t *prev = NULL;

    while (curr != NULL) {
        if (curr->data == val) {
            if (prev == NULL) {
                *head = curr->next;
            } else {
                prev->next = curr->next;
            }
            free(curr);
            return true;
        }
        prev = curr;
        curr = curr->next;
    }
    return false;
}

// Đảo ngược danh sách liên kết in-place O(N), O(1) space
void List_Reverse(Node_t **head) {
    Node_t *prev = NULL;
    Node_t *curr = *head;
    Node_t *next = NULL;

    while (curr != NULL) {
        next = curr->next; // Lưu con trỏ kế tiếp
        curr->next = prev; // Đảo ngược liên kết
        prev = curr;       // Dịch prev sang phải
        curr = next;       // Dịch curr sang phải
    }
    *head = prev;
}
```

---

## Bài 5: Implement Finite State Machine (FSM)

### Đề bài
Viết FSM điều khiển trạng thái nguồn một màn hình Digital Cluster trong ô tô gồm 4 trạng thái:
- `STATE_OFF` (Tắt nguồn)
- `STATE_STANDBY` (Chờ ACC On)
- `STATE_NORMAL` (Xe chạy, màn hình hiển thị đầy đủ)
- `STATE_FAILSAFE` (Có lỗi nghiêm trọng từ SFM/Watchdog)
Các sự kiện đầu vào: `EV_IGNITION_ON`, `EV_IGNITION_OFF`, `EV_ERROR_DETECTED`, `EV_ERROR_CLEARED`.
Dùng bảng chuyển trạng thái (State Transition Table) kết hợp Function Pointer.

### Code Implementation

```c
#include <stdio.h>

typedef enum {
    STATE_OFF = 0,
    STATE_STANDBY,
    STATE_NORMAL,
    STATE_FAILSAFE,
    STATE_MAX
} SystemState_t;

typedef enum {
    EV_IGN_ON = 0,
    EV_IGN_OFF,
    EV_ERROR_DETECTED,
    EV_ERROR_CLEARED,
    EV_MAX
} SystemEvent_t;

typedef void (*StateAction_t)(void);

void Action_TurnOnScreen(void)     { printf("Action: Power On Display & Cluster\n"); }
void Action_TurnOffScreen(void)    { printf("Action: Enter Low Power Sleep\n"); }
void Action_EnterFailsafe(void)    { printf("Action: Warning Icon ON, Log error to EEPROM\n"); }
void Action_RecoverNormal(void)    { printf("Action: Clear Warning, Restore GUI\n"); }

typedef struct {
    SystemState_t next_state;
    StateAction_t action;
} Transition_t;

// Ma trận chuyển trạng thái [Current State][Event]
const Transition_t state_table[STATE_MAX][EV_MAX] = {
    [STATE_OFF] = {
        [EV_IGN_ON]          = { STATE_STANDBY,  Action_TurnOnScreen },
        [EV_IGN_OFF]         = { STATE_OFF,      NULL },
        [EV_ERROR_DETECTED]  = { STATE_OFF,      NULL },
        [EV_ERROR_CLEARED]   = { STATE_OFF,      NULL },
    },
    [STATE_STANDBY] = {
        [EV_IGN_ON]          = { STATE_NORMAL,   NULL },
        [EV_IGN_OFF]         = { STATE_OFF,      Action_TurnOffScreen },
        [EV_ERROR_DETECTED]  = { STATE_FAILSAFE, Action_EnterFailsafe },
        [EV_ERROR_CLEARED]   = { STATE_STANDBY,  NULL },
    },
    [STATE_NORMAL] = {
        [EV_IGN_ON]          = { STATE_NORMAL,   NULL },
        [EV_IGN_OFF]         = { STATE_OFF,      Action_TurnOffScreen },
        [EV_ERROR_DETECTED]  = { STATE_FAILSAFE, Action_EnterFailsafe },
        [EV_ERROR_CLEARED]   = { STATE_NORMAL,   NULL },
    },
    [STATE_FAILSAFE] = {
        [EV_IGN_ON]          = { STATE_FAILSAFE, NULL },
        [EV_IGN_OFF]         = { STATE_OFF,      Action_TurnOffScreen },
        [EV_ERROR_DETECTED]  = { STATE_FAILSAFE, NULL },
        [EV_ERROR_CLEARED]   = { STATE_NORMAL,   Action_RecoverNormal },
    }
};

static SystemState_t current_state = STATE_OFF;

void FSM_ProcessEvent(SystemEvent_t event) {
    if (event >= EV_MAX) return;

    Transition_t trans = state_table[current_state][event];
    if (trans.action != NULL) {
        trans.action();
    }
    current_state = trans.next_state;
}
```

---

## Bài 6: Producer - Consumer with Semaphore (FreeRTOS Style)

### Đề bài
Viết chương trình mô phỏng một Task Producer nhận dữ liệu từ cảm biến tốc độ bánh xe (CAN message) và đẩy vào hàng đợi, một Task Consumer lấy dữ liệu ra để cập nhật kim đồng hồ Cluster. Dùng Semaphore đếm hoặc Mutex và RingBuffer an toàn đa luồng.

### Code Implementation

```c
#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>

// Giả lập FreeRTOS API cho bài phỏng vấn
typedef void* SemaphoreHandle_t;
typedef void* QueueHandle_t;

typedef struct {
    uint16_t vehicle_speed_kmh;
    uint32_t timestamp_ms;
} SpeedMessage_t;

#define QUEUE_LEN 10

QueueHandle_t xSpeedQueue;

// Task Producer: Chu kỳ 10ms nhận CAN frame
void Task_CAN_Receiver(void *pvParameters) {
    SpeedMessage_t msg;
    while (1) {
        // Giả lập đọc phần cứng CAN
        msg.vehicle_speed_kmh = 85; 
        msg.timestamp_ms = 123456;

        // Gửi vào Queue, timeout 0ms nếu queue đầy không block ISR
        // xQueueSend(xSpeedQueue, &msg, 0);

        // vTaskDelay(pdMS_TO_TICKS(10));
    }
}

// Task Consumer: Xử lý hiển thị GUI Cluster
void Task_Display_Renderer(void *pvParameters) {
    SpeedMessage_t rx_msg;
    while (1) {
        // Chờ nhận bản tin với timeout tối đa 100ms
        // if (xQueueReceive(xSpeedQueue, &rx_msg, pdMS_TO_TICKS(100)) == pdPASS) {
        //     Update_Gauge_Needle(rx_msg.vehicle_speed_kmh);
        // } else {
        //     Trigger_Speed_Sensor_Timeout_Warning();
        // }
    }
}
```

---

## Bài 7: Simple UART Driver (Register-Level cho STM32)

### Đề bài
Viết driver bare-metal khởi tạo và truyền nhận UART1 trên STM32 (Cortex-M) thông qua thao tác trực tiếp trên các thanh ghi:
- Cấu hình baud rate (ví dụ 115200 với xung nhịp bus $PCLK = 16	ext{ MHz}$).
- Hàm `UART1_Init(void)`.
- Hàm `UART1_SendChar(char c)` và `UART1_SendString(const char *str)`.
- Hàm `UART1_ReceiveChar(void)`.

### Code Implementation

```c
#include <stdint.h>

// Định nghĩa base address thanh ghi STM32F4
#define RCC_BASE        0x40023800UL
#define RCC_AHB1ENR     (*(volatile uint32_t *)(RCC_BASE + 0x30))
#define RCC_APB2ENR     (*(volatile uint32_t *)(RCC_BASE + 0x44))

#define GPIOA_BASE      0x40020000UL
#define GPIOA_MODER     (*(volatile uint32_t *)(GPIOA_BASE + 0x00))
#define GPIOA_AFRH      (*(volatile uint32_t *)(GPIOA_BASE + 0x24))

#define USART1_BASE     0x40011000UL
#define USART1_SR       (*(volatile uint32_t *)(USART1_BASE + 0x00))
#define USART1_DR       (*(volatile uint32_t *)(USART1_BASE + 0x04))
#define USART1_BRR      (*(volatile uint32_t *)(USART1_BASE + 0x08))
#define USART1_CR1      (*(volatile uint32_t *)(USART1_BASE + 0x0C))

#define USART_SR_TXE    (1UL << 7)  // Transmit data register empty
#define USART_SR_RXNE   (1UL << 5)  // Read data register not empty
#define USART_CR1_UE    (1UL << 13) // USART Enable
#define USART_CR1_TE    (1UL << 3)  // Transmitter Enable
#define USART_CR1_RE    (1UL << 2)  // Receiver Enable

void UART1_Init(uint32_t pclk, uint32_t baudrate) {
    // 1. Cấp clock cho GPIOA (AHB1) và USART1 (APB2)
    RCC_AHB1ENR |= (1UL << 0); // GPIOAEN
    RCC_APB2ENR |= (1UL << 4); // USART1EN

    // 2. Cấu hình PA9 (TX) và PA10 (RX) sang Alternate Function AF7
    GPIOA_MODER &= ~((3UL << 18) | (3UL << 20));
    GPIOA_MODER |=  ((2UL << 18) | (2UL << 20)); // Alternate function mode
    GPIOA_AFRH  |=  ((7UL << 4)  | (7UL << 8));  // AF7 cho pin 9 và 10

    // 3. Tính toán Baud Rate: BRR = PCLK / BaudRate
    USART1_BRR = (pclk + (baudrate / 2)) / baudrate;

    // 4. Bật TX, RX và USART Enable
    USART1_CR1 = USART_CR1_UE | USART_CR1_TE | USART_CR1_RE;
}

void UART1_SendChar(char c) {
    // Chờ cho đến khi Data Register rỗng (TXE = 1)
    while (!(USART1_SR & USART_SR_TXE));
    USART1_DR = (uint32_t)c;
}

void UART1_SendString(const char *str) {
    while (*str) {
        UART1_SendChar(*str++);
    }
}

char UART1_ReceiveChar(void) {
    // Chờ cho đến khi nhận được dữ liệu (RXNE = 1)
    while (!(USART1_SR & USART_SR_RXNE));
    return (char)(USART1_DR & 0xFF);
}
```

---

## Bài 8: I2C Bit-Banging (Mô phỏng I2C bằng phần mềm)

### Đề bài
Khi vi điều khiển hết chân phần cứng I2C hoặc chân I2C bị lỗi, lập trình viên Embedded thường phải dùng kỹ thuật Bit-Banging trên 2 chân GPIO bất kỳ để giao tiếp với cảm biến hoặc Serializer/Deserializer IC (ds90ub947/948). Viết các hàm I2C Bit-Banging: `I2C_Start()`, `I2C_Stop()`, `I2C_WriteByte(uint8_t byte)`.

### Code Implementation

```c
#include <stdint.h>
#include <stdbool.h>

// Giả lập hàm điều khiển chân GPIO (ở chế độ Open-Drain)
extern void GPIO_Set_SDA(uint8_t level);
extern void GPIO_Set_SCL(uint8_t level);
extern uint8_t GPIO_Read_SDA(void);
extern void Delay_us(uint32_t us);

#define I2C_DELAY() Delay_us(5)

void I2C_Start(void) {
    GPIO_Set_SDA(1);
    GPIO_Set_SCL(1);
    I2C_DELAY();
    GPIO_Set_SDA(0); // SDA chuyển từ High xuống Low khi SCL đang High
    I2C_DELAY();
    GPIO_Set_SCL(0);
}

void I2C_Stop(void) {
    GPIO_Set_SDA(0);
    GPIO_Set_SCL(0);
    I2C_DELAY();
    GPIO_Set_SCL(1);
    I2C_DELAY();
    GPIO_Set_SDA(1); // SDA chuyển từ Low lên High khi SCL đang High
    I2C_DELAY();
}

// Truyền 1 byte và nhận lại bit ACK (0 = ACK, 1 = NACK)
bool I2C_WriteByte(uint8_t data) {
    for (uint8_t i = 0; i < 8; i++) {
        // Truyền MSB trước
        GPIO_Set_SDA((data & 0x80) ? 1 : 0);
        data <<= 1;
        I2C_DELAY();
        GPIO_Set_SCL(1);
        I2C_DELAY();
        GPIO_Set_SCL(0);
    }

    // Đọc ACK từ Slave
    GPIO_Set_SDA(1); // Thả nổi chân SDA để Slave kéo xuống
    I2C_DELAY();
    GPIO_Set_SCL(1);
    I2C_DELAY();
    uint8_t ack = GPIO_Read_SDA();
    GPIO_Set_SCL(0);

    return (ack == 0); // Trả về true nếu nhận được ACK
}
```

---

## Bài 9: Endianness Detection & Conversion (Xử lý Byte Ordering)

### Đề bài
1. Viết một hàm kiểm tra xem hệ thống hiện tại là Little-Endian hay Big-Endian.
2. Viết các hàm chuyển đổi (Swap byte order) cho kiểu dữ liệu 16-bit và 32-bit (tương tự `htons`, `htonl` trong network/CAN bus) mà không dùng hàm thư viện.

### Code Implementation

```c
#include <stdint.h>
#include <stdbool.h>

// 1. Kiểm tra Little-Endian
bool IsSystemLittleEndian(void) {
    uint16_t test = 0x0001;
    uint8_t *byte_ptr = (uint8_t *)&test;
    return (*byte_ptr == 0x01); // Byte đầu tiên tại địa chỉ thấp nhất lưu LSB
}

// 2. Chuyển đổi 16-bit
uint16_t SwapBytes16(uint16_t val) {
    return (uint16_t)(((val & 0x00FF) << 8) |
                      ((val & 0xFF00) >> 8));
}

// 3. Chuyển đổi 32-bit
uint32_t SwapBytes32(uint32_t val) {
    return (((val & 0x000000FFUL) << 24) |
            ((val & 0x0000FF00UL) << 8)  |
            ((val & 0x00FF0000UL) >> 8)  |
            ((val & 0xFF000000UL) >> 24));
}
```

---

## Bài 10: Implement Callback Mechanism with Context Pointer

### Đề bài
Trong lập trình Driver (UART/CAN/Timer), thiết kế một kiến trúc Callback cho phép tầng Application đăng ký hàm xử lý khi có sự kiện ngắt xảy ra, đồng thời truyền kèm con trỏ dữ liệu ngữ cảnh (`void *user_data`).

### Code Implementation

```c
#include <stdint.h>
#include <stddef.h>

typedef void (*ButtonCallback_t)(uint32_t pin, void *user_data);

typedef struct {
    uint32_t pin_number;
    ButtonCallback_t cb;
    void *context;
} ButtonDriver_t;

static ButtonDriver_t g_buttons[4];

void Button_RegisterCallback(uint8_t index, uint32_t pin, ButtonCallback_t cb, void *user_data) {
    if (index >= 4) return;
    g_buttons[index].pin_number = pin;
    g_buttons[index].cb = cb;
    g_buttons[index].context = user_data;
}

// Được gọi từ chân ngắt phần cứng EXTI_IRQHandler
void Button_ISR_Handler(uint8_t index) {
    if (index < 4 && g_buttons[index].cb != NULL) {
        g_buttons[index].cb(g_buttons[index].pin_number, g_buttons[index].context);
    }
}

// Code tầng ứng dụng sử dụng:
typedef struct {
    uint32_t press_count;
    char dev_name[16];
} AppContext_t;

void OnButtonPress(uint32_t pin, void *user_data) {
    AppContext_t *ctx = (AppContext_t *)user_data;
    ctx->press_count++;
}
```

---

## Bài 11: Implement Simple Cooperative Scheduler (Round-Robin Bare-Metal)

### Đề bài
Viết một bộ lập lịch cộng tác (Cooperative Task Scheduler) chạy trên hệ thống Bare-metal không có RTOS. Mỗi task có một chu kỳ thực thi nhất định (ví dụ Task 1 chạy mỗi 10ms, Task 2 chạy mỗi 100ms).

### Code Implementation

```c
#include <stdint.h>
#include <stdbool.h>

#define MAX_TASKS 5

typedef void (*TaskFunc_t)(void);

typedef struct {
    TaskFunc_t func;
    uint32_t period_ms;
    uint32_t elapsed_ms;
    bool is_ready;
} SimpleTask_t;

static SimpleTask_t task_list[MAX_TASKS];
static uint8_t total_tasks = 0;

bool Scheduler_AddTask(TaskFunc_t func, uint32_t period_ms) {
    if (total_tasks >= MAX_TASKS || func == NULL) return false;
    task_list[total_tasks].func = func;
    task_list[total_tasks].period_ms = period_ms;
    task_list[total_tasks].elapsed_ms = 0;
    task_list[total_tasks].is_ready = false;
    total_tasks++;
    return true;
}

// Gọi từ hàm ngắt SysTick (chu kỳ 1ms)
void SysTick_Handler(void) {
    for (uint8_t i = 0; i < total_tasks; i++) {
        task_list[i].elapsed_ms++;
        if (task_list[i].elapsed_ms >= task_list[i].period_ms) {
            task_list[i].elapsed_ms = 0;
            task_list[i].is_ready = true;
        }
    }
}

// Chạy trong vòng lặp vô tận while(1) của main()
void Scheduler_Dispatch(void) {
    for (uint8_t i = 0; i < total_tasks; i++) {
        if (task_list[i].is_ready) {
            task_list[i].is_ready = false;
            task_list[i].func(); // Thực thi task
        }
    }
}
```

---

## Bài 12: String Library Functions Without Standard Lib

### Đề bài
Viết lại các hàm `my_strlen`, `my_strcpy`, `my_strcmp`, `my_strrev`, `my_itoa` mà không dùng `#include <string.h>` hay `#include <stdlib.h>`.

### Code Implementation

```c
#include <stddef.h>
#include <stdint.h>

size_t my_strlen(const char *s) {
    const char *p = s;
    while (*p) p++;
    return (size_t)(p - s);
}

char* my_strcpy(char *dest, const char *src) {
    char *ret = dest;
    while ((*dest++ = *src++) != '\0');
    return ret;
}

int my_strcmp(const char *s1, const char *s2) {
    while (*s1 && (*s1 == *s2)) {
        s1++;
        s2++;
    }
    return *(const unsigned char *)s1 - *(const unsigned char *)s2;
}

void my_strrev(char *s) {
    if (!s) return;
    char *start = s;
    char *end = s + my_strlen(s) - 1;
    while (start < end) {
        char tmp = *start;
        *start++ = *end;
        *end-- = tmp;
    }
}

// Chuyển số nguyên thành chuỗi ký tự
char* my_itoa(int32_t num, char *str) {
    int i = 0;
    bool is_negative = false;

    if (num == 0) {
        str[i++] = '0';
        str[i] = '\0';
        return str;
    }

    if (num < 0) {
        is_negative = true;
        num = -num;
    }

    while (num != 0) {
        str[i++] = (num % 10) + '0';
        num /= 10;
    }

    if (is_negative) {
        str[i++] = '-';
    }
    str[i] = '\0';

    my_strrev(str);
    return str;
}
```

---

## Bài 13: CRC-16 Calculation (Bit-by-Bit & Lookup Table)

### Đề bài
Viết thuật toán tính CRC-16-CCITT (Polynomial `0x1021`, Init `0xFFFF`) dùng trong kiểm tra tính toàn vẹn gói tin CAN bus / Flash firmware update.

### Code Implementation

```c
#include <stdint.h>
#include <stddef.h>

#define CRC16_POLY 0x1021

// 1. Bit-by-bit calculation (Tiết kiệm ROM)
uint16_t CRC16_Calculate(const uint8_t *data, size_t length) {
    uint16_t crc = 0xFFFF;
    for (size_t i = 0; i < length; i++) {
        crc ^= (uint16_t)data[i] << 8;
        for (uint8_t bit = 0; bit < 8; bit++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ CRC16_POLY;
            } else {
                crc = crc << 1;
            }
        }
    }
    return crc;
}
```

---

## Bài 14: Button Debounce Implementation

### Đề bài
Khi nhấn nút vật lý, hiện tượng rung cơ học (bouncing) làm xuất hiện nhiều xung nhiễu trong khoảng 5-20ms. Hãy viết thuật toán lọc nhiễu nút nhấn bằng phần mềm (Software Debouncing) dựa trên sampling định kỳ 5ms.

### Code Implementation

```c
#include <stdint.h>
#include <stdbool.h>

extern uint8_t Read_Raw_GPIO_Pin(void); // 0: Pressed (Active-low), 1: Released

typedef enum {
    BTN_RELEASED = 0,
    BTN_DEBOUNCE_PRESS,
    BTN_PRESSED,
    BTN_DEBOUNCE_RELEASE
} BtnState_t;

typedef struct {
    BtnState_t state;
    uint8_t counter;
} ButtonDebounce_t;

#define DEBOUNCE_THRESHOLD 4 // 4 * 5ms = 20ms

bool Button_Update_5ms(ButtonDebounce_t *btn) {
    uint8_t raw = Read_Raw_GPIO_Pin();
    bool event_pressed = false;

    switch (btn->state) {
        case BTN_RELEASED:
            if (raw == 0) {
                btn->state = BTN_DEBOUNCE_PRESS;
                btn->counter = 0;
            }
            break;

        case BTN_DEBOUNCE_PRESS:
            if (raw == 0) {
                btn->counter++;
                if (btn->counter >= DEBOUNCE_THRESHOLD) {
                    btn->state = BTN_PRESSED;
                    event_pressed = true; // Phát hiện sự kiện nhấn hợp lệ!
                }
            } else {
                btn->state = BTN_RELEASED; // Xung nhiễu giả
            }
            break;

        case BTN_PRESSED:
            if (raw == 1) {
                btn->state = BTN_DEBOUNCE_RELEASE;
                btn->counter = 0;
            }
            break;

        case BTN_DEBOUNCE_RELEASE:
            if (raw == 1) {
                btn->counter++;
                if (btn->counter >= DEBOUNCE_THRESHOLD) {
                    btn->state = BTN_RELEASED;
                }
            } else {
                btn->state = BTN_PRESSED;
            }
            break;
    }
    return event_pressed;
}
```

---

## Bài 15: Software Timer Service

### Đề bài
Xây dựng một module quản lý nhiều bộ đếm thời gian mềm (Software Timer) từ một nguồn ngắt đồng hồ phần cứng duy nhất (Hardware Tick 1ms). Hỗ trợ chế độ One-shot và Periodic.

### Code Implementation

```c
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

typedef void (*TimerCb_t)(void *arg);

typedef enum {
    TIMER_ONE_SHOT,
    TIMER_PERIODIC
} TimerMode_t;

typedef struct SwTimer {
    uint32_t timeout_ms;
    uint32_t reload_ms;
    TimerMode_t mode;
    bool is_active;
    TimerCb_t callback;
    void *arg;
    struct SwTimer *next;
} SwTimer_t;

static SwTimer_t *timer_head = NULL;

void SwTimer_Start(SwTimer_t *t, uint32_t ms, TimerMode_t mode, TimerCb_t cb, void *arg) {
    if (!t) return;
    t->timeout_ms = ms;
    t->reload_ms = ms;
    t->mode = mode;
    t->callback = cb;
    t->arg = arg;
    t->is_active = true;

    // Chèn vào danh sách
    t->next = timer_head;
    timer_head = t;
}

// Gọi từ ngắt 1ms SysTick
void SwTimer_Tick_1ms(void) {
    SwTimer_t *curr = timer_head;
    while (curr != NULL) {
        if (curr->is_active) {
            if (curr->timeout_ms > 0) {
                curr->timeout_ms--;
            }
            if (curr->timeout_ms == 0) {
                if (curr->callback) {
                    curr->callback(curr->arg);
                }
                if (curr->mode == TIMER_PERIODIC) {
                    curr->timeout_ms = curr->reload_ms;
                } else {
                    curr->is_active = false;
                }
            }
        }
        curr = curr->next;
    }
}
```

---

## Bài 16: Command Line Parser (CLI Parser qua UART)

### Đề bài
Viết một parser tách lệnh nhận từ cổng UART (chuỗi kết thúc bằng `\r` hoặc `\n`), phân tích các tham số (tương tự `argc`, `argv`), và thực thi lệnh tương ứng trong bảng đăng ký lệnh.

### Code Implementation

```c
#include <string.h>
#include <stdio.h>

#define MAX_ARGS 8

typedef int (*CmdHandler_t)(int argc, char *argv[]);

typedef struct {
    const char *name;
    CmdHandler_t handler;
    const char *help;
} CommandEntry_t;

int Cmd_Led(int argc, char *argv[]) {
    if (argc < 2) return -1;
    printf("LED set to %s\n", argv[1]);
    return 0;
}

int Cmd_Reset(int argc, char *argv[]) {
    printf("System rebooting...\n");
    return 0;
}

const CommandEntry_t cmd_table[] = {
    { "led",   Cmd_Led,   "Control LED: led <on|off>" },
    { "reset", Cmd_Reset, "Software Reset system" },
    { NULL,    NULL,      NULL }
};

void CLI_Execute(char *line) {
    char *argv[MAX_ARGS];
    int argc = 0;

    // Phân tách token bằng khoảng trắng
    char *token = strtok(line, " \t\r\n");
    while (token != NULL && argc < MAX_ARGS) {
        argv[argc++] = token;
        token = strtok(NULL, " \t\r\n");
    }

    if (argc == 0) return;

    for (int i = 0; cmd_table[i].name != NULL; i++) {
        if (strcmp(argv[0], cmd_table[i].name) == 0) {
            cmd_table[i].handler(argc, argv);
            return;
        }
    }
    printf("Unknown command: %s\n", argv[0]);
}
```

---

## Bài 17: Implement Queue Using Array

### Đề bài
Cài đặt một hàng đợi (Queue) số nguyên có kích thước cố định bằng mảng tĩnh, hỗ trợ `Enqueue` và `Dequeue` với độ phức tạp $O(1)$.

### Code Implementation

```c
#include <stdbool.h>
#include <stdint.h>

#define QUEUE_CAPACITY 64

typedef struct {
    int32_t data[QUEUE_CAPACITY];
    int front;
    int rear;
    int size;
} StaticQueue_t;

void Queue_Init(StaticQueue_t *q) {
    q->front = 0;
    q->rear = -1;
    q->size = 0;
}

bool Queue_Enqueue(StaticQueue_t *q, int32_t val) {
    if (q->size >= QUEUE_CAPACITY) return false; // Hàng đợi đầy
    q->rear = (q->rear + 1) % QUEUE_CAPACITY;
    q->data[q->rear] = val;
    q->size++;
    return true;
}

bool Queue_Dequeue(StaticQueue_t *q, int32_t *val) {
    if (q->size == 0) return false; // Hàng đợi rỗng
    *val = q->data[q->front];
    q->front = (q->front + 1) % QUEUE_CAPACITY;
    q->size--;
    return true;
}
```

---

## Bài 18: Implement Stack Using Array

### Đề bài
Cài đặt cấu trúc dữ liệu Stack (LIFO) bằng mảng với khả năng phát hiện lỗi tràn ngăn xếp (Stack Overflow) và rỗng ngăn xếp (Stack Underflow).

### Code Implementation

```c
#include <stdbool.h>
#include <stdint.h>

#define STACK_CAPACITY 32

typedef struct {
    int32_t data[STACK_CAPACITY];
    int top;
} Stack_t;

void Stack_Init(Stack_t *s) {
    s->top = -1;
}

bool Stack_Push(Stack_t *s, int32_t val) {
    if (s->top >= STACK_CAPACITY - 1) {
        return false; // Stack Overflow
    }
    s->data[++(s->top)] = val;
    return true;
}

bool Stack_Pop(Stack_t *s, int32_t *val) {
    if (s->top < 0) {
        return false; // Stack Underflow
    }
    *val = s->data[(s->top)--];
    return true;
}
```

---

## Bài 19: Find Bug in Given Embedded C Snippets (Phân tích lỗi C)

### Câu hỏi 1: Lỗi thiếu volatile
```c
// Đoạn code sau bị treo vô tận khi bật tối ưu hóa trình biên dịch -O2/-O3. Tại sao?
int flag = 0;

void ISR_Timer(void) {
    flag = 1;
}

void Wait_Timer(void) {
    while (flag == 0) {
        // Chờ cờ bật
    }
}
```
**Giải thích lỗi & sửa:**
- Trình biên dịch thấy trong hàm `Wait_Timer()` biến `flag` không bị thay đổi trong vòng lặp nên sẽ tối ưu đọc `flag` một lần vào thanh ghi CPU rồi lặp vô hạn `while(1)`.
- **Cách sửa:** Khai báo `volatile int flag = 0;` để buộc CPU luôn đọc trực tiếp từ bộ nhớ RAM mỗi lần lặp.

### Câu hỏi 2: Lỗi tràn bộ đệm (Buffer Overflow) và Signed Index
```c
int8_t index = 0;
uint8_t buffer[200];

void Add_Data(uint8_t val) {
    buffer[index++] = val;
}
```
**Giải thích lỗi & sửa:**
- `int8_t` có giá trị từ `-128` đến `+127`. Khi `index` tăng đến 127 rồi cộng thêm 1, nó sẽ bị tràn thành `-128`. Khi đó `buffer[-128]` ghi đè vào vùng nhớ phía trước mảng (Memory Corruption) gây crash hệ thống.
- **Cách sửa:** Dùng kiểu `uint8_t index` và thêm kiểm tra biên `if (index < 200)`.

### Câu hỏi 3: Lỗi trả về con trỏ biến cục bộ (Dangling Pointer)
```c
char* Get_Sensor_Status(void) {
    char status_str[32];
    sprintf(status_str, "OK: 25C");
    return status_str;
}
```
**Giải thích lỗi & sửa:**
- `status_str` nằm trên ngăn xếp (Stack) của hàm `Get_Sensor_Status`. Khi hàm kết thúc, stack frame bị thu hồi. Con trỏ trả về trỏ vào vùng nhớ rác.
- **Cách sửa:** Dùng `static char status_str[32];` hoặc truyền buffer từ caller vào: `void Get_Sensor_Status(char *out_buf, size_t len)`.

---

## Bài 20: Multi-Task Watchdog Supervisor (Cơ chế Feed Watchdog an toàn)

### Đề bài
Trong một hệ thống ô tô phức tạp có nhiều task (ví dụ Task CAN, Task UI, Task SFM), nếu chỉ để 1 task duy nhất gọi hàm feed watchdog (`Watchdog_Feed()`), thì khi các task khác bị treo (deadlock), hệ thống vẫn không bị reset. Hãy thiết kế module Watchdog Supervisor: Chỉ khi **tất cả** các task đều hoàn thành chu kỳ và báo cáo "sống" (alive) thì vi điều khiển mới thực hiện feed watchdog phần cứng.

### Code Implementation

```c
#include <stdint.h>
#include <stdbool.h>

#define TASK_ID_CAN      0
#define TASK_ID_UI       1
#define TASK_ID_SFM      2
#define TOTAL_TASKS      3

#define ALL_TASKS_MASK   ((1U << TOTAL_TASKS) - 1) // 0b00000111 (0x07)

static volatile uint32_t task_alive_flags = 0;

// Mỗi task gọi hàm này định kỳ khi hoàn thành xong vòng lặp làm việc của nó
void Watchdog_ReportAlive(uint8_t task_id) {
    if (task_id < TOTAL_TASKS) {
        // Thực hiện atomic bitwise OR
        __atomic_fetch_or(&task_alive_flags, (1U << task_id), __ATOMIC_SEQ_CST);
    }
}

// Hàm này được gọi bởi một Timer Task chuyên trách (ví dụ chu kỳ 100ms)
void Watchdog_Supervisor_Tick(void) {
    // Kiểm tra xem tất cả các bit của các task đã được bật lên hay chưa
    if (task_alive_flags == ALL_TASKS_MASK) {
        // Cả 3 task đều đang hoạt động khỏe mạnh -> Feed hardware watchdog
        // Hardware_Watchdog_Reload();

        // Xóa cờ để bắt đầu chu kỳ giám sát tiếp theo
        task_alive_flags = 0;
    } else {
        // Có ít nhất 1 task bị treo hoặc chạy quá thời gian!
        // Không feed watchdog -> Để phần cứng Watchdog Timer đếm hết và Reset chip
        // Hoặc ghi log mã lỗi vào SRAM/EEPROM trước khi reset
    }
}
```

---
