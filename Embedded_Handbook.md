# SỔ TAY KIẾN THỨC EMBEDDED SOFTWARE

> **Tác giả tham khảo**: Dựa trên kinh nghiệm và tech stack của Embedded Software Engineer  
> **Phạm vi**: Từ lập trình C cơ bản đến Automotive Embedded Linux, Multi-core SoC  
> **Mục tiêu**: Tài liệu tham khảo toàn diện cho kỹ sư phần mềm nhúng

---

# MỤC LỤC

- [Chương 1: Ngôn ngữ C cho Embedded Systems](#chương-1-ngôn-ngữ-c-cho-embedded-systems)
- [Chương 2: Kiến trúc Vi điều khiển & SoC](#chương-2-kiến-trúc-vi-điều-khiển--soc)
- [Chương 3: Peripherals & Communication Protocols](#chương-3-peripherals--communication-protocols)
- [Chương 4: RTOS Concepts](#chương-4-rtos-concepts)
- [Chương 5: Embedded Linux](#chương-5-embedded-linux)
- [Chương 6: Multi-core Programming](#chương-6-multi-core-programming)
- [Chương 7: Automotive Software Development Process](#chương-7-automotive-software-development-process)
- [Chương 8: Software Update (OTA/USB)](#chương-8-software-update-otausb)
- [Chương 9: Testing & Debugging](#chương-9-testing--debugging)
- [Chương 10: Development Tools](#chương-10-development-tools)

---

# Chương 1: Ngôn ngữ C cho Embedded Systems

## 1.1 Memory Layout của chương trình C

Khi một chương trình C được biên dịch và nạp vào bộ nhớ, nó được tổ chức thành các vùng (segments) rõ ràng. Hiểu rõ memory layout là nền tảng quan trọng nhất cho lập trình nhúng.

### Sơ đồ Memory Layout

```
+---------------------------+  Địa chỉ cao (VD: 0x2001FFFF)
|                           |
|         STACK             |  ← Grows downward (↓)
|   (Biến cục bộ, return   |
|    address, parameters)   |
|                           |
+- - - - - - - - - - - - - +  ← Stack Pointer (SP)
|           ↓               |
|     (Vùng trống)          |
|           ↑               |
+- - - - - - - - - - - - - +  ← Heap break (brk)
|                           |
|         HEAP              |  ← Grows upward (↑)
|   (malloc, calloc, free)  |
|                           |
+---------------------------+
|                           |
|         BSS               |  ← Uninitialized data
|   (Biến toàn cục/static   |
|    chưa khởi tạo = 0)    |
|                           |
+---------------------------+
|                           |
|         DATA              |  ← Initialized data
|   (Biến toàn cục/static   |
|    đã khởi tạo)           |
|                           |
+---------------------------+
|                           |
|         TEXT (Code)        |  ← Read-only
|   (Mã máy, hằng số)       |
|                           |
+---------------------------+  Địa chỉ thấp (VD: 0x08000000)
```

### Chi tiết từng vùng nhớ

#### TEXT Segment (Code Segment)
- Chứa mã máy (machine code) sau khi biên dịch
- **Read-only** để tránh chương trình tự sửa đổi code
- Trên MCU (STM32), segment này nằm trong **Flash memory**
- Chứa cả **string literals** và **const data** (tùy compiler)

#### DATA Segment
- Chứa biến toàn cục và static **đã được khởi tạo** với giá trị khác 0
- Giá trị khởi tạo được lưu trong Flash, và được **copy vào RAM** khi startup (bởi startup code)

```c
int global_var = 42;           // → DATA segment
static int module_var = 100;   // → DATA segment
```

#### BSS Segment (Block Started by Symbol)
- Chứa biến toàn cục và static **chưa khởi tạo** hoặc khởi tạo bằng 0
- **Không chiếm dung lượng trong file binary** (chỉ lưu kích thước)
- Startup code sẽ **zero-fill** vùng này trước khi gọi main()

```c
int uninit_global;             // → BSS (= 0)
static int zero_var = 0;      // → BSS
static char buffer[1024];     // → BSS (1024 bytes = 0)
```

#### HEAP
- Vùng nhớ cấp phát động qua `malloc()`, `calloc()`, `realloc()`
- Phát triển từ **địa chỉ thấp lên cao**
- Cần `free()` để giải phóng → nếu không sẽ **memory leak**
- **Trong embedded**: thường hạn chế hoặc tránh dùng heap vì:
  - Không deterministic (thời gian cấp phát không cố định)
  - Fragmentation
  - Khó debug memory leak

#### STACK
- Chứa biến cục bộ, tham số hàm, return address
- Phát triển từ **địa chỉ cao xuống thấp**
- Kích thước cố định (stack size) - nếu vượt quá → **Stack Overflow**
- Mỗi lần gọi hàm tạo một **stack frame**

```
Stack Frame của function:
+---------------------------+
|    Return Address         |  ← Địa chỉ quay về caller
+---------------------------+
|    Saved Frame Pointer    |  ← FP/LR register
+---------------------------+
|    Local Variables        |  ← Biến cục bộ
+---------------------------+
|    Function Parameters    |  ← Tham số (nếu > 4, trên ARM)
+---------------------------+
```

### Ví dụ phân tích Memory Layout

```c
#include <stdlib.h>

// TEXT segment: code
// DATA segment:
int init_global = 10;
static int init_static = 20;

// BSS segment:
int uninit_global;
static int uninit_static;
static char big_buffer[4096];

// Hằng số (thường ở TEXT/RODATA):
const int read_only = 99;
const char *message = "Hello Embedded";  // String literal trong TEXT

void example_function(int param) {   // param: trên STACK (hoặc register)
    int local_var = 5;               // STACK
    static int call_count = 0;       // DATA segment (persist qua các lần gọi)
    int *heap_ptr = malloc(100);     // heap_ptr: STACK, *heap_ptr: HEAP

    call_count++;
    // Sử dụng...
    free(heap_ptr);                  // Giải phóng HEAP
}
```

### Kiểm tra Memory Layout trên STM32

```bash
# Dùng arm-none-eabi-size để xem kích thước các segment
$ arm-none-eabi-size firmware.elf
   text    data     bss     dec     hex filename
  12456     128    4196   16780    418c firmware.elf

# text = 12456 bytes (code + const)
# data = 128 bytes (initialized globals)
# bss  = 4196 bytes (uninitialized globals)
# RAM usage = data + bss = 4324 bytes
# Flash usage = text + data = 12584 bytes
```

### Tips thực tế
- **Luôn kiểm tra stack usage**: Dùng pattern fill (0xDEADBEEF) rồi kiểm tra watermark
- **Tránh biến cục bộ lớn**: Array lớn trên stack dễ gây overflow
- **Dùng `static` cho buffer lớn**: Chuyển từ stack sang BSS
- **Linker script (.ld)**: Định nghĩa vị trí và kích thước từng segment

---

## 1.2 Pointer Deep Dive

Pointer là công cụ mạnh nhất và cũng nguy hiểm nhất trong C. Trong embedded, pointer được sử dụng rộng rãi để truy cập hardware registers, quản lý bộ nhớ, và tối ưu hiệu năng.

### Pointer Arithmetic

```c
int arr[5] = {10, 20, 30, 40, 50};
int *p = arr;       // p trỏ tới arr[0]

// Pointer arithmetic: mỗi bước += sizeof(int) = 4 bytes
p + 1;    // Địa chỉ của arr[1] = p + 4 bytes
p + 2;    // Địa chỉ của arr[2] = p + 8 bytes
*(p + 3); // Giá trị arr[3] = 40

// Trừ hai pointer → số phần tử giữa chúng
int *p1 = &arr[1];
int *p2 = &arr[4];
ptrdiff_t diff = p2 - p1; // = 3 (không phải 12 bytes)

// Ứng dụng: duyệt mảng bằng pointer (nhanh hơn index trên một số MCU)
for (int *ptr = arr; ptr < arr + 5; ptr++) {
    process(*ptr);
}
```

### Pointer to Pointer

```c
// Cấp 2: pointer trỏ tới pointer
int value = 42;
int *p = &value;
int **pp = &p;

**pp = 100;  // value = 100

// Ứng dụng 1: Thay đổi pointer trong function
void allocate_buffer(uint8_t **buf, size_t size) {
    *buf = (uint8_t *)malloc(size);
}

uint8_t *buffer = NULL;
allocate_buffer(&buffer, 256);  // buffer giờ trỏ tới vùng nhớ mới

// Ứng dụng 2: Mảng các chuỗi (command table)
const char *commands[] = {"START", "STOP", "RESET", "STATUS"};
// commands là char **
```

### Function Pointer

Function pointer cực kỳ quan trọng trong embedded - dùng cho callback, state machine, và driver abstraction.

```c
// Khai báo function pointer
int (*operation)(int, int);

// Các hàm phép tính
int add(int a, int b) { return a + b; }
int sub(int a, int b) { return a - b; }
int mul(int a, int b) { return a * b; }

// Gán và gọi
operation = add;
int result = operation(3, 4);  // result = 7

// Typedef cho dễ đọc (KHUYẾN NGHỊ trong embedded)
typedef int (*math_op_t)(int, int);
math_op_t op = mul;
op(5, 6); // = 30

// ỨNG DỤNG 1: Callback pattern (rất phổ biến)
typedef void (*uart_callback_t)(uint8_t *data, uint16_t len);

typedef struct {
    UART_TypeDef *instance;
    uart_callback_t rx_callback;
    uart_callback_t tx_callback;
} uart_handle_t;

void uart_register_rx_callback(uart_handle_t *handle, uart_callback_t cb) {
    handle->rx_callback = cb;
}

// Trong ISR:
void USART1_IRQHandler(void) {
    if (/* RX complete */) {
        if (handle.rx_callback != NULL) {
            handle.rx_callback(rx_buffer, rx_len);
        }
    }
}

// ỨNG DỤNG 2: State Machine
typedef void (*state_handler_t)(void);

typedef enum {
    STATE_IDLE,
    STATE_RUNNING,
    STATE_ERROR,
    STATE_COUNT
} system_state_t;

state_handler_t state_table[STATE_COUNT] = {
    [STATE_IDLE]    = handle_idle,
    [STATE_RUNNING] = handle_running,
    [STATE_ERROR]   = handle_error,
};

// Main loop
void state_machine_run(void) {
    state_table[current_state]();  // Gọi handler tương ứng
}

// ỨNG DỤNG 3: Driver abstraction layer (HAL pattern)
typedef struct {
    int  (*init)(void);
    int  (*read)(uint8_t *buf, size_t len);
    int  (*write)(const uint8_t *buf, size_t len);
    void (*deinit)(void);
} driver_ops_t;

// Driver UART cụ thể
static const driver_ops_t uart_ops = {
    .init   = uart_init,
    .read   = uart_read,
    .write  = uart_write,
    .deinit = uart_deinit,
};

// Driver SPI cụ thể
static const driver_ops_t spi_ops = {
    .init   = spi_init,
    .read   = spi_read,
    .write  = spi_write,
    .deinit = spi_deinit,
};
```

### Void Pointer

```c
// void* có thể trỏ tới bất kỳ kiểu dữ liệu nào
// Không thể dereference trực tiếp - phải cast trước

void *generic_ptr;

int x = 42;
float y = 3.14f;

generic_ptr = &x;
int val_x = *(int *)generic_ptr;     // Cast rồi dereference

generic_ptr = &y;
float val_y = *(float *)generic_ptr;

// Ứng dụng 1: Generic function (tương tự memcpy)
void my_memcpy(void *dest, const void *src, size_t n) {
    uint8_t *d = (uint8_t *)dest;
    const uint8_t *s = (const uint8_t *)src;
    while (n--) {
        *d++ = *s++;
    }
}

// Ứng dụng 2: Generic callback data
typedef void (*event_callback_t)(void *user_data);

void on_button_press(void *user_data) {
    int *led_pin = (int *)user_data;
    gpio_toggle(*led_pin);
}

int led = GPIO_PIN_13;
register_callback(BUTTON_EVENT, on_button_press, &led);

// Ứng dụng 3: Truy cập hardware register
#define GPIOA_BASE  0x40020000UL
volatile uint32_t *gpioa_moder = (volatile uint32_t *)(GPIOA_BASE + 0x00);
*gpioa_moder |= (1U << 10);  // Set PA5 as output
```

### Các lỗi phổ biến với Pointer

```c
// 1. NULL pointer dereference
int *p = NULL;
*p = 10;  // CRASH! Hard Fault trên ARM

// 2. Dangling pointer
int *get_local(void) {
    int local = 42;
    return &local;  // BUG: local bị hủy khi function return
}

// 3. Wild pointer (uninitialized)
int *p;       // Giá trị ngẫu nhiên
*p = 100;    // Ghi vào địa chỉ random → undefined behavior

// 4. Buffer overflow qua pointer
char buf[10];
char *p = buf;
for (int i = 0; i < 20; i++) {  // Ghi quá 10 bytes!
    *p++ = 'A';
}

// PHÒNG TRÁNH:
// - Luôn khởi tạo pointer = NULL
// - Kiểm tra NULL trước khi dereference
// - Dùng const cho pointer read-only
// - Dùng size parameter cho buffer functions
```

---

## 1.3 Volatile, Const, Static, Extern

### volatile

Từ khóa `volatile` báo cho compiler rằng giá trị biến **có thể thay đổi bất cứ lúc nào** bởi yếu tố ngoài luồng thực thi chính, ngăn compiler tối ưu hóa (bỏ qua việc đọc lại giá trị).

```c
// KHI NÀO DÙNG volatile:

// 1. Hardware registers (Memory-Mapped I/O)
#define GPIOA_IDR  (*(volatile uint32_t *)0x40020010UL)
// Compiler PHẢI đọc lại register mỗi lần, không cache giá trị cũ

// 2. Biến được thay đổi trong ISR
volatile uint8_t uart_rx_flag = 0;

void USART1_IRQHandler(void) {
    uart_rx_flag = 1;  // Set trong ISR
}

int main(void) {
    while (1) {
        if (uart_rx_flag) {    // Không có volatile → compiler có thể 
            uart_rx_flag = 0;  // optimize thành while(1){} vô hạn
            process_data();
        }
    }
}

// 3. Biến chia sẻ giữa các task trong RTOS
volatile uint32_t shared_counter = 0;

// 4. Biến trong vùng nhớ đặc biệt (DMA buffer, shared memory)
volatile uint8_t dma_buffer[256];

// KHÔNG DÙNG volatile khi:
// - Biến cục bộ thông thường
// - Biến chỉ truy cập từ 1 luồng duy nhất
// - Đã dùng cơ chế synchronization (mutex, memory barrier)

// LƯU Ý: volatile KHÔNG đảm bảo atomicity!
volatile uint32_t counter = 0;
counter++;  // Read-Modify-Write → KHÔNG atomic trên ARM 
            // (cần critical section hoặc atomic operations)
```

### const

```c
// 1. Hằng số - giá trị không đổi
const uint32_t MAX_BUFFER_SIZE = 1024;
const float PI = 3.14159f;

// 2. Pointer và const - 4 cách kết hợp:

// a) Pointer to const data - dữ liệu không đổi, pointer có thể đổi
const int *p1;           // Không thể: *p1 = 10;
int const *p1_alt;       // Tương tự cách viết trên

// b) Const pointer - pointer không đổi, dữ liệu có thể đổi  
int * const p2 = &x;    // Không thể: p2 = &y;

// c) Const pointer to const data - cả hai không đổi
const int * const p3 = &x;

// d) Nhớ: đọc từ PHẢI sang TRÁI
// const int *p   → "p is a pointer to int that is const"
// int * const p  → "p is a const pointer to int"

// 3. Ứng dụng trong embedded:
// Lookup table trong Flash (không chiếm RAM)
const uint16_t sin_table[256] = {0, 402, 804, ...};

// Function parameter bảo vệ dữ liệu
void uart_send(const uint8_t *data, uint16_t len) {
    // Compiler báo lỗi nếu cố sửa data[i]
    for (uint16_t i = 0; i < len; i++) {
        UART_TX_REG = data[i];  // Chỉ đọc, không ghi
    }
}

// 4. volatile const - có ý nghĩa!
// Register chỉ đọc (status register)
#define UART_SR  (*(volatile const uint32_t *)0x40011000UL)
// volatile: giá trị thay đổi bởi hardware
// const: software không được ghi
```

### static

```c
// static có 2 ý nghĩa tùy ngữ cảnh:

// 1. Biến cục bộ static: GIỮA giá trị giữa các lần gọi hàm
void count_calls(void) {
    static int count = 0;  // Chỉ khởi tạo 1 lần, lưu trong DATA segment
    count++;
    printf("Called %d times\n", count);
}
// Lần gọi 1: "Called 1 times"
// Lần gọi 2: "Called 2 times"

// 2. Biến/hàm toàn cục static: HẠN CHẾ scope trong file (internal linkage)
// file: driver_uart.c
static uint8_t rx_buffer[256];     // Chỉ truy cập được trong file này
static void process_rx(void) {}    // Hàm private, không export

// KHÔNG thể truy cập rx_buffer hay process_rx() từ file khác
// → Đây là cách đóng gói (encapsulation) trong C

// Ứng dụng encapsulation trong driver:
// === gpio_driver.c ===
static GPIO_TypeDef *gpio_port;  // Private state

static void configure_clock(void) {  // Private function
    // Enable clock...
}

void gpio_init(GPIO_TypeDef *port, uint16_t pin) {  // Public API
    gpio_port = port;
    configure_clock();
    // Configure pin...
}

// === gpio_driver.h ===
// Chỉ expose API public
void gpio_init(GPIO_TypeDef *port, uint16_t pin);
void gpio_set(uint16_t pin);
void gpio_reset(uint16_t pin);
```

### extern

```c
// extern: khai báo biến/hàm đã được ĐỊNH NGHĨA ở file khác

// === config.c ===
uint32_t system_clock_freq = 72000000;  // Định nghĩa (definition)
uint8_t device_id[8] = {0};

// === config.h ===
extern uint32_t system_clock_freq;  // Khai báo (declaration)
extern uint8_t device_id[8];

// === main.c ===
#include "config.h"
void main(void) {
    printf("Clock: %lu Hz\n", system_clock_freq);  // OK - dùng biến từ config.c
}

// Quy tắc:
// - extern → KHAI BÁO: "biến này tồn tại ở đâu đó"
// - Không extern → ĐỊNH NGHĨA: cấp phát bộ nhớ thực sự
// - Chỉ ĐỊNH NGHĨA 1 lần, KHAI BÁO nhiều lần
// - Hàm mặc định là extern (không cần viết rõ)
```

---

## 1.4 Struct: Padding, Alignment, Packed, Bitfield

### Struct Padding và Alignment

Compiler tự thêm **padding bytes** để đảm bảo alignment phù hợp cho từng kiểu dữ liệu, tối ưu tốc độ truy cập bộ nhớ.

```c
// Quy tắc alignment: kiểu dữ liệu N bytes → địa chỉ chia hết cho N
// uint8_t  → alignment 1 byte
// uint16_t → alignment 2 bytes
// uint32_t → alignment 4 bytes

// VÍ DỤ 1: Struct có padding
struct BadLayout {
    uint8_t  a;    // Offset 0 (1 byte)
                   // [PAD: 3 bytes] ← compiler thêm padding
    uint32_t b;    // Offset 4 (4 bytes) - phải align 4
    uint8_t  c;    // Offset 8 (1 byte)
                   // [PAD: 1 byte]
    uint16_t d;    // Offset 10 (2 bytes) - phải align 2
                   // [PAD: 0 bytes]
};
// sizeof = 12 bytes (thực tế chỉ dùng 8 bytes!)

/*
  Offset:  0   1   2   3   4   5   6   7   8   9  10  11
         +---+---+---+---+---+---+---+---+---+---+---+---+
         | a |PAD|PAD|PAD|     b     | c |PAD|  d    |
         +---+---+---+---+---+---+---+---+---+---+---+---+
*/

// VÍ DỤ 2: Sắp xếp lại để giảm padding
struct GoodLayout {
    uint32_t b;    // Offset 0 (4 bytes)
    uint16_t d;    // Offset 4 (2 bytes)
    uint8_t  a;    // Offset 6 (1 byte)
    uint8_t  c;    // Offset 7 (1 byte)
};
// sizeof = 8 bytes - tiết kiệm 4 bytes!

/*
  Offset:  0   1   2   3   4   5   6   7
         +---+---+---+---+---+---+---+---+
         |       b       |   d   | a | c |
         +---+---+---+---+---+---+---+---+
*/

// TIP: Sắp xếp fields từ lớn đến nhỏ để minimize padding
```

### Packed Attribute

```c
// __packed__ loại bỏ tất cả padding
// Tiết kiệm RAM nhưng có thể CHẬM hơn (unaligned access)

struct __attribute__((packed)) PackedStruct {
    uint8_t  a;    // Offset 0
    uint32_t b;    // Offset 1 (UNALIGNED!)
    uint8_t  c;    // Offset 5
    uint16_t d;    // Offset 6 (UNALIGNED!)
};
// sizeof = 8 bytes

// KHI NÀO DÙNG packed:
// 1. Giao tiếp protocol (CAN message, UART frame)
// 2. Đọc/ghi binary file format
// 3. Hardware register mapping
// 4. Truyền dữ liệu giữa các hệ thống khác nhau

// VÍ DỤ: CAN message parsing
struct __attribute__((packed)) CanMessage {
    uint32_t id;        // 4 bytes
    uint8_t  dlc;       // 1 byte
    uint8_t  data[8];   // 8 bytes
};
// sizeof = 13 bytes (không padding)

// CẢNH BÁO: Trên Cortex-M0, unaligned access gây Hard Fault!
// Cortex-M3/M4/M7 hỗ trợ unaligned nhưng chậm hơn
```

### Bitfield

```c
// Bitfield cho phép định nghĩa field với số bit cụ thể
// Rất hữu ích khi map hardware registers

// VÍ DỤ 1: Status register mapping
typedef union {
    uint32_t raw;
    struct {
        uint32_t busy      : 1;   // Bit 0
        uint32_t error     : 1;   // Bit 1
        uint32_t overrun   : 1;   // Bit 2
        uint32_t reserved1 : 5;   // Bits 3-7
        uint32_t data_cnt  : 8;   // Bits 8-15
        uint32_t reserved2 : 16;  // Bits 16-31
    } bits;
} status_reg_t;

volatile status_reg_t *status = (volatile status_reg_t *)0x40001000;
if (status->bits.busy) {
    // Đang bận
}
uint8_t count = status->bits.data_cnt;

// VÍ DỤ 2: Flags storage (tiết kiệm RAM)
typedef struct {
    uint8_t led_on       : 1;
    uint8_t motor_on     : 1;
    uint8_t alarm_active : 1;
    uint8_t mode         : 3;   // 0-7 (3 bits)
    uint8_t reserved     : 2;
} system_flags_t;  // Chỉ 1 byte thay vì nhiều bool

// CẢNH BÁO với Bitfield:
// 1. Thứ tự bit (MSB/LSB first) phụ thuộc compiler/platform
// 2. Không dùng cho dữ liệu truyền giữa các hệ thống khác nhau
// 3. Không portable - kết quả khác nhau trên different compilers
// 4. MISRA C khuyến cáo cẩn thận khi dùng bitfield
```

---

## 1.5 Preprocessor

### #define và Macro

```c
// 1. Hằng số
#define MAX_BUFFER_SIZE   256
#define UART_BAUD_RATE    115200
#define PI                3.14159f

// 2. Macro hàm (Function-like macro)
#define MIN(a, b)         ((a) < (b) ? (a) : (b))
#define MAX(a, b)         ((a) > (b) ? (a) : (b))
#define ABS(x)            (((x) < 0) ? -(x) : (x))

// QUAN TRỌNG: Luôn đặt () quanh tham số và kết quả!
// Sai: #define SQUARE(x)  x * x
//      SQUARE(2+3) → 2+3 * 2+3 = 2+6+3 = 11 (sai!)
// Đúng:
#define SQUARE(x)  ((x) * (x))
//      SQUARE(2+3) → ((2+3) * (2+3)) = 25

// 3. Macro đa dòng
#define CRITICAL_SECTION_BEGIN()   do { \
    uint32_t primask = __get_PRIMASK(); \
    __disable_irq();

#define CRITICAL_SECTION_END()     \
    __set_PRIMASK(primask); \
} while(0)

// Sử dụng:
CRITICAL_SECTION_BEGIN();
shared_variable++;
CRITICAL_SECTION_END();

// 4. Stringify và Token pasting
#define STR(x)          #x          // Chuyển thành string: STR(hello) → "hello"
#define CONCAT(a, b)    a##b        // Nối token: CONCAT(UART, 1) → UART1

// 5. Macro tiện ích cho embedded
#define BIT(n)              (1UL << (n))
#define SET_BIT(reg, bit)   ((reg) |=  BIT(bit))
#define CLR_BIT(reg, bit)   ((reg) &= ~BIT(bit))
#define TGL_BIT(reg, bit)   ((reg) ^=  BIT(bit))
#define GET_BIT(reg, bit)   (((reg) >> (bit)) & 1UL)

#define ARRAY_SIZE(arr)     (sizeof(arr) / sizeof((arr)[0]))

#define UNUSED(x)           ((void)(x))

// Offset of a field in struct
#define OFFSETOF(type, member) ((size_t)&((type *)0)->member)
```

### Conditional Compilation

```c
// 1. #ifdef / #ifndef / #endif
#ifdef DEBUG
    #define LOG(fmt, ...) printf(fmt, ##__VA_ARGS__)
#else
    #define LOG(fmt, ...)  // Empty - no logging in release
#endif

// 2. Include guard (chống include trùng lặp)
#ifndef __UART_DRIVER_H__
#define __UART_DRIVER_H__

// Nội dung header file...

#endif /* __UART_DRIVER_H__ */

// Hoặc dùng (non-standard nhưng phổ biến):
#pragma once

// 3. Platform-specific code
#if defined(STM32F411)
    #include "stm32f4xx.h"
    #define SYSTEM_CLOCK  100000000UL
#elif defined(STM32F103)
    #include "stm32f1xx.h"
    #define SYSTEM_CLOCK  72000000UL
#elif defined(ESP32)
    #include "esp_system.h"
    #define SYSTEM_CLOCK  240000000UL
#else
    #error "Unsupported platform!"
#endif

// 4. Feature toggles
#define FEATURE_CAN_FD_ENABLED    1
#define FEATURE_DLT_LOGGING       1
#define FEATURE_WATCHDOG          1

#if FEATURE_CAN_FD_ENABLED
void canfd_init(void);
void canfd_send(const can_frame_t *frame);
#endif
```

### Macro vs Inline Function

```c
// MACRO:
#define SQUARE(x) ((x) * (x))
// Ưu: không type-check, linh hoạt, compile-time
// Nhược: khó debug, side effects, không type-safe

int result = SQUARE(i++);  // BUG: i++ được gọi 2 lần!
// Expand: ((i++) * (i++)) → undefined behavior

// INLINE FUNCTION (ưu tiên dùng):
static inline int square(int x) {
    return x * x;
}
// Ưu: type-safe, debug được, không side effects
// Nhược: chỉ hoạt động với 1 kiểu dữ liệu

int result = square(i++);  // OK: i++ chỉ gọi 1 lần

// KHUYẾN NGHỊ:
// - Dùng inline function khi có thể
// - Dùng macro cho: hằng số, conditional compilation, generic operations
// - Dùng enum thay #define cho group hằng số liên quan
```

---

## 1.6 Memory Management: Stack vs Heap

```
+------------------+-----------------------------------+
|    Đặc điểm      |    Stack        |    Heap         |
+------------------+-----------------------------------+
| Cấp phát         | Tự động         | Thủ công        |
| Giải phóng       | Tự động (LIFO)  | Thủ công (free) |
| Tốc độ           | Rất nhanh       | Chậm hơn        |
| Kích thước        | Cố định, nhỏ   | Linh hoạt       |
| Fragmentation    | Không           | Có              |
| Thread safety    | Mỗi thread 1    | Shared (cần     |
|                  | stack riêng      | synchronization)|
| Deterministic    | Có              | Không           |
+------------------+-----------------------------------+
```

### Memory Leak trong Embedded

```c
// Memory leak: cấp phát mà không giải phóng
void bad_function(void) {
    char *buf = malloc(100);
    if (error_condition) {
        return;  // BUG: buf không được free!
    }
    // ...
    free(buf);
}

// Cách fix: đảm bảo free trên MỌI đường đi
void good_function(void) {
    char *buf = malloc(100);
    if (buf == NULL) return;  // Check allocation
    
    if (error_condition) {
        free(buf);    // Free trước khi return
        return;
    }
    // ...
    free(buf);
}

// Pattern: Single exit point
void single_exit(void) {
    char *buf = NULL;
    int ret = -1;
    
    buf = malloc(100);
    if (buf == NULL) goto cleanup;
    
    if (error1) goto cleanup;
    if (error2) goto cleanup;
    
    ret = 0;  // Success

cleanup:
    free(buf);  // free(NULL) an toàn
    return;
}
```

### Memory Fragmentation

```
Ví dụ fragmentation:

Bước 1: Cấp phát A(100), B(50), C(200), D(50)
+------+-----+----------+-----+-----------+
|  A   |  B  |    C     |  D  |   Free    |
| 100B | 50B |   200B   | 50B |           |
+------+-----+----------+-----+-----------+

Bước 2: Free B và C
+------+-----+----------+-----+-----------+
|  A   |FREE |   FREE   |  D  |   Free    |
| 100B | 50B |   200B   | 50B |           |
+------+-----+----------+-----+-----------+

Bước 3: Cấp phát E(300) → FAIL!
Tổng free = 50 + 200 + phần cuối = đủ
Nhưng KHÔNG CÓ block liên tục 300B → Fragmentation!
```

```c
// GIẢI PHÁP trong embedded:

// 1. Memory Pool (Fixed-size block allocator)
#define POOL_BLOCK_SIZE  64
#define POOL_BLOCK_COUNT 16

static uint8_t pool_memory[POOL_BLOCK_COUNT][POOL_BLOCK_SIZE];
static uint8_t pool_used[POOL_BLOCK_COUNT] = {0};

void *pool_alloc(void) {
    for (int i = 0; i < POOL_BLOCK_COUNT; i++) {
        if (!pool_used[i]) {
            pool_used[i] = 1;
            return pool_memory[i];
        }
    }
    return NULL;  // Pool full
}

void pool_free(void *ptr) {
    for (int i = 0; i < POOL_BLOCK_COUNT; i++) {
        if (pool_memory[i] == ptr) {
            pool_used[i] = 0;
            return;
        }
    }
}

// 2. Static allocation (KHUYẾN NGHỊ cho embedded)
// Thay vì malloc, dùng mảng tĩnh
static uint8_t uart_rx_buf[256];   // Cấp phát lúc compile
static uint8_t can_tx_buf[64];

// 3. Ring buffer (circular buffer) - không cần malloc
typedef struct {
    uint8_t buffer[256];
    volatile uint16_t head;
    volatile uint16_t tail;
} ring_buffer_t;
```

---

## 1.7 Coding Standards: MISRA C Rules Quan Trọng

MISRA C (Motor Industry Software Reliability Association) là bộ quy tắc coding cho phần mềm nhúng, đặc biệt trong automotive. Dưới đây là 20 rules quan trọng nhất:

### Mandatory Rules (Bắt buộc)

```c
// Rule 1.3: Không có undefined behavior
// Mọi undefined behavior PHẢI được loại bỏ
int arr[10];
arr[10] = 0;  // VIOLATION: out of bounds → undefined behavior

// Rule 9.1: Biến phải được khởi tạo trước khi sử dụng
int x;
if (x > 0) {}  // VIOLATION: x chưa khởi tạo

int x = 0;     // OK
if (x > 0) {}

// Rule 17.3: Function phải khai báo trước khi dùng (implicit declaration)
process();  // VIOLATION nếu chưa có prototype
// Fix: thêm #include hoặc khai báo prototype trước
```

### Required Rules (Yêu cầu)

```c
// Rule 2.2: Không có dead code
void func(void) {
    return;
    int x = 5;  // VIOLATION: dead code - không bao giờ chạy
}

// Rule 8.4: Prototype phải compatible với definition
// Header: void func(int x);
// Source: void func(float x) {}  // VIOLATION: type mismatch

// Rule 10.1: Không implicit conversion thu hẹp kiểu dữ liệu
uint8_t a = 200;
uint8_t b = 100;
uint8_t c = a + b;  // VIOLATION: a+b = 300, promoted to int, 
                     // implicit narrowing to uint8_t
uint8_t c = (uint8_t)(a + b);  // Vẫn tràn nhưng explicit cast cho biết đã cân nhắc

// Rule 10.3: Biểu thức gán phải cùng essential type category
uint32_t x = -1;  // VIOLATION: signed → unsigned

// Rule 10.4: Cả hai operand phải cùng essential type trong toán tử
if (signed_var > unsigned_var)  // VIOLATION: mixed signed/unsigned

// Rule 11.3: Không cast giữa pointer to object và pointer to khác kiểu
int *p = (int *)char_ptr;  // VIOLATION

// Rule 12.2: Shift operator: right operand phải trong range [0, width-1]
uint32_t x = 1U << 32;  // VIOLATION: shift count >= width

// Rule 13.5: Side effects trong toán tử logic ngắn mạch
if (x > 0 && func_with_side_effect())  // VIOLATION
// func_with_side_effect() có thể không được gọi do short-circuit

// Rule 14.3: Biểu thức boolean không nên luôn true/false
if (unsigned_var >= 0)  // VIOLATION: unsigned luôn >= 0

// Rule 15.7: Else phải kết thúc chuỗi if-else if
if (x == 1) { }
else if (x == 2) { }
// VIOLATION: thiếu else cuối cùng
// Fix:
if (x == 1) { }
else if (x == 2) { }
else { /* default action */ }

// Rule 17.2: Không dùng recursive function
int factorial(int n) {
    return (n <= 1) ? 1 : n * factorial(n - 1);  // VIOLATION
}
// Lý do: stack consumption không xác định → stack overflow

// Rule 17.7: Giá trị return của non-void function phải được sử dụng
malloc(100);  // VIOLATION: bỏ qua return value
// Fix:
void *p = malloc(100);
if (p == NULL) { /* handle error */ }

// Rule 18.1: Pointer arithmetic không được tạo out-of-bounds pointer
int arr[10];
int *p = &arr[0];
int *q = p + 11;  // VIOLATION: past one-past-end
```

### Advisory Rules (Khuyến nghị)

```c
// Rule 2.5: Macro không sử dụng nên bỏ
#define UNUSED_MACRO 42  // Advisory violation nếu không dùng

// Rule 4.1: Chỉ dùng ký tự trong basic character set
// Tránh ký tự đặc biệt ngoài ASCII cơ bản trong code

// Rule 8.7: Biến/hàm nên khai báo ở block scope nhỏ nhất có thể
// Biến chỉ dùng trong 1 file → nên static
// Biến chỉ dùng trong 1 hàm → khai báo trong hàm đó

// Rule 15.5: Hàm nên có 1 điểm thoát duy nhất
int func(int x) {
    if (x < 0) return -1;   // Advisory violation
    if (x > 100) return -2; // Advisory violation
    return x * 2;
}
// Khuyến nghị: dùng biến ret và 1 return ở cuối

// Rule 20.4: Không dùng #define cho hằng số nếu có thể dùng const/enum
#define MAX_SIZE 100     // Advisory: nên dùng const hoặc enum
const int MAX_SIZE = 100;  // Tốt hơn
enum { MAX_SIZE = 100 };   // Cũng tốt
```

### Bảng tóm tắt MISRA C Rules thường gặp

```
+--------+------+------------------------------------------+
| Rule   | Loại | Mô tả                                   |
+--------+------+------------------------------------------+
|  1.3   | Mand | No undefined behavior                    |
|  2.2   | Req  | No dead code                             |
|  8.4   | Req  | Compatible declarations                  |
|  9.1   | Mand | Initialize before use                    |
| 10.1   | Req  | No implicit narrowing conversions        |
| 10.3   | Req  | Same essential type for assignment        |
| 10.4   | Req  | Same essential type for operators         |
| 11.3   | Req  | No pointer type casting                  |
| 12.2   | Req  | Shift in valid range                     |
| 13.5   | Req  | No side effects in && and ||             |
| 14.3   | Req  | No invariant boolean expressions         |
| 14.4   | Req  | Controlling expression must be boolean   |
| 15.5   | Adv  | Single function exit point               |
| 15.7   | Req  | else at end of if-else-if                |
| 17.2   | Req  | No recursion                             |
| 17.3   | Mand | No implicit function declarations        |
| 17.7   | Req  | Return value must be used                |
| 18.1   | Req  | No out-of-bounds pointers                |
| 20.4   | Adv  | Prefer const/enum over #define           |
| 21.3   | Req  | No malloc/free (in critical systems)     |
+--------+------+------------------------------------------+
Mand = Mandatory, Req = Required, Adv = Advisory
```

---


# Chương 2: Kiến trúc Vi điều khiển & SoC

## 2.1 Tổng quan kiến trúc ARM

ARM (Advanced RISC Machines) là kiến trúc bộ xử lý phổ biến nhất trong embedded. ARM chia thành 3 dòng Cortex chính, mỗi dòng phục vụ mục đích khác nhau:

### So sánh Cortex-A, Cortex-R, Cortex-M

```
+------------------+------------------+-------------------+------------------+
|   Đặc điểm       |   Cortex-A       |   Cortex-R        |   Cortex-M       |
+------------------+------------------+-------------------+------------------+
| Mục đích         | Application      | Real-time         | Microcontroller  |
| Ứng dụng         | Linux, Android   | Safety-critical,  | Sensor, Motor    |
|                  | Multimedia, HMI  | Automotive ECU    | control, IoT     |
+------------------+------------------+-------------------+------------------+
| MMU              | Có (full)        | MPU (thường)      | MPU (tùy chọn)   |
| Cache            | L1, L2 (lớn)    | Có (nhỏ-trung)   | Không/nhỏ        |
| Pipeline         | 8-13+ stages     | 8-11 stages       | 2-3 stages       |
| Clock speed      | 1-3 GHz          | 200-800 MHz       | 16-480 MHz       |
| Instruction set  | ARMv8-A (64-bit) | ARMv7-R           | ARMv6-M/v7-M     |
|                  | AArch64/AArch32  | ARM + Thumb-2     | Thumb/Thumb-2    |
+------------------+------------------+-------------------+------------------+
| Interrupt        | GIC              | VIC               | NVIC             |
| controller       | (complex)        | (fast response)   | (deterministic)  |
+------------------+------------------+-------------------+------------------+
| OS support       | Linux, Android   | RTOS              | RTOS, Bare-metal |
|                  | QNX              | SafeRTOS, OSEK    | FreeRTOS         |
+------------------+------------------+-------------------+------------------+
| Power            | Cao              | Trung bình        | Thấp             |
| Giá thành        | Cao              | Trung bình        | Thấp             |
+------------------+------------------+-------------------+------------------+
| Ví dụ chip       | TCC8030 A53      | TCC8030 R5        | STM32F4, F1      |
|                  | Raspberry Pi     | Renesas RH850     | ESP32 (Xtensa)   |
|                  | i.MX8            | TMS570            | nRF52            |
+------------------+------------------+-------------------+------------------+
```

### ARM Register Set (Cortex-M)

```
+------+------------------+------------------------------------+
| Reg  | Tên gọi          | Chức năng                          |
+------+------------------+------------------------------------+
| R0   | Argument/Result  | Tham số hàm 1 / Giá trị trả về    |
| R1   | Argument         | Tham số hàm 2                      |
| R2   | Argument         | Tham số hàm 3                      |
| R3   | Argument         | Tham số hàm 4                      |
| R4-R11| General Purpose | Callee-saved registers             |
| R12  | IP               | Intra-Procedure-call scratch       |
| R13  | SP               | Stack Pointer                      |
| R14  | LR               | Link Register (return address)     |
| R15  | PC               | Program Counter                    |
+------+------------------+------------------------------------+
| xPSR | Program Status   | Flags (N,Z,C,V), Interrupt number  |
+------+------------------+------------------------------------+
```

### ARM Instruction Pipeline

```
Cortex-M3/M4 Pipeline (3 stages):
  Clock:  1    2    3    4    5    6    7
  Instr1: F    D    E
  Instr2:      F    D    E
  Instr3:           F    D    E
  Instr4:                F    D    E

  F = Fetch (đọc instruction từ memory)
  D = Decode (giải mã instruction)
  E = Execute (thực thi)

Cortex-A53 Pipeline (8 stages):
  Nhiều stage hơn → clock nhanh hơn nhưng branch penalty lớn hơn
  → Cần Branch Prediction để giảm penalty
```

---

## 2.2 Multi-core SoC Architecture

### TCC8030 (Dolphin+) Architecture

SoC TCC8030 của Telechips là chip automotive-grade với kiến trúc multi-core heterogeneous:

```
+==================================================================+
|                    TCC8030 SoC (Dolphin+)                        |
+==================================================================+
|                                                                   |
|  +-----------------+    +------------------+   +---------------+  |
|  |   Cortex-A53    |    |   Cortex-A7      |   |  Cortex-R5    |  |
|  |   (Main CPU)    |    |   (Sub CPU)      |   |  (Safety CPU) |  |
|  |   Quad-core     |    |   Single/Dual    |   |  Dual-core    |  |
|  |   64-bit        |    |   32-bit         |   |  32-bit       |  |
|  +-----------------+    +------------------+   +---------------+  |
|         |                      |                      |           |
|         |  Embedded Linux      | RTOS/Bare-metal      | RTOS     |
|         |  (HMI, Apps)         | (SFM, DLT)           |(Safety)  |
|         |                      |                      |           |
|  +------+----------------------+----------------------+------+   |
|  |              Shared Bus / Interconnect (AXI/AHB)          |   |
|  +-----------------------------------------------------------+   |
|         |              |              |              |            |
|  +------+---+   +------+---+  +------+---+   +------+---+       |
|  |   DDR    |   |   SRAM   |  |   Flash  |   | Periph   |       |
|  | Controller|  |  (Shared)|  |          |   | Bridge   |       |
|  +----------+   +----------+  +----------+   +----------+       |
|                                                     |             |
|  +--------------------------------------------------+--------+   |
|  |  Peripherals: CAN, I2C, SPI, UART, USB, GPIO, Timer,      |   |
|  |  FPDLink III, LVDS, Display Controller, Camera IF          |   |
|  +------------------------------------------------------------+   |
+===================================================================+
```

### Vai trò từng core trong Automotive Cluster

```
+-------------------+----------------------------------------------+
| Core              | Vai trò                                      |
+-------------------+----------------------------------------------+
| Cortex-A53 (Main) | - Chạy Embedded Linux                        |
|                   | - Render đồ họa dashboard (HMI)              |
|                   | - Application layer                          |
|                   | - USB update, networking                     |
|                   | - DLT daemon                                 |
+-------------------+----------------------------------------------+
| Cortex-A7 (Sub)   | - SFM (System Failure Monitor)               |
|                   | - DLT flightlog                              |
|                   | - Watchdog management                        |
|                   | - Save fault codes to SRAM                   |
|                   | - Backup/failsafe functions                  |
+-------------------+----------------------------------------------+
| Cortex-R5 (Safety)| - Safety-critical functions                  |
|                   | - Hardware watchdog monitoring                |
|                   | - PMU register management                    |
|                   | - CAN gateway (safety-related messages)      |
|                   | - Boot sequence management                   |
|                   | - Fastest interrupt response                 |
+-------------------+----------------------------------------------+
```

---

## 2.3 Memory-Mapped I/O

Trong kiến trúc ARM, tất cả peripheral registers đều được ánh xạ vào không gian địa chỉ bộ nhớ (memory address space). CPU truy cập peripheral bằng cách đọc/ghi vào các địa chỉ cụ thể.

```c
// Ví dụ trên STM32F411:
// GPIOA base address = 0x40020000

// Cách 1: Truy cập trực tiếp qua pointer
#define GPIOA_MODER  (*(volatile uint32_t *)0x40020000UL) // Mode register
#define GPIOA_OTYPER (*(volatile uint32_t *)0x40020004UL) // Output type
#define GPIOA_OSPEEDR (*(volatile uint32_t *)0x40020008UL) // Speed
#define GPIOA_PUPDR  (*(volatile uint32_t *)0x4002000CUL) // Pull-up/down
#define GPIOA_IDR    (*(volatile uint32_t *)0x40020010UL) // Input data
#define GPIOA_ODR    (*(volatile uint32_t *)0x40020014UL) // Output data
#define GPIOA_BSRR   (*(volatile uint32_t *)0x40020018UL) // Bit set/reset

// Cách 2: Dùng struct (phổ biến hơn, dễ bảo trì)
typedef struct {
    volatile uint32_t MODER;    // 0x00
    volatile uint32_t OTYPER;   // 0x04
    volatile uint32_t OSPEEDR;  // 0x08
    volatile uint32_t PUPDR;    // 0x0C
    volatile uint32_t IDR;      // 0x10
    volatile uint32_t ODR;      // 0x14
    volatile uint32_t BSRR;     // 0x18
    volatile uint32_t LCKR;     // 0x1C
    volatile uint32_t AFR[2];   // 0x20-0x24
} GPIO_TypeDef;

#define GPIOA ((GPIO_TypeDef *)0x40020000UL)
#define GPIOB ((GPIO_TypeDef *)0x40020400UL)
#define GPIOC ((GPIO_TypeDef *)0x40020800UL)

// Sử dụng:
GPIOA->MODER |= (1U << 10);   // Set PA5 as output
GPIOA->ODR   |= (1U << 5);    // Set PA5 high
GPIOA->ODR   &= ~(1U << 5);   // Set PA5 low

// Memory map tổng thể STM32F411:
// +--------------------+  0xFFFFFFFF
// |  Cortex-M4 internal|  0xE0000000 - System control, NVIC, SysTick
// +--------------------+
// |  AHB2 Peripherals  |  0x50000000 - USB OTG
// +--------------------+
// |  AHB1 Peripherals  |  0x40020000 - GPIO, DMA, RCC
// +--------------------+
// |  APB2 Peripherals  |  0x40010000 - USART1, SPI1, TIM1, ADC
// +--------------------+
// |  APB1 Peripherals  |  0x40000000 - TIM2-5, USART2, I2C, SPI2/3
// +--------------------+
// |  SRAM              |  0x20000000 - 128KB
// +--------------------+
// |  Flash             |  0x08000000 - 512KB
// +--------------------+
// |  System Memory     |  0x1FFF0000 - Bootloader (ST factory)
// +--------------------+  0x00000000
```

---

## 2.4 Register-level Programming

### Cách đọc Datasheet

Khi lập trình register-level, kỹ năng đọc datasheet là tối quan trọng.

```
Quy trình đọc datasheet cho một peripheral:

1. Tìm base address trong Memory Map section
2. Đọc register description → offset, reset value
3. Xem bit field description → ý nghĩa từng bit
4. Đọc functional description → cách cấu hình

Ví dụ: Cấu hình USART1 trên STM32F411
- Base address: 0x40011000
- Registers cần quan tâm:
  + USART_SR  (0x00): Status register
  + USART_DR  (0x04): Data register
  + USART_BRR (0x08): Baud rate register
  + USART_CR1 (0x0C): Control register 1
  + USART_CR2 (0x10): Control register 2
  + USART_CR3 (0x14): Control register 3
```

### Thao tác Register cơ bản

```c
// Kỹ thuật bit manipulation cơ bản:

// 1. SET bit (đặt bit = 1)
REG |= (1U << bit_position);
// Ví dụ: Set bit 5
// REG = 0b00000000
// REG |= (1U << 5);
// REG = 0b00100000

// 2. CLEAR bit (xóa bit = 0)
REG &= ~(1U << bit_position);
// REG = 0b00100000
// REG &= ~(1U << 5);
// REG = 0b00000000

// 3. TOGGLE bit (đảo bit)
REG ^= (1U << bit_position);

// 4. CHECK bit (đọc giá trị 1 bit)
if (REG & (1U << bit_position)) {
    // Bit is set
}

// 5. SET nhiều bit liên tiếp (ví dụ: 2-bit field)
// Trước tiên xóa field, sau đó set giá trị mới
REG &= ~(0x3U << field_position);  // Clear 2-bit field
REG |= (value << field_position);  // Set new value

// 6. Macro tiện ích
#define REG_SET_FIELD(reg, mask, pos, val) \
    do { (reg) = ((reg) & ~((mask) << (pos))) | ((val) << (pos)); } while(0)

// Ví dụ thực tế: Cấu hình PA5 output mode trên STM32F411
// MODER register: mỗi pin dùng 2 bits
// 00 = Input, 01 = Output, 10 = Alternate, 11 = Analog
// PA5 → bits [11:10]

#define GPIO_MODER_INPUT    0x0U
#define GPIO_MODER_OUTPUT   0x1U
#define GPIO_MODER_AF       0x2U
#define GPIO_MODER_ANALOG   0x3U

GPIOA->MODER &= ~(0x3U << (5 * 2));              // Clear bits [11:10]
GPIOA->MODER |= (GPIO_MODER_OUTPUT << (5 * 2));   // Set PA5 as output
```

---

## 2.5 Clock System & PLL

### Tổng quan Clock Tree (STM32F411)

```
                  +----------+
                  | HSI RC   |  16 MHz (Internal)
                  | Oscillator|
                  +----+-----+
                       |
    +-----------+      |      +-----------+
    | HSE Xtal  |------+------| PLL       |
    | 8-25 MHz  |      |      |           |
    | (External)|      |      | PLLM (/M) |
    +-----------+      |      | PLLN (*N) |
                       |      | PLLP (/P) |
                       |      | PLLQ (/Q) |
                       |      +-----+-----+
                       |            |
                  +----+------------+----+
                  |   System Clock Mux   |  → SYSCLK (max 100 MHz)
                  |  HSI / HSE / PLL     |
                  +----------+-----------+
                             |
                  +----------+-----------+
                  |    AHB Prescaler     |  → HCLK (max 100 MHz)
                  |    /1, /2, .., /512  |  → CPU, DMA, Memory
                  +----+------------+----+
                       |            |
              +--------+--+  +-----+--------+
              |APB1 Prescl|  |APB2 Prescaler|
              |/1,/2,/4...|  |/1,/2,/4,...  |
              |→ max 50MHz|  |→ max 100MHz  |
              +-----+-----+  +------+-------+
                    |                |
            TIM2-5, USART2    USART1, SPI1,
            I2C1-3, SPI2/3    TIM1, ADC
```

### Cấu hình PLL (Code Example)

```c
// Mục tiêu: HSE 8MHz → PLL → SYSCLK 100MHz
// Công thức: SYSCLK = (HSE / PLLM) * PLLN / PLLP
//          100 MHz = (8 / 4) * 200 / 4 = 100 MHz

void SystemClock_Config(void) {
    // 1. Enable HSE
    RCC->CR |= RCC_CR_HSEON;
    while (!(RCC->CR & RCC_CR_HSERDY));  // Chờ HSE ổn định

    // 2. Configure Flash latency (3 wait states cho 100MHz)
    FLASH->ACR = FLASH_ACR_LATENCY_3WS | FLASH_ACR_PRFTEN | FLASH_ACR_ICEN;

    // 3. Configure PLL
    RCC->PLLCFGR = 0;  // Reset
    RCC->PLLCFGR |= (4U  << RCC_PLLCFGR_PLLM_Pos);  // PLLM = 4
    RCC->PLLCFGR |= (200U << RCC_PLLCFGR_PLLN_Pos);  // PLLN = 200
    RCC->PLLCFGR |= (1U  << RCC_PLLCFGR_PLLP_Pos);   // PLLP = 4 (01)
    RCC->PLLCFGR |= RCC_PLLCFGR_PLLSRC_HSE;          // PLL source = HSE

    // 4. Enable PLL
    RCC->CR |= RCC_CR_PLLON;
    while (!(RCC->CR & RCC_CR_PLLRDY));  // Chờ PLL lock

    // 5. Configure bus prescalers
    RCC->CFGR |= RCC_CFGR_PPRE1_DIV2;   // APB1 = HCLK/2 = 50MHz
    RCC->CFGR |= RCC_CFGR_PPRE2_DIV1;   // APB2 = HCLK/1 = 100MHz
    RCC->CFGR |= RCC_CFGR_HPRE_DIV1;    // AHB = SYSCLK/1 = 100MHz

    // 6. Switch system clock to PLL
    RCC->CFGR |= RCC_CFGR_SW_PLL;
    while ((RCC->CFGR & RCC_CFGR_SWS) != RCC_CFGR_SWS_PLL);

    SystemCoreClock = 100000000;  // Update global variable
}
```

---

## 2.6 Interrupt System

### NVIC (Nested Vectored Interrupt Controller) - Cortex-M

```
Interrupt Flow:
                                        
  Peripheral ──→ Interrupt Request ──→ NVIC ──→ CPU
  (UART, Timer)    (IRQ line)          │         │
                                       │    Save context
                                       │    (R0-R3, R12,
                                       │     LR, PC, xPSR)
                                       │         │
                                       │    Jump to ISR
                                       │    (Vector Table)
                                       │         │
                                       │    Execute ISR
                                       │         │
                                       │    Restore context
                                       │         │
                                       └────── Return
```

```c
// Cấu hình interrupt trên STM32

// 1. Vector Table (startup file)
// Bảng chứa địa chỉ ISR, nằm ở đầu Flash
__attribute__((section(".isr_vector")))
const uint32_t vector_table[] = {
    (uint32_t)&_estack,          // Initial SP
    (uint32_t)Reset_Handler,     // Reset
    (uint32_t)NMI_Handler,       // NMI
    (uint32_t)HardFault_Handler, // Hard Fault
    // ... 
    (uint32_t)EXTI0_IRQHandler,  // EXTI Line 0
    (uint32_t)USART1_IRQHandler, // USART1
    (uint32_t)TIM2_IRQHandler,   // Timer 2
    // ...
};

// 2. Cấu hình NVIC
void interrupt_config(void) {
    // Set priority (0-15, 0 = highest)
    // Trên STM32F411: 4 bits priority → 16 levels
    // Chia thành preemption priority và sub priority
    
    NVIC_SetPriorityGrouping(3);  // 4 bits preemption, 0 bits sub
    
    NVIC_SetPriority(USART1_IRQn, 5);   // Priority 5
    NVIC_SetPriority(TIM2_IRQn, 2);     // Priority 2 (cao hơn)
    NVIC_SetPriority(EXTI0_IRQn, 1);    // Priority 1 (cao nhất)
    
    NVIC_EnableIRQ(USART1_IRQn);
    NVIC_EnableIRQ(TIM2_IRQn);
    NVIC_EnableIRQ(EXTI0_IRQn);
}

// 3. Nested Interrupt Example
// Nếu đang xử lý USART1 (priority 5), TIM2 (priority 2) có thể
// preempt (chen ngang) vì priority cao hơn

void USART1_IRQHandler(void) {
    // Đang xử lý... TIM2 có thể chen ngang ở đây
    if (USART1->SR & USART_SR_RXNE) {
        uint8_t data = USART1->DR;  // Đọc data → clear flag
        rx_buffer[rx_index++] = data;
    }
}

void TIM2_IRQHandler(void) {
    if (TIM2->SR & TIM_SR_UIF) {
        TIM2->SR &= ~TIM_SR_UIF;  // Clear flag (QUAN TRỌNG!)
        tick_count++;
    }
}

// 4. Critical section - tắt interrupt tạm thời
void critical_operation(void) {
    uint32_t primask = __get_PRIMASK();
    __disable_irq();  // Disable ALL interrupts
    
    // Critical code - không bị interrupt chen ngang
    shared_resource++;
    
    __set_PRIMASK(primask);  // Restore (re-enable nếu trước đó enable)
}
```

### GIC (Generic Interrupt Controller) - Cortex-A

```
GIC Architecture (cho multi-core Cortex-A53):

+--------+  +--------+  +--------+  +--------+
| Core 0 |  | Core 1 |  | Core 2 |  | Core 3 |
+---+----+  +---+----+  +---+----+  +---+----+
    |           |           |           |
+---+-----------+-----------+-----------+---+
|           CPU Interface (per-core)        |
+-------------------------------------------+
|           GIC Distributor                 |
|  - Interrupt priority                     |
|  - Target CPU selection                   |
|  - Enable/Disable                         |
+---+-------+-------+-------+-------+------+
    |       |       |       |       |
   SPI     SPI     SPI     PPI     SGI
  (Shared  (Shared (Shared (Private (Software
   Periph) Periph) Periph) Per-core) Generated)
   
SPI: Shared Peripheral Interrupts (ID 32-1019)
     → CAN, UART, Timer shared giữa các core
PPI: Private Peripheral Interrupts (ID 16-31)
     → Timer, watchdog riêng mỗi core
SGI: Software Generated Interrupts (ID 0-15)
     → Core-to-core communication
```

---

## 2.7 DMA (Direct Memory Access)

DMA cho phép transfer dữ liệu giữa peripheral và memory (hoặc memory-to-memory) **mà không cần CPU**, giải phóng CPU cho các tác vụ khác.

```
Không có DMA (Polling/Interrupt):
  CPU ──read──→ Peripheral
  CPU ──write──→ Memory
  CPU ──read──→ Peripheral   ← CPU bận suốt!
  CPU ──write──→ Memory
  ...

Có DMA:
  CPU: Configure DMA, rồi làm việc khác
  DMA ──read──→ Peripheral ──write──→ Memory   ← CPU rảnh!
  DMA ──read──→ Peripheral ──write──→ Memory
  ...
  DMA: Transfer complete → Interrupt CPU
```

### DMA Architecture trên STM32F411

```
+------------------------------------------------------------------+
|                        DMA Controller                             |
|                                                                    |
|  +----------+  +----------+  +----------+     +----------+        |
|  | Stream 0 |  | Stream 1 |  | Stream 2 | ... | Stream 7 |       |
|  +----+-----+  +----+-----+  +----+-----+     +----+-----+       |
|       |             |             |                  |             |
|  +----+-----+  +----+-----+  +----+-----+     +----+-----+       |
|  |Channel   |  |Channel   |  |Channel   |     |Channel   |       |
|  |Selector  |  |Selector  |  |Selector  |     |Selector  |       |
|  |(0-7)     |  |(0-7)     |  |(0-7)     |     |(0-7)     |       |
|  +----------+  +----------+  +----------+     +----------+       |
|                                                                    |
|  Arbitration: Priority (Very High > High > Medium > Low)          |
|  Nếu priority bằng nhau: Stream number thấp hơn ưu tiên          |
+------------------------------------------------------------------+
         ↕                  ↕                    ↕
    Peripheral          Memory               Memory
    (UART, SPI,        (SRAM)               (SRAM)
     ADC, I2C)

Transfer Modes:
  - Peripheral → Memory (P2M): ADC → buffer, UART RX → buffer
  - Memory → Peripheral (M2P): buffer → UART TX, buffer → SPI TX  
  - Memory → Memory (M2M): Copy data giữa 2 vùng nhớ
```

```c
// Ví dụ: DMA cho UART RX trên STM32F411

#define DMA_BUFFER_SIZE 256
uint8_t dma_rx_buffer[DMA_BUFFER_SIZE];

void dma_uart_rx_init(void) {
    // 1. Enable DMA2 clock (USART1 RX → DMA2 Stream 2, Channel 4)
    RCC->AHB1ENR |= RCC_AHB1ENR_DMA2EN;

    // 2. Disable DMA stream trước khi cấu hình
    DMA2_Stream2->CR &= ~DMA_SxCR_EN;
    while (DMA2_Stream2->CR & DMA_SxCR_EN);  // Chờ disable hoàn tất

    // 3. Cấu hình DMA
    DMA2_Stream2->CR = 0;
    DMA2_Stream2->CR |= (4U << DMA_SxCR_CHSEL_Pos);  // Channel 4
    DMA2_Stream2->CR |= (0U << DMA_SxCR_DIR_Pos);     // P2M (Peripheral to Memory)
    DMA2_Stream2->CR |= DMA_SxCR_MINC;    // Memory increment mode
    DMA2_Stream2->CR &= ~DMA_SxCR_PINC;   // Peripheral address fixed (UART DR)
    DMA2_Stream2->CR |= (0U << DMA_SxCR_MSIZE_Pos);   // Memory data size: byte
    DMA2_Stream2->CR |= (0U << DMA_SxCR_PSIZE_Pos);   // Peripheral data size: byte
    DMA2_Stream2->CR |= DMA_SxCR_CIRC;    // Circular mode
    DMA2_Stream2->CR |= (2U << DMA_SxCR_PL_Pos);      // Priority: High
    DMA2_Stream2->CR |= DMA_SxCR_TCIE;    // Transfer Complete interrupt

    // 4. Cấu hình addresses và size
    DMA2_Stream2->PAR = (uint32_t)&USART1->DR;        // Peripheral address
    DMA2_Stream2->M0AR = (uint32_t)dma_rx_buffer;     // Memory address
    DMA2_Stream2->NDTR = DMA_BUFFER_SIZE;              // Number of data items

    // 5. Enable DMA interrupt
    NVIC_SetPriority(DMA2_Stream2_IRQn, 3);
    NVIC_EnableIRQ(DMA2_Stream2_IRQn);

    // 6. Enable DMA stream
    DMA2_Stream2->CR |= DMA_SxCR_EN;

    // 7. Enable UART DMA receiver
    USART1->CR3 |= USART_CR3_DMAR;
}

void DMA2_Stream2_IRQHandler(void) {
    if (DMA2->LISR & DMA_LISR_TCIF2) {
        DMA2->LIFCR |= DMA_LIFCR_CTCIF2;  // Clear flag
        // Buffer đầy → xử lý dữ liệu
        process_received_data(dma_rx_buffer, DMA_BUFFER_SIZE);
    }
}
```

---

## 2.8 Boot Process (Power-On to main())

### Boot Process trên STM32 (Cortex-M)

```
Power On / Reset
       │
       ▼
+──────────────────+
│ 1. CPU đọc Vector│  Đọc từ địa chỉ 0x00000000 (hoặc remap)
│    Table         │  - Word 0: Initial SP value
│                  │  - Word 1: Reset_Handler address
+──────────────────+
       │
       ▼
+──────────────────+
│ 2. Load SP       │  SP = *(0x00000000) → Stack Pointer
│    Jump to Reset │  PC = *(0x00000004) → Reset_Handler
+──────────────────+
       │
       ▼
+──────────────────+
│ 3. Reset_Handler │  (Trong startup_stm32f411.s)
│    (Startup Code)│
│                  │
│  a. Copy .data   │  Flash → RAM (initialized globals)
│     section      │  
│                  │
│  b. Zero .bss    │  Fill 0 vào BSS section
│     section      │
│                  │
│  c. Call          │  SystemInit() → Configure clock, FPU
│     SystemInit() │
│                  │
│  d. Call __libc  │  Initialize C library (optional)
│     _init()      │
+──────────────────+
       │
       ▼
+──────────────────+
│ 4. Call main()   │  → Chương trình người dùng bắt đầu
+──────────────────+
       │
       ▼
+──────────────────+
│ 5. main() loop   │  while(1) { ... }
│    (Never return) │  Embedded → main không bao giờ return!
+──────────────────+
```

### Boot Process trên SoC Linux (TCC8030)

```
Power On
    │
    ▼
+────────────────+
│ ROM Bootloader │  Built-in, không thay đổi được
│ (BL0)          │  Load BL1 từ Flash/eMMC
+────────────────+
    │
    ▼
+────────────────+
│ BL1 (SPL)      │  Initialize DRAM, load U-Boot
│ Secondary      │
│ Program Loader │
+────────────────+
    │
    ▼
+────────────────+
│ BL2 (U-Boot)   │  Full bootloader
│                │  - Initialize peripherals
│                │  - Load kernel + DTB
│                │  - A/B partition selection
│                │  - USB update check
│                │  - Boot Linux kernel
+────────────────+
    │
    ▼
+────────────────+
│ Linux Kernel   │  Decompress, MMU setup
│                │  - Parse DTB (Device Tree)
│                │  - Initialize drivers
│                │  - Mount rootfs
│                │  - Execute /sbin/init
+────────────────+
    │
    ▼
+────────────────+     +────────────────+
│ Init System    │     │ R5 Core Boot   │  (Parallel)
│ (systemd)      │     │ - RTOS start    │
│ - Mount FS     │     │ - Watchdog init │
│ - Start services│    │ - Safety check  │
│ - Start HMI app│     +────────────────+
+────────────────+
    │
    ▼
+────────────────+
│ Application    │  HMI Dashboard, DLT daemon, etc.
│ Layer          │
+────────────────+
```

---


# Chương 3: Peripherals & Communication Protocols

## 3.1 GPIO (General Purpose Input/Output)

### Input/Output Modes

```
GPIO Pin Configuration Options:

+------------------+--------------------------------------------+
| Mode             | Mô tả                                     |
+------------------+--------------------------------------------+
| Input Floating   | Không pull-up/pull-down, đọc trạng thái    |
|                  | bên ngoài. Dễ bị nhiễu nếu pin treo.      |
+------------------+--------------------------------------------+
| Input Pull-up    | Kéo lên VCC qua điện trở nội → mặc định 1 |
|                  | Khi button nối GND → đọc 0                |
+------------------+--------------------------------------------+
| Input Pull-down  | Kéo xuống GND qua điện trở nội → mặc định 0|
|                  | Khi button nối VCC → đọc 1                |
+------------------+--------------------------------------------+
| Output Push-Pull | Đẩy HIGH (VCC) hoặc kéo LOW (GND)         |
|                  | Mạnh cả 2 chiều, dùng cho LED, relay      |
+------------------+--------------------------------------------+
| Output Open-Drain| Chỉ kéo LOW (GND), HIGH = floating        |
|                  | Cần pull-up ngoài. Dùng cho I2C, multi-   |
|                  | device bus, level shifting                 |
+------------------+--------------------------------------------+
| Alternate Func   | Pin kết nối peripheral (UART, SPI, I2C...) |
+------------------+--------------------------------------------+
| Analog           | Pin kết nối ADC/DAC                        |
+------------------+--------------------------------------------+

Push-Pull vs Open-Drain:

Push-Pull:                    Open-Drain:
    VCC                           VCC
     |                             |
  [PMOS]──┐                    [Pull-up R]
          ├── Output Pin           |
  [NMOS]──┘                    [NMOS]──── Output Pin
     |                             |
    GND                           GND

  HIGH: PMOS ON, NMOS OFF       HIGH: NMOS OFF, Pull-up kéo lên VCC
  LOW:  PMOS OFF, NMOS ON       LOW:  NMOS ON, kéo xuống GND
```

### Register-level GPIO trên STM32F411

```c
// Bật LED trên PA5 (LED onboard trên Nucleo-F411RE)

void gpio_led_init(void) {
    // 1. Enable GPIOA clock
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;

    // 2. Set PA5 as output mode
    GPIOA->MODER &= ~(3U << (5 * 2));  // Clear bits [11:10]
    GPIOA->MODER |= (1U << (5 * 2));   // Set 01 (Output)

    // 3. Set push-pull output type
    GPIOA->OTYPER &= ~(1U << 5);  // 0 = Push-pull

    // 4. Set speed: High
    GPIOA->OSPEEDR |= (2U << (5 * 2));  // 10 = High speed

    // 5. No pull-up/pull-down
    GPIOA->PUPDR &= ~(3U << (5 * 2));  // 00 = No pull
}

void gpio_led_on(void)  { GPIOA->BSRR = (1U << 5); }       // Set bit
void gpio_led_off(void) { GPIOA->BSRR = (1U << (5 + 16)); } // Reset bit
void gpio_led_toggle(void) { GPIOA->ODR ^= (1U << 5); }

// Button input trên PC13 (User button, active LOW)
void gpio_button_init(void) {
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOCEN;

    // Input mode (reset default)
    GPIOC->MODER &= ~(3U << (13 * 2));  // 00 = Input

    // Enable pull-up (button kéo xuống GND khi nhấn)
    GPIOC->PUPDR &= ~(3U << (13 * 2));
    GPIOC->PUPDR |= (1U << (13 * 2));  // 01 = Pull-up
}

uint8_t gpio_button_read(void) {
    return !(GPIOC->IDR & (1U << 13));  // Active LOW → đảo logic
}

// EXTI interrupt cho button (chống debounce bằng software)
void gpio_button_exti_init(void) {
    // 1. Enable SYSCFG clock
    RCC->APB2ENR |= RCC_APB2ENR_SYSCFGEN;

    // 2. Select PC13 for EXTI13
    SYSCFG->EXTICR[3] &= ~(0xFU << 4);
    SYSCFG->EXTICR[3] |= (2U << 4);  // Port C

    // 3. Enable falling edge trigger (button press)
    EXTI->FTSR |= (1U << 13);
    EXTI->RTSR &= ~(1U << 13);  // Disable rising edge

    // 4. Unmask EXTI13
    EXTI->IMR |= (1U << 13);

    // 5. Enable NVIC
    NVIC_SetPriority(EXTI15_10_IRQn, 5);
    NVIC_EnableIRQ(EXTI15_10_IRQn);
}

// ISR with software debounce
volatile uint32_t last_press_tick = 0;
#define DEBOUNCE_MS 200

void EXTI15_10_IRQHandler(void) {
    if (EXTI->PR & (1U << 13)) {
        EXTI->PR |= (1U << 13);  // Clear pending (write 1 to clear)
        
        uint32_t now = HAL_GetTick();
        if ((now - last_press_tick) > DEBOUNCE_MS) {
            last_press_tick = now;
            gpio_led_toggle();  // Action khi nhấn button
        }
    }
}
```

---

## 3.2 Timer

### Các loại Timer trên STM32

```
+------------------+----------+-------+--------------------------------+
| Timer            | Bit      | Loại  | Chức năng chính                |
+------------------+----------+-------+--------------------------------+
| TIM1, TIM8       | 16-bit   | Adv   | PWM, complementary outputs,   |
|                  |          |       | dead-time, motor control       |
+------------------+----------+-------+--------------------------------+
| TIM2, TIM5       | 32-bit   | GP    | General purpose, encoder      |
+------------------+----------+-------+--------------------------------+
| TIM3, TIM4       | 16-bit   | GP    | General purpose, PWM, encoder |
+------------------+----------+-------+--------------------------------+
| TIM9, TIM10, TIM11| 16-bit  | GP    | Simple timer, PWM             |
+------------------+----------+-------+--------------------------------+
| SysTick          | 24-bit   | Core  | OS tick, delay                |
+------------------+----------+-------+--------------------------------+
```

### Basic Timer - Tạo delay chính xác

```c
// Timer hoạt động: đếm từ 0 → ARR (Auto Reload Register)
// Khi counter = ARR → tạo Update Event → reset counter = 0
//
// Timer frequency = Timer_clock / (PSC + 1)
// Update period = (ARR + 1) / Timer_frequency
//
// VD: TIM2 clock = 50 MHz (APB1 = 50MHz, timer x2 = 100MHz? 
//     Tuỳ prescaler config)
// Giả sử timer clock = 100 MHz
// PSC = 9999 → Timer freq = 100MHz / 10000 = 10 KHz (0.1ms per tick)
// ARR = 9999 → Period = 10000 / 10000 = 1 second

void timer2_init_1s(void) {
    // 1. Enable TIM2 clock
    RCC->APB1ENR |= RCC_APB1ENR_TIM2EN;

    // 2. Configure prescaler và auto-reload
    TIM2->PSC = 10000 - 1;   // Prescaler
    TIM2->ARR = 10000 - 1;   // Auto-reload value

    // 3. Enable update interrupt
    TIM2->DIER |= TIM_DIER_UIE;

    // 4. Enable NVIC
    NVIC_SetPriority(TIM2_IRQn, 3);
    NVIC_EnableIRQ(TIM2_IRQn);

    // 5. Start timer
    TIM2->CR1 |= TIM_CR1_CEN;
}

volatile uint32_t seconds = 0;
void TIM2_IRQHandler(void) {
    if (TIM2->SR & TIM_SR_UIF) {
        TIM2->SR &= ~TIM_SR_UIF;  // Clear flag
        seconds++;
    }
}
```

### PWM (Pulse Width Modulation)

```
PWM Signal:
    ____      ____      ____      ____
   |    |    |    |    |    |    |    |
   |    |    |    |    |    |    |    |
---+    +----+    +----+    +----+    +---
   
   |<------->|  Period (ARR)
   |<-->|       Duty cycle (CCR)
   
   Duty% = CCR / ARR * 100%
   Frequency = Timer_clock / ((PSC+1) * (ARR+1))
```

```c
// PWM trên PA5 (TIM2_CH1) - điều khiển độ sáng LED

void pwm_init(uint32_t freq_hz, uint8_t duty_percent) {
    // 1. Enable clocks
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;
    RCC->APB1ENR |= RCC_APB1ENR_TIM2EN;

    // 2. Configure PA5 as Alternate Function (AF1 = TIM2)
    GPIOA->MODER &= ~(3U << (5 * 2));
    GPIOA->MODER |= (2U << (5 * 2));   // Alternate function
    GPIOA->AFR[0] &= ~(0xFU << (5 * 4));
    GPIOA->AFR[0] |= (1U << (5 * 4));  // AF1 = TIM2

    // 3. Calculate PSC and ARR
    uint32_t timer_clk = 100000000;  // 100 MHz
    uint32_t arr_value = (timer_clk / freq_hz) - 1;
    TIM2->PSC = 0;  // No prescaler
    TIM2->ARR = arr_value;

    // 4. Configure PWM Mode 1 on Channel 1
    TIM2->CCMR1 &= ~TIM_CCMR1_OC1M;
    TIM2->CCMR1 |= (6U << TIM_CCMR1_OC1M_Pos);  // PWM Mode 1
    TIM2->CCMR1 |= TIM_CCMR1_OC1PE;  // Preload enable

    // 5. Set duty cycle
    TIM2->CCR1 = (arr_value + 1) * duty_percent / 100;

    // 6. Enable output
    TIM2->CCER |= TIM_CCER_CC1E;

    // 7. Start timer
    TIM2->CR1 |= TIM_CR1_CEN;
}

void pwm_set_duty(uint8_t duty_percent) {
    TIM2->CCR1 = (TIM2->ARR + 1) * duty_percent / 100;
}
```

### Watchdog Timer

```c
// IWDG (Independent Watchdog) - chạy bằng LSI clock riêng (32 KHz)
// Nếu không reset IWDG kịp thời → hệ thống reset
// Dùng để phát hiện software hang/crash

void iwdg_init(uint32_t timeout_ms) {
    // 1. Enable write access
    IWDG->KR = 0x5555;  // Key to enable write

    // 2. Set prescaler
    // LSI = 32 KHz, Prescaler = 32 → IWDG clock = 1 KHz (1ms per tick)
    IWDG->PR = 3;  // Prescaler /32

    // 3. Set reload value
    // timeout = reload / 1000 (seconds)
    IWDG->RLR = timeout_ms;  // Max 4095 → max ~4 seconds

    // 4. Start IWDG
    IWDG->KR = 0xCCCC;  // Start
}

void iwdg_refresh(void) {
    IWDG->KR = 0xAAAA;  // Reload → reset counter
}

// Sử dụng trong main loop:
int main(void) {
    iwdg_init(2000);  // 2 second timeout

    while (1) {
        // Nếu task chạy quá lâu hoặc hang → hệ thống reset
        task1_execute();
        task2_execute();
        iwdg_refresh();  // "Kick" watchdog
    }
}

// WWDG (Window Watchdog):
// Phải refresh trong WINDOW thời gian cụ thể
// Quá sớm HOẶC quá muộn → reset
// Phát hiện software timing issues tốt hơn IWDG
//
// +--[Quá sớm: RESET!]--+--[Window: OK]--+--[Quá muộn: RESET!]--+
// |<--- Forbidden ------>|<--- Allowed -->|<--- Timeout -------->|
```

---

## 3.3 UART (Universal Asynchronous Receiver/Transmitter)

### Frame Format

```
UART Frame:
                                                      
  Idle ──┐  ┌─────┬────┬────┬────┬────┬────┬────┬────┬──────┬────┐
  (HIGH)  │  │Start│ D0 │ D1 │ D2 │ D3 │ D4 │ D5 │ D6 │ D7   │Stop│
         └──┘ Bit │    │    │    │    │    │    │    │(opt) │Bit │
              (0) │<───────── Data bits ──────────>│Parity│(1) │
                  │         (5,6,7, or 8)          │(opt) │    │

  Thông số cấu hình:
  - Baud rate: 9600, 19200, 38400, 57600, 115200, 921600, ...
  - Data bits: 7, 8, 9
  - Parity: None, Even, Odd
  - Stop bits: 1, 1.5, 2
  
  Ký hiệu phổ biến: 115200-8-N-1 (Baud-Data-Parity-Stop)
```

### Baud Rate Calculation

```c
// USART Baud Rate = f_CK / (16 * USARTDIV)  (Oversampling 16)
// USART Baud Rate = f_CK / (8 * USARTDIV)   (Oversampling 8)
//
// Trong đó USARTDIV = BRR register value (fixed point)
// BRR[15:4] = Mantissa, BRR[3:0] = Fraction
//
// Ví dụ: f_CK = 100 MHz, Baud = 115200, Oversampling 16
// USARTDIV = 100,000,000 / (16 * 115200) = 54.253
// Mantissa = 54 = 0x36
// Fraction = 0.253 * 16 = 4.05 ≈ 4 = 0x4
// BRR = 0x364

// Thực tế: Dùng công thức integer
// BRR = (f_CK + Baud/2) / Baud  (for oversampling 16, simplified)
```

### Flow Control

```
Hardware Flow Control (RTS/CTS):

  Device A                    Device B
  +--------+                  +--------+
  |     TX ├─────────────────→│ RX     |
  |     RX │←─────────────────┤ TX     |
  |    RTS ├─────────────────→│ CTS    |  A sẵn sàng nhận → RTS=0
  |    CTS │←─────────────────┤ RTS    |  B sẵn sàng nhận → RTS=0
  +--------+                  +--------+

  Khi buffer gần đầy: RTS = HIGH → báo "ngừng gửi"
  Bên gửi kiểm tra CTS: nếu HIGH → dừng gửi

Software Flow Control (XON/XOFF):
  - XOFF (0x13): Receiver gửi khi buffer gần đầy → Sender dừng
  - XON  (0x11): Receiver gửi khi buffer sẵn sàng → Sender tiếp tục
  - Nhược điểm: 0x11/0x13 không dùng được trong binary data
```

### UART Register-level trên STM32F411

```c
// USART1: PA9 (TX), PA10 (RX)

void uart1_init(uint32_t baudrate) {
    // 1. Enable clocks
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;
    RCC->APB2ENR |= RCC_APB2ENR_USART1EN;

    // 2. Configure PA9 (TX) and PA10 (RX) as Alternate Function 7
    // PA9: AF7
    GPIOA->MODER &= ~(3U << (9 * 2));
    GPIOA->MODER |= (2U << (9 * 2));    // AF mode
    GPIOA->AFR[1] &= ~(0xFU << ((9 - 8) * 4));
    GPIOA->AFR[1] |= (7U << ((9 - 8) * 4));  // AF7

    // PA10: AF7
    GPIOA->MODER &= ~(3U << (10 * 2));
    GPIOA->MODER |= (2U << (10 * 2));
    GPIOA->AFR[1] &= ~(0xFU << ((10 - 8) * 4));
    GPIOA->AFR[1] |= (7U << ((10 - 8) * 4));

    // 3. Configure USART1
    USART1->CR1 = 0;  // Reset
    USART1->CR1 &= ~USART_CR1_M;     // 8 data bits
    USART1->CR1 &= ~USART_CR1_PCE;   // No parity
    USART1->CR2 &= ~USART_CR2_STOP;  // 1 stop bit

    // 4. Set baud rate (APB2 clock = 100 MHz)
    // BRR = f_CK / baud = 100000000 / 115200 = 868 = 0x364
    USART1->BRR = (100000000U + baudrate / 2) / baudrate;

    // 5. Enable TX, RX, USART
    USART1->CR1 |= USART_CR1_TE | USART_CR1_RE;
    USART1->CR1 |= USART_CR1_UE;
}

// Blocking transmit
void uart1_send_char(char c) {
    while (!(USART1->SR & USART_SR_TXE));  // Chờ TX empty
    USART1->DR = c;
}

void uart1_send_string(const char *str) {
    while (*str) {
        uart1_send_char(*str++);
    }
}

// Blocking receive
char uart1_receive_char(void) {
    while (!(USART1->SR & USART_SR_RXNE));  // Chờ RX not empty
    return (char)USART1->DR;
}

// Interrupt-based receive (hiệu quả hơn)
#define RX_BUF_SIZE 128
volatile char rx_buffer[RX_BUF_SIZE];
volatile uint16_t rx_head = 0;

void uart1_enable_rx_interrupt(void) {
    USART1->CR1 |= USART_CR1_RXNEIE;  // Enable RX interrupt
    NVIC_SetPriority(USART1_IRQn, 4);
    NVIC_EnableIRQ(USART1_IRQn);
}

void USART1_IRQHandler(void) {
    if (USART1->SR & USART_SR_RXNE) {
        char data = USART1->DR;  // Đọc DR → auto clear RXNE
        rx_buffer[rx_head] = data;
        rx_head = (rx_head + 1) % RX_BUF_SIZE;
    }
    // Xử lý Overrun error
    if (USART1->SR & USART_SR_ORE) {
        (void)USART1->DR;  // Clear ORE bằng cách đọc DR
    }
}
```

---

## 3.4 I2C (Inter-Integrated Circuit)

### Protocol Detail

```
I2C Bus Topology:
                    VCC
                     │
                   [Rp]  [Rp]      ← Pull-up resistors (2.2K - 10K)
                     │      │
          ┌──────────┼──────┼────────────────────┐
   SDA ───┤          │      │                    │
          │  +-------+------+-------+   +--------+-------+
   SCL ───┤  │ Master (MCU)         │   │ Slave 1        │
          │  │ Addr: N/A            │   │ Addr: 0x48     │
          │  +---------------------+    │ (ds90ub947)    │
          │                             +----------------+
          │
          │  +---------------------+
          ├──│ Slave 2              │
          │  │ Addr: 0x2C           │
          │  │ (ds90ub948)          │
          │  +---------------------+
          │
          │  +---------------------+
          └──│ Slave 3              │
             │ Addr: 0x50           │
             │ (EEPROM)             │
             +---------------------+

I2C Data Transfer:

  Start    Address (7-bit)    R/W  ACK  Data (8 bits)   ACK  Stop
   │    ┌─┬─┬─┬─┬─┬─┬─┬─────┬───┬───┬─┬─┬─┬─┬─┬─┬─┬─┬───┐  │
SDA│    │A6│A5│A4│A3│A2│A1│A0│R/W│ACK│D7│D6│D5│D4│D3│D2│D1│D0│ACK│  │
   └────┴──┴──┴──┴──┴──┴──┴──┴───┴───┴──┴──┴──┴──┴──┴──┴──┴──┴───┘  │
SCL      1  2  3  4  5  6  7   8   9   1  2  3  4  5  6  7  8   9    │
                                                                      │

Start Condition: SDA falls while SCL is HIGH
Stop Condition: SDA rises while SCL is HIGH

    START:          STOP:
    SCL ────────    SCL ────────
    SDA ──┐         SDA     ┌──
          └──              ─┘
```

### Addressing

```c
// 7-bit addressing: 128 địa chỉ (0x00-0x7F)
// Thực tế: 0x00-0x07 và 0x78-0x7F reserved → 112 địa chỉ
// Byte đầu tiên: [A6|A5|A4|A3|A2|A1|A0|R/W]
//                 7-bit address              0=Write, 1=Read

// 10-bit addressing: 1024 địa chỉ
// Dùng 2 bytes: [1|1|1|1|0|A9|A8|R/W] + [A7|A6|A5|A4|A3|A2|A1|A0]
// Prefix 11110 để phân biệt với 7-bit

// ACK/NACK:
// ACK (Acknowledge): Slave kéo SDA LOW trong clock pulse thứ 9
// NACK: SDA giữ HIGH → Slave không phản hồi hoặc báo kết thúc
```

### Clock Stretching & Arbitration

```
Clock Stretching:
- Slave giữ SCL LOW để yêu cầu Master chờ
- Master phải check SCL trước khi tiếp tục
- Dùng khi Slave cần thời gian xử lý (ví dụ: ADC conversion)

SCL (Master):  ──┐     ┌──────┐     ┌──
                  └─────┘      └─────┘
SCL (Actual):  ──┐     ┌──────────┐  ┌──
                  └─────┘ STRETCHED└──┘
                         ← Slave giữ LOW →

Multi-Master Arbitration:
- Nếu 2 Master cùng gửi → so sánh SDA
- Master gửi HIGH nhưng đọc LOW → thua (SDA bị kéo bởi Master khác)
- Master thua dừng ngay, Master thắng tiếp tục
- Không mất dữ liệu!
```

### Ví dụ: Giao tiếp FPDLink III (ds90ub947/948)

```c
// ds90ub947-q1: Serializer (phía cluster/display)
// ds90ub948-q1: Deserializer (phía ECU/SoC)
// I2C address: 
//   ub948 default: 0x2C (7-bit)
//   ub947 default: 0x1A (7-bit, qua FPDLink back-channel)

// Đọc register từ Deserializer (ds90ub948)
uint8_t ub948_read_reg(uint8_t reg_addr) {
    uint8_t value;
    
    // 1. Send register address (Write)
    i2c_start();
    i2c_send_byte(0x2C << 1 | 0);  // Write mode
    i2c_wait_ack();
    i2c_send_byte(reg_addr);
    i2c_wait_ack();
    
    // 2. Read data (Repeated Start)
    i2c_start();  // Repeated start
    i2c_send_byte(0x2C << 1 | 1);  // Read mode
    i2c_wait_ack();
    value = i2c_read_byte();
    i2c_send_nack();  // NACK to end
    i2c_stop();
    
    return value;
}

// Ghi register vào Serializer (ds90ub947) qua back-channel
void ub947_write_reg(uint8_t reg_addr, uint8_t value) {
    // Truy cập ub947 qua ub948 back-channel I2C
    // Bước 1: Cấu hình ub948 slave alias cho ub947
    ub948_write_reg(0x08, 0x1A << 1);  // Slave ID = ub947 addr
    ub948_write_reg(0x10, 0x1A << 1);  // Slave Alias
    
    // Bước 2: Ghi register
    i2c_start();
    i2c_send_byte(0x1A << 1 | 0);  // ub947 address, Write
    i2c_wait_ack();
    i2c_send_byte(reg_addr);
    i2c_wait_ack();
    i2c_send_byte(value);
    i2c_wait_ack();
    i2c_stop();
}

// Cấu hình FPDLink III link
void fpdlink_init(void) {
    // 1. Check device ID
    uint8_t dev_id = ub948_read_reg(0x00);  // Device ID register
    if (dev_id != 0x00) {
        // Device detected
    }
    
    // 2. Configure deserializer
    ub948_write_reg(0x01, 0x01);  // Reset
    delay_ms(10);
    
    // 3. Configure I2C pass-through
    ub948_write_reg(0x03, 0xF8);  // Enable I2C pass-all
    
    // 4. Configure serializer (qua back-channel)
    ub947_write_reg(0x01, 0x01);  // Reset
    delay_ms(10);
    
    // 5. Lock check
    uint8_t status = ub948_read_reg(0x04);  // General Status
    if (status & 0x01) {
        // FPDLink locked - link established
    }
}
```

---

## 3.5 SPI (Serial Peripheral Interface)

### SPI Modes

```
SPI Connections:
  Master                    Slave
  +--------+                +--------+
  | MOSI   ├───────────────→│ MOSI   |  Master Out Slave In
  | MISO   │←───────────────┤ MISO   |  Master In Slave Out
  | SCK    ├───────────────→│ SCK    |  Serial Clock (Master generates)
  | SS/CS  ├───────────────→│ SS/CS  |  Slave Select (Active LOW)
  +--------+                +--------+

SPI Full-duplex:
  Clock  ──┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌──
            └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘ └─┘
  MOSI  ──[D7 ][D6 ][D5 ][D4 ][D3 ][D2 ][D1 ][D0 ]──  Master → Slave
  MISO  ──[D7 ][D6 ][D5 ][D4 ][D3 ][D2 ][D1 ][D0 ]──  Slave → Master
  CS    ──┘                                          └──  Active during transfer

4 SPI Modes (CPOL, CPHA):
+------+------+------+----------------------------------------+
| Mode | CPOL | CPHA | Mô tả                                 |
+------+------+------+----------------------------------------+
|  0   |  0   |  0   | Clock idle LOW, sample on RISING edge  |
|  1   |  0   |  1   | Clock idle LOW, sample on FALLING edge |
|  2   |  1   |  0   | Clock idle HIGH, sample on FALLING edge|
|  3   |  1   |  1   | Clock idle HIGH, sample on RISING edge |
+------+------+------+----------------------------------------+

CPOL = Clock Polarity (idle state)
CPHA = Clock Phase (sampling edge)

Mode 0 (CPOL=0, CPHA=0) - Phổ biến nhất:
  SCK    ──┐ ┌─┐ ┌─┐ ┌─┐ ┌──
            └─┘ └─┘ └─┘ └─┘
  MOSI   [D7 ][D6 ][D5 ][D4 ]...
            ↑    ↑    ↑    ↑
          Sample points (RISING edge)
```

### Multi-slave SPI

```c
// Cách 1: Independent CS (mỗi slave 1 CS pin)
// CS1 ──→ Slave 1
// CS2 ──→ Slave 2
// CS3 ──→ Slave 3
// MOSI, MISO, SCK shared

void spi_select_slave(uint8_t slave_num) {
    // Deselect all
    GPIOB->ODR |= (1U << CS1_PIN) | (1U << CS2_PIN) | (1U << CS3_PIN);
    // Select target slave
    switch (slave_num) {
        case 1: GPIOB->ODR &= ~(1U << CS1_PIN); break;
        case 2: GPIOB->ODR &= ~(1U << CS2_PIN); break;
        case 3: GPIOB->ODR &= ~(1U << CS3_PIN); break;
    }
}

// Cách 2: Daisy chain (nối tiếp slaves)
// Master MOSI → Slave1 MOSI → Slave1 MISO → Slave2 MOSI → ...
// Ít dùng hơn, tiết kiệm CS pins

// SPI transfer function
uint8_t spi_transfer(uint8_t data) {
    while (!(SPI1->SR & SPI_SR_TXE));    // Chờ TX empty
    SPI1->DR = data;                      // Gửi data
    while (!(SPI1->SR & SPI_SR_RXNE));   // Chờ RX
    return SPI1->DR;                      // Đọc data nhận được
}

// Đọc EEPROM qua SPI
void spi_eeprom_read(uint32_t addr, uint8_t *buf, uint16_t len) {
    spi_select_slave(1);
    spi_transfer(0x03);              // READ command
    spi_transfer((addr >> 16) & 0xFF); // Address byte 2
    spi_transfer((addr >> 8) & 0xFF);  // Address byte 1
    spi_transfer(addr & 0xFF);         // Address byte 0
    for (uint16_t i = 0; i < len; i++) {
        buf[i] = spi_transfer(0xFF);   // Dummy byte to clock out data
    }
    spi_deselect_slave(1);
}
```

---

## 3.6 CAN / CAN FD

### Physical Layer

```
CAN Bus Physical Layer:

  Node 1        Node 2        Node 3
  +-----+       +-----+       +-----+
  |CAN  |       |CAN  |       |CAN  |
  |Trans-|      |Trans-|      |Trans-|
  |ceiver|      |ceiver|      |ceiver|
  +--+--++      +--+--++      +--+--++
     |  |          |  |          |  |
  ───+──+──────────+──+──────────+──+──── CAN_H
  ───+──+──────────+──+──────────+──+──── CAN_L
     │  │                        │  │
   [120Ω]                     [120Ω]
   Termination                Termination
   
Differential Signaling:
  Dominant (Logic 0):  CAN_H = 3.5V, CAN_L = 1.5V, Vdiff = 2.0V
  Recessive (Logic 1): CAN_H = 2.5V, CAN_L = 2.5V, Vdiff = 0V

  Voltage
  3.5V ──── CAN_H ────┐         ┌────
                        │  Dominant │
  2.5V ────────────────┼─────────┼──── Recessive
                        │  Dominant │
  1.5V ──── CAN_L ────┘         └────
```

### CAN Data Frame Format

```
Standard CAN Frame (11-bit ID):

  SOF │  Identifier  │RTR│IDE│r0│   DLC   │    Data     │    CRC      │ACK│EOF│IFS│
   1  │   11 bits    │ 1 │ 1 │1 │  4 bits │  0-64 bits  │  15+1 bits  │1+1│ 7 │ 3 │
  bit │              │   │   │  │         │  (0-8 bytes)│             │   │   │   │

Extended CAN Frame (29-bit ID):

  SOF │ Base ID │SRR│IDE│ Extended ID │RTR│r1│r0│ DLC │ Data │  CRC  │ACK│EOF│IFS│
   1  │ 11 bits │ 1 │ 1 │  18 bits    │ 1 │1 │1 │ 4b  │0-8B  │15+1b  │1+1│ 7 │ 3 │

Các field quan trọng:
- SOF: Start of Frame (1 dominant bit)
- Identifier: ID tin nhắn (ưu tiên arbitration)
- RTR: Remote Transmission Request (0=Data, 1=Remote)
- IDE: Identifier Extension (0=Standard, 1=Extended)
- DLC: Data Length Code (0-8 bytes)
- CRC: Cyclic Redundancy Check (error detection)
- ACK: Acknowledgement (receiver kéo dominant)
- EOF: End of Frame (7 recessive bits)
- IFS: Interframe Space (3 recessive bits)
```

### Arbitration Mechanism

```
CAN Arbitration (Non-destructive, bit-wise):
Hai node cùng gửi → so sánh ID từ MSB

  Node A: ID = 0x123 = 0001 0010 0011
  Node B: ID = 0x125 = 0001 0010 0101
  
  Bit#:    10   9   8   7   6   5   4   3   2   1   0
  Node A:   0   0   0   1   0   0   1   0   0   0   1   1
  Node B:   0   0   0   1   0   0   1   0   0   1   0   1
  Bus:      0   0   0   1   0   0   1   0   0   ?
                                                   ↑
  Bit 1: Node A gửi 0 (dominant), Node B gửi 1 (recessive)
         Bus = 0 (dominant wins!)
         Node B đọc bus = 0, nhưng mình gửi 1 → THUA
         Node B dừng gửi, chuyển sang receiver
         Node A thắng, tiếp tục gửi

  → ID nhỏ hơn = Ưu tiên cao hơn!
  → ID 0x000 có ưu tiên cao nhất
```

### Error Handling

```
CAN Error Types:

1. Bit Error: Node gửi bit nhưng đọc lại khác (trừ arbitration)
2. Stuff Error: Vi phạm bit stuffing (>5 bit liên tiếp cùng mức)
3. CRC Error: CRC nhận ≠ CRC tính
4. Form Error: Fixed fields (EOF, ACK delimiter) sai format
5. ACK Error: Không receiver nào ACK

Error State Machine:
  +------------------+    ≥128 errors    +------------------+
  |  Error Active    | ──────────────→   |  Error Passive   |
  |  (Normal)        |                   |  (Still active)  |
  |  TEC < 128       | ←──────────────   |  128≤TEC<256     |
  |  REC < 128       |    < 128 errors   |  128≤REC<256     |
  +------------------+                   +------------------+
                                                  │
                                           TEC ≥ 256
                                                  ▼
                                         +------------------+
                                         |  Bus Off         |
                                         |  (Disconnected)  |
                                         |  128 x 11        |
                                         |  recessive bits  |
                                         |  to recover      |
                                         +------------------+

  TEC = Transmit Error Counter
  REC = Receive Error Counter
```

### CAN FD vs Classical CAN

```
+---------------------------+------------------+------------------+
|  Feature                  | Classical CAN    | CAN FD           |
+---------------------------+------------------+------------------+
| Max data payload          | 8 bytes          | 64 bytes         |
| Bit rate (Arbitration)    | Max 1 Mbps       | Max 1 Mbps       |
| Bit rate (Data phase)     | = Arbitration    | Max 8 Mbps       |
| Bit rate switching        | Không            | Có (BRS bit)     |
| CRC                       | 15-bit           | 17/21-bit        |
| Frame format              | Standard/Extended| FD + Standard/Ext|
| Backward compatible       | N/A              | Có (với CAN 2.0) |
+---------------------------+------------------+------------------+

CAN FD Frame:
  SOF│ID│...│FDF│BRS│ESI│DLC│   DATA (0-64 bytes)  │CRC│ACK│EOF│
                  │   │
                  │   └── Bit Rate Switch: 1=fast data phase
                  └────── FD Format: 1=CAN FD frame

  Arbitration phase: chạy ở tốc độ tiêu chuẩn (500Kbps, 1Mbps)
  Data phase: chuyển sang tốc độ cao (2-8 Mbps) sau BRS bit
```

### CANoe Testing

```
CANoe là công cụ test CAN bus phổ biến trong automotive:

Chức năng chính:
1. Bus Monitor: Quan sát tất cả message trên bus
2. Trace Window: Log chi tiết từng frame (timestamp, ID, data)
3. Graphics Window: Vẽ đồ thị signal theo thời gian
4. Simulation: Giả lập các ECU trên bus
5. CAPL Scripting: Tự động hóa test

Quy trình test CAN với CANoe:
1. Load DBC file (database): định nghĩa message, signal
2. Connect hardware (Vector VN1610, VN1630,...)
3. Start measurement
4. Send/Receive messages
5. Analyze data, verify timing

Ví dụ CAPL script:
```
```c
// CAPL - CANoe scripting language
variables {
    message VehicleSpeed msg_speed;
    timer cyclicTimer;
}

on start {
    setTimer(cyclicTimer, 100);  // 100ms periodic
}

on timer cyclicTimer {
    msg_speed.Speed = 80;  // km/h
    msg_speed.Direction = 1;
    output(msg_speed);     // Gửi lên CAN bus
    setTimer(cyclicTimer, 100);
}

on message DoorStatus {
    if (this.LockState == 1) {
        write("Door locked!");
    }
}
```

---

## 3.7 LIN (Local Interconnect Network)

### Master-Slave Architecture

```
LIN Bus Topology:

  +----------+     +----------+     +----------+
  | Master   |     | Slave 1  |     | Slave 2  |
  | (ECU)    |     | (Mirror) |     | (Window) |
  +----+-----+     +----+-----+     +----+-----+
       |                |                |
  ─────+────────────────+────────────────+───── LIN Bus
                                                (Single wire)

Đặc điểm:
- Single wire + GND
- Max 16 nodes (1 master + 15 slaves)
- Speed: 1-20 Kbps (thường 19.2 Kbps)
- Master điều khiển timing (schedule table)
- Chi phí thấp hơn CAN rất nhiều
- Dùng cho: mirrors, seats, windows, rain sensors
```

### Frame Structure

```
LIN Frame:
  
  Header (Master)                    Response (Slave)
  +-------+--------+-----------+    +------+------+------+------+----------+
  | Break | Sync   | Protected |    | Data | Data | ...  | Data | Checksum |
  | 13+1  | 0x55   | ID        |    |  0   |  1   |      |  N   |          |
  | bits  | 1 byte | 1 byte    |    | 1B   | 1B   |      | 1B   | 1 byte   |
  +-------+--------+-----------+    +------+------+------+------+----------+

  Break: ≥13 dominant bits (đánh thức slaves)
  Sync: 0x55 = 01010101 (slaves dùng để calibrate baud rate)
  Protected ID: 6-bit ID + 2 parity bits

Schedule Table (Master quản lý):
  +------+-----------+------+
  | Slot | Frame ID  | Time |
  +------+-----------+------+
  |  1   |   0x10    | 10ms |  → Read sensor data
  |  2   |   0x21    | 10ms |  → Write motor command
  |  3   |   0x32    | 15ms |  → Read diagnostics
  |  4   |   0x10    | 10ms |  → Read sensor data (lặp lại)
  +------+-----------+------+
  Master lặp lại schedule table liên tục
```

---

## 3.8 FPDLink III

### Serializer/Deserializer Concept

```
FPDLink III Architecture:

  ECU/SoC Side              Cable              Display Side
  +------------------+     Coax/STP     +------------------+
  |                  |     ┌──────┐      |                  |
  | SoC (TCC8030)   |     │      │      | Display Panel    |
  |                  |     │FPDLink│     |                  |
  | +--------------+ |     │ III  │      | +--------------+ |
  | |Display       ├─┼────→│Cable │────→├─┤ LVDS         | |
  | |Controller    | |     │      │      | |Receiver      | |
  | +--------------+ |     │(15m  │      | +--------------+ |
  |                  |     │ max) │      |                  |
  | +--------------+ |     │      │      | +--------------+ |
  | |Deserializer  | |     │      │      | |Serializer    | |
  | |ds90ub948-q1  ├─┼────→│      │←───┼─┤ds90ub947-q1  | |
  | |(Receives data)| |    │      │      | |(Sends data)  | |
  | +--------------+ |     │      │      | +--------------+ |
  |                  |     │      │      |                  |
  | +---------+      |     │      │      |  +---------+     |
  | |I2C      ├──────┼────→│Back  │←───┼──┤Touch    |     |
  | |Master   |      |     │Channel│     |  |Panel    |     |
  | +---------+      |     └──────┘      |  +---------+     |
  +------------------+                   +------------------+

Lưu ý: Trong automotive cluster, thường SoC nằm ở main board,
display nằm xa → FPDLink III truyền video + data qua 1 cáp.

Forward Channel (SoC → Display):
  - Video data (LVDS/RGB)
  - Audio (I2S embedded)
  - High bandwidth

Back Channel (Display → SoC):
  - I2C control
  - Touch data
  - GPIO
  - Low bandwidth
```

### LVDS Signaling

```
LVDS (Low-Voltage Differential Signaling):

  Driver                           Receiver
  +-------+                        +-------+
  |       ├── LVDS+ ──────────────→│       |
  |  3.5mA│                        │  100Ω │
  |Current├── LVDS- ──────────────→│  Term  |
  | Source |                        |       |
  +-------+                        +-------+

  Đặc điểm:
  - Differential: chống nhiễu tốt
  - Low voltage swing: ±350mV (tổng ~700mV)
  - Low power consumption
  - High speed: >1 Gbps possible
  - Dùng cho: display interface, camera interface
  - FPDLink III: mã hóa video+data vào LVDS pairs
```

### ds90ub947-q1 và ds90ub948-q1

```
ds90ub947-q1 (Serializer):
+-------------------------------------------------+
| Input: 24-bit RGB / LVDS (từ Display Controller)|
| Output: FPDLink III serialized data             |
|                                                  |
| Tính năng:                                       |
| - OpenLDI (LVDS) input                           |
| - Embedded I2C back-channel                      |
| - GPIO pass-through (touch interrupt)            |
| - Up to 1080p @ 60Hz                             |
| - I2C address: 0x1A (default)                    |
+-------------------------------------------------+

ds90ub948-q1 (Deserializer):
+-------------------------------------------------+
| Input: FPDLink III serialized data (từ cable)   |
| Output: 24-bit RGB / OpenLDI (LVDS)             |
|                                                  |
| Tính năng:                                       |
| - Auto-detect link speed                         |
| - I2C master for back-channel                   |
| - Configurable via I2C from SoC                 |
| - Lock detection (link status)                  |
| - I2C address: 0x2C (default)                    |
+-------------------------------------------------+

Register Map quan trọng:
+--------+---------+-------------------------------------------+
| Offset | Name    | Mô tả                                    |
+--------+---------+-------------------------------------------+
| 0x00   | DEV_ID  | Device ID / Revision                     |
| 0x01   | RESET   | Soft reset                               |
| 0x03   | GEN_CFG | General configuration (I2C pass-through) |
| 0x04   | GEN_STS | General status (lock, link detect)        |
| 0x05   | I2C_CTL | I2C control (speed, timeout)             |
| 0x07   | SER_ID  | Serializer device ID                     |
| 0x08   | SLAV_ID | Slave device ID                          |
| 0x10   | ALIAS   | Slave device alias                       |
+--------+---------+-------------------------------------------+
```

---


# Chương 4: RTOS Concepts

## 4.1 Task/Thread Management

### Task Structure

```
Task Control Block (TCB):
+---------------------------+
| Task Name                 |
| Task Priority             |
| Task State                |
| Stack Pointer (SP)        |
| Stack Base Address        |
| Stack Size                |
| Program Counter (PC)      |
| CPU Registers (context)   |
| Delay/Timeout counter     |
| Event flags               |
| Queue/Semaphore links     |
| Next/Prev TCB pointers    |
+---------------------------+

Mỗi task có:
- Stack riêng (lưu local variables, return address)
- Context riêng (CPU registers)
- Priority level
- State hiện tại
```

### Task States

```
Task State Diagram:

                    ┌──────────────────────┐
                    │                      │
                    ▼                      │
             +-----------+    Task created │
             |  READY    |◄───────────────┘
             |           |
             +-----+-----+
                   │ Scheduler picks
                   │ (highest priority ready)
                   ▼
             +-----------+
             |  RUNNING  |──────────────┐
             |           |              │
             +-----+-----+      Preempted by
                   │             higher priority
                   │                    │
          ┌────────┼────────┐           │
          │        │        │           │
          ▼        ▼        ▼           ▼
    +---------+ +-------+ +---------+  +---------+
    |BLOCKED  | |SUSPEND| |DELETED  |  | READY   |
    |(Waiting)| |       | |         |  | (back)  |
    +---------+ +-------+ +---------+  +---------+
         │         │
         │ Event   │ Resume
         │ occurs  │
         ▼         ▼
    +---------+ +---------+
    |  READY  | |  READY  |
    +---------+ +---------+

BLOCKED: Chờ event (semaphore, queue, delay, mutex)
SUSPENDED: Bị suspend bởi API call, không chạy cho đến khi resume
READY: Sẵn sàng chạy, chờ scheduler
RUNNING: Đang chạy trên CPU (chỉ 1 task trên single-core)
```

### Ví dụ tạo Task (FreeRTOS)

```c
#include "FreeRTOS.h"
#include "task.h"

// Task function prototype
void vTask_LED(void *pvParameters);
void vTask_UART(void *pvParameters);
void vTask_CAN(void *pvParameters);

int main(void) {
    // Hardware init...
    
    // Tạo tasks
    xTaskCreate(
        vTask_LED,           // Function pointer
        "LED_Task",          // Task name (debug)
        128,                 // Stack size (words, not bytes!)
        NULL,                // Parameters
        1,                   // Priority (1 = low)
        NULL                 // Task handle (optional)
    );

    xTaskCreate(vTask_UART, "UART_Task", 256, NULL, 2, NULL);
    xTaskCreate(vTask_CAN,  "CAN_Task",  256, NULL, 3, NULL);  // Highest priority

    // Start scheduler - KHÔNG BAO GIỜ RETURN
    vTaskStartScheduler();

    // Nếu chạy đến đây = lỗi (thiếu heap)
    while (1);
}

void vTask_LED(void *pvParameters) {
    (void)pvParameters;
    
    while (1) {
        gpio_led_toggle();
        vTaskDelay(pdMS_TO_TICKS(500));  // Block 500ms
        // Task chuyển sang BLOCKED → scheduler chạy task khác
    }
}

void vTask_UART(void *pvParameters) {
    (void)pvParameters;
    
    while (1) {
        // Chờ data từ queue (BLOCKED cho đến khi có data)
        uint8_t data;
        if (xQueueReceive(uart_queue, &data, portMAX_DELAY) == pdTRUE) {
            process_uart_data(data);
        }
    }
}

void vTask_CAN(void *pvParameters) {
    (void)pvParameters;
    
    while (1) {
        // Chờ semaphore từ CAN ISR
        if (xSemaphoreTake(can_sem, pdMS_TO_TICKS(100)) == pdTRUE) {
            can_msg_t msg;
            can_read_message(&msg);
            process_can_message(&msg);
        }
    }
}
```

---

## 4.2 Scheduling Algorithms

### Priority-based Preemptive Scheduling

```
Ví dụ: 3 tasks với priority khác nhau

  Task A (Priority 3 - Highest)
  Task B (Priority 2)
  Task C (Priority 1 - Lowest)

  Time: 0   1   2   3   4   5   6   7   8   9   10
  
  Task A: ___RRR____________RRR___
  Task B: ______RRRBB_______  RRRR
  Task C: RR_________RRRRR________
  
  R = Running, B = Blocked, _ = Ready/Idle

  t=0: Chỉ Task C ready → C chạy
  t=2: Task A ready → Preempt C → A chạy (priority cao hơn)
  t=5: A hoàn thành → B chạy (priority cao hơn C)
  t=8: B blocked (chờ event) → C chạy
  t=10: A lại ready → Preempt C
```

### Round-Robin (Time-slicing)

```
Dùng cho tasks CÙNG priority level:

  Task A (Priority 2)
  Task B (Priority 2)  ← Same priority
  Task C (Priority 2)

  Time slice = 10ms

  Time: 0    10   20   30   40   50   60
        |    |    |    |    |    |    |
  A:    RRRRR_____     RRRRR_____
  B:         RRRRR_____     RRRRR_____
  C:              RRRRR_____     RRRRR

  → Mỗi task chạy 10ms rồi chuyển sang task tiếp theo
  → Công bằng, nhưng context switch overhead
```

---

## 4.3 Synchronization Mechanisms

### Mutex (Mutual Exclusion)

```c
// Mutex: bảo vệ shared resource, chỉ 1 task truy cập tại 1 thời điểm
// KHÁC Semaphore: Mutex có ownership (chỉ task lock mới unlock được)

SemaphoreHandle_t uart_mutex;

void init(void) {
    uart_mutex = xSemaphoreCreateMutex();
}

void task_write_uart(const char *msg) {
    // Chờ lấy mutex (BLOCKED nếu task khác đang giữ)
    if (xSemaphoreTake(uart_mutex, pdMS_TO_TICKS(1000)) == pdTRUE) {
        // Critical section - chỉ 1 task ở đây
        uart_send_string(msg);
        
        // Trả mutex
        xSemaphoreGive(uart_mutex);
    } else {
        // Timeout - không lấy được mutex sau 1 second
        error_handler();
    }
}

// Task A và Task B đều gọi task_write_uart()
// → Đảm bảo không ghi UART chồng chéo
```

### Semaphore

```c
// Binary Semaphore: giống mutex nhưng KHÔNG có ownership
// Dùng cho synchronization (ISR → Task notification)

SemaphoreHandle_t adc_ready_sem;

void init(void) {
    adc_ready_sem = xSemaphoreCreateBinary();  // Initial: empty (0)
}

// ISR: signal khi ADC conversion hoàn thành
void ADC_IRQHandler(void) {
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;
    
    // Give semaphore từ ISR
    xSemaphoreGiveFromISR(adc_ready_sem, &xHigherPriorityTaskWoken);
    
    // Request context switch nếu cần
    portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
}

// Task: chờ ADC data
void vTask_ADC(void *pvParams) {
    while (1) {
        // Block cho đến khi ISR give semaphore
        xSemaphoreTake(adc_ready_sem, portMAX_DELAY);
        
        uint16_t adc_value = ADC1->DR;
        process_adc(adc_value);
    }
}

// Counting Semaphore: đếm số lượng resources/events
SemaphoreHandle_t buffer_pool_sem;

void init(void) {
    // Pool có 5 buffer, semaphore count = 5
    buffer_pool_sem = xSemaphoreCreateCounting(5, 5);
}

void *allocate_buffer(void) {
    if (xSemaphoreTake(buffer_pool_sem, pdMS_TO_TICKS(100)) == pdTRUE) {
        return pool_get_free_buffer();  // count giảm 1
    }
    return NULL;  // Hết buffer
}

void free_buffer(void *buf) {
    pool_return_buffer(buf);
    xSemaphoreGive(buffer_pool_sem);  // count tăng 1
}
```

### Queue (Inter-task Communication)

```c
// Queue: truyền dữ liệu giữa tasks (hoặc ISR → Task)
// FIFO, thread-safe, có thể block khi full/empty

typedef struct {
    uint32_t id;
    uint8_t  data[8];
    uint8_t  dlc;
} can_msg_t;

QueueHandle_t can_rx_queue;

void init(void) {
    // Tạo queue chứa 10 CAN messages
    can_rx_queue = xQueueCreate(10, sizeof(can_msg_t));
}

// ISR: nhận CAN message → đẩy vào queue
void CAN1_RX0_IRQHandler(void) {
    can_msg_t msg;
    BaseType_t xWoken = pdFALSE;
    
    msg.id = CAN1->sFIFOMailBox[0].RIR >> 21;
    msg.dlc = CAN1->sFIFOMailBox[0].RDTR & 0x0F;
    // Copy data...
    
    xQueueSendFromISR(can_rx_queue, &msg, &xWoken);
    portYIELD_FROM_ISR(xWoken);
}

// Task: xử lý CAN messages
void vTask_CAN_Process(void *pvParams) {
    can_msg_t msg;
    
    while (1) {
        // Block cho đến khi có message trong queue
        if (xQueueReceive(can_rx_queue, &msg, portMAX_DELAY) == pdTRUE) {
            switch (msg.id) {
                case 0x100: handle_speed(msg.data, msg.dlc); break;
                case 0x200: handle_rpm(msg.data, msg.dlc); break;
                case 0x300: handle_temp(msg.data, msg.dlc); break;
                default: break;
            }
        }
    }
}
```

---

## 4.4 Priority Inversion & Priority Inheritance

```
Priority Inversion Problem:

  Task H (High priority)
  Task M (Medium priority)
  Task L (Low priority)

  Timeline:
  t1: Task L lấy mutex M (lock resource)
  t2: Task L đang dùng resource...
  t3: Task H ready → preempt L → H chạy
  t4: Task H cần mutex M → BLOCKED (L đang giữ)
  t5: Task M ready → M chạy (priority > L)  ← PROBLEM!
  
  H chờ L, nhưng M chen vào trước L
  → H phải chờ cả M hoàn thành → Priority Inversion!

  H: ____RRR__BBBBBBBBBBBRRR
  M: ______________RRRRR_____
  L: RRRR____RR__________RRR_
                              ↑
                              H phải chờ quá lâu!

Priority Inheritance Protocol (Giải pháp):

  t1: Task L lấy mutex M
  t3: Task H cần mutex M → H BLOCKED
  t4: RTOS tạm nâng priority L = priority H!
  t5: Task M ready nhưng L(inherited H) > M → L tiếp tục
  t6: Task L release mutex → L priority trở về bình thường
  t7: Task H lấy được mutex → H chạy
  t8: Task M chạy

  H: ____RRR__BBBRRRRR________
  M: ____________________RRRRR
  L: RRRR____RR(↑H)RR_________
                   ↑
                   L tạm thời có priority = H
```

```c
// FreeRTOS mutex đã built-in Priority Inheritance
// xSemaphoreCreateMutex() → hỗ trợ priority inheritance
// xSemaphoreCreateBinary() → KHÔNG hỗ trợ

// Luôn dùng Mutex (không phải Binary Semaphore) khi bảo vệ shared resource
SemaphoreHandle_t resource_mutex = xSemaphoreCreateMutex();
```

---

## 4.5 Deadlock

```
Deadlock: 2 tasks chờ nhau vĩnh viễn

  Task A giữ Mutex 1, chờ Mutex 2
  Task B giữ Mutex 2, chờ Mutex 1
  → Cả hai chờ mãi mãi!

  Task A:                   Task B:
  lock(mutex1) ✓            lock(mutex2) ✓
  lock(mutex2) ← BLOCKED   lock(mutex1) ← BLOCKED
  // Deadlock!              // Deadlock!

4 Điều kiện cần cho Deadlock (Coffman):
1. Mutual Exclusion: Resource chỉ 1 task dùng
2. Hold and Wait: Task giữ resource + chờ resource khác
3. No Preemption: Không thể cưỡng chế lấy resource
4. Circular Wait: Vòng chờ đợi vòng tròn

Phòng tránh:
```

```c
// 1. Lock ordering: Luôn lock theo thứ tự nhất quán
// Quy ước: mutex1 trước mutex2
void task_a(void) {
    xSemaphoreTake(mutex1, portMAX_DELAY);  // Luôn lock 1 trước
    xSemaphoreTake(mutex2, portMAX_DELAY);  // Rồi lock 2
    // Critical section...
    xSemaphoreGive(mutex2);
    xSemaphoreGive(mutex1);
}

void task_b(void) {
    xSemaphoreTake(mutex1, portMAX_DELAY);  // CÙNG THỨ TỰ!
    xSemaphoreTake(mutex2, portMAX_DELAY);
    // Critical section...
    xSemaphoreGive(mutex2);
    xSemaphoreGive(mutex1);
}

// 2. Timeout: Không chờ vô hạn
if (xSemaphoreTake(mutex2, pdMS_TO_TICKS(100)) != pdTRUE) {
    // Timeout → release mutex1, retry later
    xSemaphoreGive(mutex1);
    vTaskDelay(pdMS_TO_TICKS(10));  // Back off
    continue;  // Retry
}

// 3. Minimize lock scope: giữ mutex thời gian ngắn nhất
xSemaphoreTake(mutex, portMAX_DELAY);
temp = shared_data;  // Copy nhanh
xSemaphoreGive(mutex);
process(temp);  // Xử lý ngoài critical section

// 4. Single mutex: Dùng 1 mutex cho nhiều resources nếu có thể
// (trade-off: giảm concurrency nhưng không deadlock)
```

---

## 4.6 ISR Rules trong RTOS

```c
// QUAN TRỌNG: Trong ISR, chỉ dùng API có suffix "FromISR"

// ✗ KHÔNG dùng trong ISR:
xSemaphoreTake();     // Có thể block!
xQueueSend();         // Có thể block!
vTaskDelay();         // Block!
printf();             // Không thread-safe, chậm

// ✓ DÙNG trong ISR:
xSemaphoreGiveFromISR();
xQueueSendFromISR();
xQueueReceiveFromISR();
xTaskNotifyFromISR();
// Các API này KHÔNG bao giờ block

// Pattern chuẩn: ISR → Task
void EXTI0_IRQHandler(void) {
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;
    
    // Clear interrupt flag
    EXTI->PR |= EXTI_PR_PR0;
    
    // Notify task
    xSemaphoreGiveFromISR(event_sem, &xHigherPriorityTaskWoken);
    
    // Context switch nếu task được unblock có priority cao hơn current task
    portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
}

// Quy tắc vàng cho ISR:
// 1. NGẮN GỌN: làm ít nhất có thể
// 2. Không block
// 3. Không gọi printf, malloc
// 4. Clear interrupt flag
// 5. Dùng xxxFromISR() APIs
// 6. portYIELD_FROM_ISR() khi cần context switch
```

---


# Chương 5: Embedded Linux

## 5.1 Linux Boot Process

### Toàn bộ Boot Sequence

```
+================================================================+
|                    EMBEDDED LINUX BOOT FLOW                     |
+================================================================+

 Power On / Reset
       │
       ▼
 ┌─────────────┐
 │  ROM Code    │  SoC built-in (không thay đổi)
 │  (BL0)       │  - Chọn boot source (eMMC, SD, USB, UART)
 │              │  - Load SPL vào internal SRAM
 └──────┬───────┘
        │
        ▼
 ┌─────────────┐
 │  SPL / TPL  │  Secondary Program Loader
 │  (BL1)       │  - Initialize DRAM controller
 │              │  - Load U-Boot vào DRAM
 └──────┬───────┘
        │
        ▼
 ┌─────────────┐  Full Bootloader
 │  U-Boot     │  - Initialize peripherals (UART, eMMC, USB, network)
 │  (BL2)       │  - Load kernel image + DTB vào DRAM
 │              │  - Set kernel boot arguments (bootargs)
 │              │  - A/B partition selection
 │              │  - Check USB update request
 │              │  - Jump to kernel entry point
 └──────┬───────┘
        │  bootm / booti command
        ▼
 ┌─────────────┐
 │  Linux      │  - Self-decompression (nếu zImage)
 │  Kernel     │  - MMU, cache initialization
 │              │  - Parse Device Tree Blob (DTB)
 │              │  - Initialize core subsystems
 │              │  - Probe drivers
 │              │  - Mount root filesystem
 │              │  - Execute /sbin/init (PID 1)
 └──────┬───────┘
        │
        ▼
 ┌─────────────┐
 │  Init       │  (systemd hoặc SysVinit)
 │  System     │  - Mount filesystems
 │              │  - Start services (DLT, HMI, networking)
 │              │  - Reach multi-user target
 └──────┬───────┘
        │
        ▼
 ┌─────────────┐
 │ User Space  │  Applications chạy
 │ Applications│  HMI dashboard, dlt-daemon, etc.
 └─────────────┘
```

### U-Boot Environment Variables

```bash
# U-Boot shell (truy cập qua serial console)

# Xem biến môi trường
U-Boot> printenv

# Biến quan trọng:
bootcmd=run boot_normal          # Lệnh boot mặc định
bootargs=console=ttyS0,115200 root=/dev/mmcblk0p2 rootwait
bootdelay=3                      # Delay trước khi auto boot
ethaddr=00:11:22:33:44:55       # MAC address

# A/B Partition variables:
slot_suffix=_a                   # Current active slot (_a hoặc _b)
boot_attempts=0                  # Số lần boot thất bại
boot_success=0                   # 1 = boot thành công

# Set biến:
U-Boot> setenv bootargs "console=ttyS0,115200 root=/dev/mmcblk0p3"
U-Boot> saveenv   # Lưu vào persistent storage
```

### Device Tree Blob (DTB)

```
Device Tree: Mô tả hardware cho kernel (thay vì hard-code trong kernel)

File .dts (Device Tree Source) → dtc compiler → .dtb (Device Tree Blob)

Cấu trúc cơ bản:
```

```c
// example.dts
/dts-v1/;

/ {  /* Root node */
    compatible = "telechips,tcc8030";
    model = "Automotive Cluster Platform";
    
    #address-cells = <2>;
    #size-cells = <2>;
    
    /* CPU nodes */
    cpus {
        cpu@0 {
            compatible = "arm,cortex-a53";
            device_type = "cpu";
            reg = <0>;
            clock-frequency = <1200000000>;
        };
    };
    
    /* Memory */
    memory@80000000 {
        device_type = "memory";
        reg = <0x0 0x80000000 0x0 0x40000000>;  /* 1GB at 0x80000000 */
    };
    
    /* UART */
    uart0: serial@40011000 {
        compatible = "st,stm32-uart";
        reg = <0x0 0x40011000 0x0 0x400>;
        interrupts = <0 37 4>;
        clocks = <&rcc USART1_CLK>;
        status = "okay";
    };
    
    /* I2C bus */
    i2c0: i2c@40005400 {
        compatible = "st,stm32-i2c";
        reg = <0x0 0x40005400 0x0 0x400>;
        clock-frequency = <400000>;  /* 400 KHz (Fast mode) */
        #address-cells = <1>;
        #size-cells = <0>;
        status = "okay";
        
        /* FPDLink Deserializer */
        ds90ub948: deser@2c {
            compatible = "ti,ds90ub948-q1";
            reg = <0x2c>;
        };
        
        /* Touch controller */
        touch@48 {
            compatible = "atmel,maxtouch";
            reg = <0x48>;
            interrupt-parent = <&gpio>;
            interrupts = <7 2>;  /* GPIO7, falling edge */
        };
    };
    
    /* CAN bus */
    can0: can@40006400 {
        compatible = "st,stm32-bxcan";
        reg = <0x0 0x40006400 0x0 0x400>;
        interrupts = <0 19 4>, <0 20 4>;
        clocks = <&rcc CAN1_CLK>;
        status = "okay";
    };
};
```

### A/B Partition Scheme

```
eMMC/Flash Partition Layout:

+------------------------------------------------------------------+
|  Bootloader  |  Env  |  Kernel_A  |  Kernel_B  |  RootFS_A  |  RootFS_B  |  Data  |
|  (U-Boot)    | (Vars)|  (Image)   |  (Image)   | (System)   | (System)   | (User) |
+------------------------------------------------------------------+
     Fixed       Fixed     Slot A        Slot B       Slot A       Slot B      Shared

Update Flow:
1. System đang chạy từ Slot A (active)
2. Download new image → ghi vào Slot B (inactive)
3. Set U-Boot env: slot_suffix=_b, boot_attempts=0
4. Reboot → U-Boot boot từ Slot B
5. Nếu boot OK → set boot_success=1
6. Nếu boot FAIL 3 lần → rollback về Slot A

Rollback Logic:
```

```c
// Trong U-Boot boot script:
// boot_normal:
//   if boot_success == 0 && boot_attempts >= 3
//     switch slot (A↔B)
//     reset boot_attempts = 0
//   boot_attempts++
//   saveenv
//   boot from current slot

// Trong Linux userspace (sau khi boot thành công):
// Gọi script set boot_success:
// fw_setenv boot_success 1

// Ví dụ implementation:
void check_and_boot(void) {
    int boot_success = env_get_ulong("boot_success", 10, 0);
    int boot_attempts = env_get_ulong("boot_attempts", 10, 0);
    const char *slot = env_get("slot_suffix");
    
    if (!boot_success && boot_attempts >= 3) {
        // Rollback
        if (strcmp(slot, "_a") == 0) {
            env_set("slot_suffix", "_b");
        } else {
            env_set("slot_suffix", "_a");
        }
        env_set_ulong("boot_attempts", 0);
        env_save();
        printf("ROLLBACK to slot %s\n", env_get("slot_suffix"));
    }
    
    // Increment attempts
    env_set_ulong("boot_attempts", boot_attempts + 1);
    env_save();
    
    // Boot kernel from current slot
    boot_kernel();
}
```

---

## 5.2 Kernel Space

### Kernel Module (LKM - Loadable Kernel Module)

```c
// hello_module.c - Kernel module cơ bản

#include <linux/init.h>
#include <linux/module.h>
#include <linux/kernel.h>

MODULE_LICENSE("GPL");
MODULE_AUTHOR("Embedded Engineer");
MODULE_DESCRIPTION("Hello Kernel Module");
MODULE_VERSION("1.0");

// Module parameter (truyền khi insmod)
static int debug_level = 0;
module_param(debug_level, int, 0644);
MODULE_PARM_DESC(debug_level, "Debug verbosity level (0-3)");

// Init function - gọi khi insmod
static int __init hello_init(void) {
    printk(KERN_INFO "Hello Module: Loaded (debug=%d)\n", debug_level);
    return 0;  // 0 = success, negative = error
}

// Exit function - gọi khi rmmod
static void __exit hello_exit(void) {
    printk(KERN_INFO "Hello Module: Unloaded\n");
}

module_init(hello_init);
module_exit(hello_exit);
```

```makefile
# Makefile cho kernel module

obj-m := hello_module.o

# Nếu build ngoài kernel tree:
KDIR := /lib/modules/$(shell uname -r)/build

# Cross-compile cho embedded:
# KDIR := /path/to/kernel/source
# CROSS_COMPILE := arm-none-linux-gnueabihf-

all:
	$(MAKE) -C $(KDIR) M=$(PWD) modules

clean:
	$(MAKE) -C $(KDIR) M=$(PWD) clean

# Usage:
# $ make
# $ sudo insmod hello_module.ko debug_level=2
# $ dmesg | tail  → "Hello Module: Loaded (debug=2)"
# $ sudo rmmod hello_module
# $ dmesg | tail  → "Hello Module: Unloaded"
```

### Character Device Driver

```c
// char_driver.c - Character device driver đầy đủ

#include <linux/init.h>
#include <linux/module.h>
#include <linux/fs.h>
#include <linux/cdev.h>
#include <linux/device.h>
#include <linux/uaccess.h>

#define DEVICE_NAME "mychardev"
#define BUF_SIZE    1024

MODULE_LICENSE("GPL");

// Device data
static dev_t dev_num;          // Major/Minor number
static struct cdev my_cdev;    // Character device structure
static struct class *my_class; // Device class
static char kernel_buf[BUF_SIZE];
static int buf_len = 0;

// File operations
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
    int bytes_to_read = min((int)len, buf_len - (int)*offset);
    
    if (bytes_to_read <= 0) return 0;
    
    // Copy kernel buffer → user space
    if (copy_to_user(buf, kernel_buf + *offset, bytes_to_read)) {
        return -EFAULT;
    }
    
    *offset += bytes_to_read;
    return bytes_to_read;
}

static ssize_t dev_write(struct file *file, const char __user *buf,
                         size_t len, loff_t *offset) {
    int bytes_to_write = min((int)len, BUF_SIZE - 1);
    
    // Copy user space → kernel buffer
    if (copy_from_user(kernel_buf, buf, bytes_to_write)) {
        return -EFAULT;
    }
    
    buf_len = bytes_to_write;
    kernel_buf[buf_len] = '\0';
    printk(KERN_INFO "mychardev: received %d bytes\n", buf_len);
    
    return bytes_to_write;
}

// File operations structure
static const struct file_operations fops = {
    .owner   = THIS_MODULE,
    .open    = dev_open,
    .release = dev_release,
    .read    = dev_read,
    .write   = dev_write,
};

static int __init chardev_init(void) {
    // 1. Allocate device number dynamically
    if (alloc_chrdev_region(&dev_num, 0, 1, DEVICE_NAME) < 0) {
        printk(KERN_ERR "Failed to allocate device number\n");
        return -1;
    }
    printk(KERN_INFO "mychardev: Major=%d, Minor=%d\n",
           MAJOR(dev_num), MINOR(dev_num));

    // 2. Initialize cdev
    cdev_init(&my_cdev, &fops);
    if (cdev_add(&my_cdev, dev_num, 1) < 0) {
        unregister_chrdev_region(dev_num, 1);
        return -1;
    }

    // 3. Create device class (shows in /sys/class/)
    my_class = class_create(THIS_MODULE, DEVICE_NAME);
    if (IS_ERR(my_class)) {
        cdev_del(&my_cdev);
        unregister_chrdev_region(dev_num, 1);
        return PTR_ERR(my_class);
    }

    // 4. Create device node (auto-creates /dev/mychardev)
    if (IS_ERR(device_create(my_class, NULL, dev_num, NULL, DEVICE_NAME))) {
        class_destroy(my_class);
        cdev_del(&my_cdev);
        unregister_chrdev_region(dev_num, 1);
        return -1;
    }

    printk(KERN_INFO "mychardev: driver initialized\n");
    return 0;
}

static void __exit chardev_exit(void) {
    device_destroy(my_class, dev_num);
    class_destroy(my_class);
    cdev_del(&my_cdev);
    unregister_chrdev_region(dev_num, 1);
    printk(KERN_INFO "mychardev: driver removed\n");
}

module_init(chardev_init);
module_exit(chardev_exit);
```

```bash
# Test character device driver:
$ sudo insmod char_driver.ko
$ echo "Hello Kernel" > /dev/mychardev
$ cat /dev/mychardev   # → "Hello Kernel"
$ sudo rmmod char_driver
```

### Platform Driver Model

```c
// Platform driver: dùng cho devices mô tả trong Device Tree
// Kernel tự match driver với device dựa trên "compatible" string

#include <linux/platform_device.h>
#include <linux/of.h>
#include <linux/of_device.h>

// Device Tree matching table
static const struct of_device_id my_driver_of_match[] = {
    { .compatible = "mycompany,my-peripheral" },
    { .compatible = "mycompany,my-peripheral-v2" },
    { /* sentinel */ }
};
MODULE_DEVICE_TABLE(of, my_driver_of_match);

// Probe function: gọi khi kernel tìm thấy matching device
static int my_driver_probe(struct platform_device *pdev) {
    struct resource *res;
    void __iomem *base;
    int irq;
    
    dev_info(&pdev->dev, "Probing device\n");
    
    // 1. Get memory resource (từ Device Tree "reg" property)
    res = platform_get_resource(pdev, IORESOURCE_MEM, 0);
    base = devm_ioremap_resource(&pdev->dev, res);
    if (IS_ERR(base)) return PTR_ERR(base);
    
    // 2. Get interrupt (từ Device Tree "interrupts" property)
    irq = platform_get_irq(pdev, 0);
    if (irq < 0) return irq;
    
    // 3. Request interrupt
    devm_request_irq(&pdev->dev, irq, my_irq_handler,
                     IRQF_TRIGGER_RISING, "my-peripheral", NULL);
    
    // 4. Read DT properties
    u32 clock_freq;
    of_property_read_u32(pdev->dev.of_node, "clock-frequency", &clock_freq);
    
    // 5. Initialize hardware
    writel(0x01, base + REG_CTRL);  // Enable peripheral
    
    dev_info(&pdev->dev, "Device probed successfully\n");
    return 0;
}

static int my_driver_remove(struct platform_device *pdev) {
    dev_info(&pdev->dev, "Device removed\n");
    return 0;
}

static struct platform_driver my_platform_driver = {
    .probe  = my_driver_probe,
    .remove = my_driver_remove,
    .driver = {
        .name = "my-peripheral",
        .of_match_table = my_driver_of_match,
    },
};

module_platform_driver(my_platform_driver);

MODULE_LICENSE("GPL");
MODULE_DESCRIPTION("My Platform Driver");
```

---

## 5.3 Memory Management trong Linux

### Virtual Memory & MMU

```
Virtual Memory System:

  Process A              Physical Memory         Process B
  Virtual Addr           (RAM)                   Virtual Addr
  +-----------+          +-------------+          +-----------+
  | 0xFFFF... |          |             |          | 0xFFFF... |
  | Kernel    |──────────│ Kernel Code │──────────| Kernel    |
  | Space     |          | & Data      |          | Space     |
  +-----------+          +-------------+          +-----------+
  | 0xBFFF... |          |             |          |           |
  | Stack     |───┐      │             │     ┌───| Stack     |
  |           |   │      │             │     │   |           |
  +-----------+   │      +------+------+     │   +-----------+
  |           |   └─────→| Page | Page |←────┘   |           |
  | Heap      |          | Frame| Frame|         | Heap      |
  |           |───┐      +------+------+         |           |
  +-----------+   │      |             |         +-----------+
  | .data     |   └─────→|  Physical   |    ┌───| .data     |
  | .text     |          |  Frames     |    │   | .text     |
  +-----------+          +------+------+    │   +-----------+
  | 0x0000... |          |      |      |←───┘   | 0x0000... |
  +-----------+          +------+------+         +-----------+

  MMU (Memory Management Unit):
  - Translate Virtual Address → Physical Address
  - Page Table: mapping table (4KB pages typical)
  - TLB (Translation Lookaside Buffer): cache for page table
  - Protection: Read/Write/Execute permissions per page
  - Isolation: Process A không truy cập memory Process B
```

### kmalloc vs vmalloc

```c
// kmalloc: cấp phát bộ nhớ kernel
// - Physically contiguous (liên tục vật lý)
// - Nhanh hơn
// - Giới hạn kích thước (~128KB single allocation)
// - Dùng cho: DMA buffers, small kernel allocations

void *ptr = kmalloc(1024, GFP_KERNEL);
if (!ptr) {
    printk(KERN_ERR "kmalloc failed\n");
    return -ENOMEM;
}
// Sử dụng...
kfree(ptr);

// GFP Flags:
// GFP_KERNEL: có thể sleep (dùng trong process context)
// GFP_ATOMIC: không sleep (dùng trong ISR, spinlock)
// GFP_DMA: cấp phát vùng nhớ phù hợp cho DMA

// vmalloc: cấp phát bộ nhớ kernel lớn
// - Virtually contiguous, physically MAY NOT contiguous
// - Chậm hơn (cần setup page table)
// - Kích thước lớn hơn
// - KHÔNG dùng cho DMA
// - Dùng cho: large buffers, module loading

void *big_buf = vmalloc(1024 * 1024);  // 1MB
if (!big_buf) return -ENOMEM;
// Sử dụng...
vfree(big_buf);

// So sánh:
// +----------+-----------+----------+---------+--------+
// |          |Physically |Speed     |Max Size |DMA     |
// |          |Contiguous |          |         |        |
// +----------+-----------+----------+---------+--------+
// | kmalloc  | YES       | Fast     | ~128KB  | Yes    |
// | vmalloc  | NO        | Slower   | Large   | No     |
// | kzalloc  | YES       | Fast     | ~128KB  | Yes    |
// |          | (zero-filled)                            |
// +----------+-----------+----------+---------+--------+
```

---

## 5.4 Yocto Project

### Architecture Overview

```
Yocto Build System Architecture:

  +------------------------------------------------------------+
  |                     Yocto Project                          |
  +------------------------------------------------------------+
  |                                                             |
  |  +------------------+     +------------------+              |
  |  | Metadata Layers  |     | BitBake          |              |
  |  |                  |     | (Build Engine)   |              |
  |  | +-----------+    |     |                  |              |
  |  | | meta      |    |     | Parse recipes    |              |
  |  | | (core)    |    |     | Resolve deps     |              |
  |  | +-----------+    |     | Fetch sources    |              |
  |  | | meta-poky |    |     | Compile          |              |
  |  | | (distro)  |    |     | Package          |              |
  |  | +-----------+    |     | Create images    |              |
  |  | | meta-oe   |    |     |                  |              |
  |  | | (extras)  |    |     +------------------+              |
  |  | +-----------+    |              │                        |
  |  | | meta-bsp  |    |              ▼                        |
  |  | | (board)   |    |     +------------------+              |
  |  | +-----------+    |     | Output           |              |
  |  | | meta-app  |    |     | +--------------+ |              |
  |  | | (custom)  |    |     | | rootfs image | |              |
  |  | +-----------+    |     | | kernel image | |              |
  |  +------------------+     | | SDK          | |              |
  |                           | | packages     | |              |
  |  Machine Config           | +--------------+ |              |
  |  (tcc8030.conf)           +------------------+              |
  +------------------------------------------------------------+

Layer Priority (thấp → cao):
  meta → meta-poky → meta-oe → meta-bsp → meta-app
  Layer priority cao hơn override recipes từ layer thấp hơn
```

### Recipe (.bb) Structure

```bash
# myapp_1.0.bb - Yocto recipe

SUMMARY = "My Custom Application"
DESCRIPTION = "Cluster HMI application for TCC8030"
LICENSE = "MIT"
LIC_FILES_CHKSUM = "file://LICENSE;md5=xxxx"

# Source
SRC_URI = "git://github.com/myorg/myapp.git;branch=main;protocol=https"
SRCREV = "abc123def456"
S = "${WORKDIR}/git"

# Dependencies
DEPENDS = "virtual/libgl wayland weston"
RDEPENDS:${PN} = "libstdc++ libgcc"

# Inherit build class
inherit cmake

# CMake options
EXTRA_OECMAKE = "-DCMAKE_BUILD_TYPE=Release -DTARGET_SOC=TCC8030"

# Install
do_install:append() {
    install -d ${D}${bindir}
    install -m 0755 ${B}/myapp ${D}${bindir}/
    
    # Install config files
    install -d ${D}${sysconfdir}/myapp
    install -m 0644 ${S}/config/default.conf ${D}${sysconfdir}/myapp/
    
    # Install systemd service
    install -d ${D}${systemd_system_unitdir}
    install -m 0644 ${S}/myapp.service ${D}${systemd_system_unitdir}/
}

inherit systemd
SYSTEMD_SERVICE:${PN} = "myapp.service"
SYSTEMD_AUTO_ENABLE = "enable"

# Packages
FILES:${PN} += "${sysconfdir}/myapp/*"
```

### Custom Layer Creation

```bash
# Tạo custom layer
$ cd /path/to/yocto
$ bitbake-layers create-layer meta-mycluster

# Cấu trúc layer:
meta-mycluster/
├── conf/
│   └── layer.conf           # Layer configuration
├── recipes-core/
│   └── images/
│       └── cluster-image.bb  # Custom image recipe
├── recipes-app/
│   └── hmi/
│       └── hmi-app_1.0.bb   # HMI application
├── recipes-bsp/
│   └── bootloader/
│       └── u-boot_%.bbappend # U-Boot customization
├── recipes-kernel/
│   └── linux/
│       └── linux-tcc_%.bbappend  # Kernel customization
└── README

# conf/layer.conf
BBPATH .= ":${LAYERDIR}"
BBFILES += "${LAYERDIR}/recipes-*/*/*.bb \
            ${LAYERDIR}/recipes-*/*/*.bbappend"
BBFILE_COLLECTIONS += "meta-mycluster"
BBFILE_PATTERN_meta-mycluster = "^${LAYERDIR}/"
BBFILE_PRIORITY_meta-mycluster = "7"
LAYERDEPENDS_meta-mycluster = "core meta-bsp-tcc"

# Custom image recipe (cluster-image.bb)
require recipes-core/images/core-image-minimal.bb

SUMMARY = "Automotive Cluster Image"

IMAGE_INSTALL:append = " \
    hmi-app \
    dlt-daemon \
    can-utils \
    systemd \
    weston \
    wayland \
"

IMAGE_FEATURES += "ssh-server-openssh"
```

### Build Commands

```bash
# Initialize build environment
$ source oe-init-build-env build-tcc8030

# Edit local.conf
$ vi conf/local.conf
# MACHINE = "tcc8030"
# DISTRO = "poky"
# PACKAGE_CLASSES = "package_ipk"

# Add custom layer
$ bitbake-layers add-layer ../meta-mycluster

# Build image
$ bitbake cluster-image

# Build SDK
$ bitbake cluster-image -c populate_sdk

# Kết quả nằm trong:
# tmp/deploy/images/tcc8030/cluster-image-tcc8030.ext4
# tmp/deploy/sdk/poky-glibc-x86_64-cluster-image-aarch64-tcc8030-toolchain-*.sh
```

---

## 5.5 V4L2 Framework

### Video Capture Pipeline

```
V4L2 Camera Pipeline:

  Camera Sensor → MIPI CSI-2 → ISP → Memory (DMA)
      │                                    │
      ▼                                    ▼
  +--------+     +---------+     +-------------------+
  | Sensor |────→| CSI-2   |────→| Image Signal     |
  | (IMX219)|    | Receiver|    | Processor (ISP)  |
  +--------+     +---------+     +---+---+---+------+
                                     │   │   │
                                     ▼   ▼   ▼
                              +------+---+---+------+
                              | Video Buffer Queue  |
                              | (V4L2 Buffers)      |
                              +----------+----------+
                                         │
                                         ▼
                              +----------+----------+
                              | User Space App      |
                              | (Display/Process)   |
                              +---------------------+

V4L2 Buffer Types:
  MMAP:    Kernel allocates, user maps → phổ biến nhất
  USERPTR: User allocates, passes to kernel
  DMABUF:  DMA buffer sharing between devices (zero-copy)
```

### Camera Application Example

```c
#include <linux/videodev2.h>
#include <sys/ioctl.h>
#include <sys/mman.h>
#include <fcntl.h>

#define CAMERA_DEV "/dev/video0"
#define WIDTH  1920
#define HEIGHT 1080
#define NUM_BUFFERS 4

struct buffer {
    void *start;
    size_t length;
};

static struct buffer buffers[NUM_BUFFERS];

int camera_capture_init(void) {
    int fd = open(CAMERA_DEV, O_RDWR);
    if (fd < 0) return -1;

    // 1. Query capabilities
    struct v4l2_capability cap;
    ioctl(fd, VIDIOC_QUERYCAP, &cap);
    if (!(cap.capabilities & V4L2_CAP_VIDEO_CAPTURE)) {
        return -1;  // Not a capture device
    }

    // 2. Set format
    struct v4l2_format fmt = {0};
    fmt.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    fmt.fmt.pix.width = WIDTH;
    fmt.fmt.pix.height = HEIGHT;
    fmt.fmt.pix.pixelformat = V4L2_PIX_FMT_YUYV;
    fmt.fmt.pix.field = V4L2_FIELD_NONE;
    ioctl(fd, VIDIOC_S_FMT, &fmt);

    // 3. Request buffers (MMAP)
    struct v4l2_requestbuffers req = {0};
    req.count = NUM_BUFFERS;
    req.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    req.memory = V4L2_MEMORY_MMAP;
    ioctl(fd, VIDIOC_REQBUFS, &req);

    // 4. Map buffers
    for (int i = 0; i < NUM_BUFFERS; i++) {
        struct v4l2_buffer buf = {0};
        buf.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
        buf.memory = V4L2_MEMORY_MMAP;
        buf.index = i;
        ioctl(fd, VIDIOC_QUERYBUF, &buf);

        buffers[i].length = buf.length;
        buffers[i].start = mmap(NULL, buf.length,
                                PROT_READ | PROT_WRITE,
                                MAP_SHARED, fd, buf.m.offset);
    }

    // 5. Queue all buffers
    for (int i = 0; i < NUM_BUFFERS; i++) {
        struct v4l2_buffer buf = {0};
        buf.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
        buf.memory = V4L2_MEMORY_MMAP;
        buf.index = i;
        ioctl(fd, VIDIOC_QBUF, &buf);
    }

    // 6. Start streaming
    enum v4l2_buf_type type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    ioctl(fd, VIDIOC_STREAMON, &type);

    return fd;
}

// Capture loop
void camera_capture_loop(int fd) {
    while (1) {
        struct v4l2_buffer buf = {0};
        buf.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
        buf.memory = V4L2_MEMORY_MMAP;

        // Dequeue buffer (blocks until frame available)
        ioctl(fd, VIDIOC_DQBUF, &buf);

        // Process frame data
        process_frame(buffers[buf.index].start, buf.bytesused);

        // Re-queue buffer
        ioctl(fd, VIDIOC_QBUF, &buf);
    }
}
```

---

## 5.6 DLT (Diagnostic Log and Trace)

### DLT Architecture

```
DLT System Architecture trên Multi-core SoC:

+==================================================================+
|                         TCC8030                                   |
|                                                                    |
|  Cortex-A53 (Linux)                                               |
|  +----------------------------------------------------------+    |
|  |                                                            |   |
|  |  +----------+  +----------+  +----------+                 |   |
|  |  | App 1    |  | App 2    |  | App 3    |  ← DLT User    |   |
|  |  | (HMI)   |  | (Audio)  |  | (Diag)   |                 |   |
|  |  +----+-----+  +----+-----+  +----+-----+                 |   |
|  |       |             |             |                        |   |
|  |       |    DLT Library (libdlt)   |                        |   |
|  |       |             |             |                        |   |
|  |  +----+-------------+-------------+----+                   |   |
|  |  |         dlt-daemon                   |  ← Central hub  |   |
|  |  |  - Receive logs from all sources     |                  |   |
|  |  |  - Filter, buffer, forward           |                  |   |
|  |  |  - Store to file/network             |                  |   |
|  |  +--+------------------+----------------+                  |   |
|  |     |                  |                                   |   |
|  +-----|------------------|-----------  -----------------------+  |
|        |                  |                                       |
|  +-----+------+     +----+--------+                               |
|  | Log File   |     | DLT Viewer  |  (PC tool via network/USB)   |
|  | (/tmp/dlt) |     | (External)  |                               |
|  +------------+     +-------------+                               |
|                                                                    |
|  Cortex-A7 (RTOS / Bare-metal)          Cortex-R5 (Safety)       |
|  +--------------------------+           +--------------------+    |
|  |  Flightlog              |           |  Flightlog         |    |
|  |  - Lightweight logging  |           |  - Safety logs     |    |
|  |  - Ring buffer in SRAM  |           |  - Minimal overhead|    |
|  |  - No OS dependency     |           |                    |    |
|  +-----------+--------------+          +---------+----------+    |
|              |                                    |               |
|              |         SFM Channel                |               |
|              +─────────────────────────────────────+               |
|                         ↓                                          |
|              Forward to dlt-daemon (A53) via IPC/IDC               |
+====================================================================+
```

### DLT Usage trong Application

```c
// DLT Application Example

#include <dlt/dlt.h>

// Declare DLT context
DLT_DECLARE_CONTEXT(ctx_main);
DLT_DECLARE_CONTEXT(ctx_can);
DLT_DECLARE_CONTEXT(ctx_diag);

int main(void) {
    // Register application
    DLT_REGISTER_APP("CLST", "Cluster Application");
    
    // Register contexts (categories)
    DLT_REGISTER_CONTEXT(ctx_main, "MAIN", "Main context");
    DLT_REGISTER_CONTEXT(ctx_can,  "CAN",  "CAN communication");
    DLT_REGISTER_CONTEXT(ctx_diag, "DIAG", "Diagnostics");
    
    // Log messages with different levels
    DLT_LOG(ctx_main, DLT_LOG_INFO,
            DLT_STRING("System started"),
            DLT_UINT32(get_sw_version()));
    
    DLT_LOG(ctx_can, DLT_LOG_DEBUG,
            DLT_STRING("CAN message received"),
            DLT_UINT32(msg_id),
            DLT_RAW(data, dlc));
    
    DLT_LOG(ctx_diag, DLT_LOG_ERROR,
            DLT_STRING("Sensor failure"),
            DLT_INT32(error_code));
    
    // Verbose mode (human-readable)
    DLT_LOG(ctx_main, DLT_LOG_WARN,
            DLT_STRING("CPU temperature high:"),
            DLT_FLOAT32(cpu_temp),
            DLT_STRING("°C"));
    
    // Cleanup
    DLT_UNREGISTER_CONTEXT(ctx_main);
    DLT_UNREGISTER_CONTEXT(ctx_can);
    DLT_UNREGISTER_CONTEXT(ctx_diag);
    DLT_UNREGISTER_APP();
    
    return 0;
}
```

### Flightlog (Bare-metal cores)

```c
// Flightlog: lightweight logging cho R5, A7 (no OS or RTOS)
// Ghi log vào ring buffer trong shared SRAM

#define FLIGHTLOG_BUFFER_SIZE  (64 * 1024)  // 64KB ring buffer
#define FLIGHTLOG_BASE_ADDR    0x30000000   // Shared SRAM address

typedef struct __attribute__((packed)) {
    uint32_t timestamp;     // System tick
    uint16_t module_id;     // Module identifier
    uint16_t log_id;        // Log entry ID
    uint32_t param1;        // Parameter 1
    uint32_t param2;        // Parameter 2
} flightlog_entry_t;

typedef struct {
    volatile uint32_t write_index;
    volatile uint32_t read_index;
    volatile uint32_t overflow_count;
    flightlog_entry_t entries[FLIGHTLOG_BUFFER_SIZE / sizeof(flightlog_entry_t)];
} flightlog_buffer_t;

static flightlog_buffer_t *fl_buf = (flightlog_buffer_t *)FLIGHTLOG_BASE_ADDR;

void flightlog_write(uint16_t module, uint16_t log_id,
                     uint32_t param1, uint32_t param2) {
    uint32_t idx = fl_buf->write_index;
    uint32_t max_entries = sizeof(fl_buf->entries) / sizeof(flightlog_entry_t);
    
    fl_buf->entries[idx].timestamp = get_system_tick();
    fl_buf->entries[idx].module_id = module;
    fl_buf->entries[idx].log_id = log_id;
    fl_buf->entries[idx].param1 = param1;
    fl_buf->entries[idx].param2 = param2;
    
    fl_buf->write_index = (idx + 1) % max_entries;
    if (fl_buf->write_index == fl_buf->read_index) {
        fl_buf->overflow_count++;
        fl_buf->read_index = (fl_buf->read_index + 1) % max_entries;
    }
}

// Trên A53 (Linux): dlt-daemon đọc flightlog buffer qua mmap
// và forward sang DLT stream
```

---

## 5.7 IPC Mechanisms trong Linux

### So sánh các IPC mechanisms

```
+------------------+----------+----------+---------+----------------+
| Mechanism        | Speed    | Related  | Data    | Use case       |
|                  |          | Process  | Size    |                |
+------------------+----------+----------+---------+----------------+
| Shared Memory    | Fastest  | Any      | Large   | Video frames,  |
|                  |          |          |         | sensor data    |
+------------------+----------+----------+---------+----------------+
| Message Queue    | Fast     | Any      | Fixed   | Command msgs,  |
|                  |          |          | blocks  | event notif    |
+------------------+----------+----------+---------+----------------+
| Pipe/FIFO        | Medium   | Parent-  | Stream  | Data streaming |
|                  |          | Child    |         |                |
+------------------+----------+----------+---------+----------------+
| Unix Socket      | Medium   | Any      | Stream/ | Client-server  |
|                  |          |          | Dgram   | communication  |
+------------------+----------+----------+---------+----------------+
| D-Bus            | Slower   | Any      | Messages| System services|
|                  |          |          | (typed) | Desktop IPC    |
+------------------+----------+----------+---------+----------------+
| Signal           | Fast     | Any      | Minimal | Process control|
|                  |          |          | (number)| Kill, notify   |
+------------------+----------+----------+---------+----------------+
```

```c
// Shared Memory Example
#include <sys/mman.h>
#include <sys/stat.h>
#include <fcntl.h>

// Producer
int producer(void) {
    int fd = shm_open("/my_shared_mem", O_CREAT | O_RDWR, 0666);
    ftruncate(fd, 4096);
    
    void *ptr = mmap(NULL, 4096, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
    
    sprintf(ptr, "Hello from producer!");
    
    munmap(ptr, 4096);
    close(fd);
    return 0;
}

// Consumer
int consumer(void) {
    int fd = shm_open("/my_shared_mem", O_RDONLY, 0666);
    
    void *ptr = mmap(NULL, 4096, PROT_READ, MAP_SHARED, fd, 0);
    
    printf("Received: %s\n", (char *)ptr);
    
    munmap(ptr, 4096);
    close(fd);
    shm_unlink("/my_shared_mem");
    return 0;
}
```

---


# Chương 6: Multi-core Programming & Safety Monitoring

## 6.1 Asymmetric Multiprocessing (AMP) vs Symmetric Multiprocessing (SMP)

Trong các hệ thống SoC ô tô hiện đại như Telechips Dolphin+ TCC8030 hoặc NXP S32G, kiến trúc không đối xứng (AMP) hoặc kết hợp (AMP + SMP) được sử dụng để tối ưu hóa giữa hiệu năng tính toán đồ họa cao và độ an toàn thời gian thực nghiêm ngặt.

```
+-------------------------------------------------------------------------+
|                  TCC8030 Multi-Core SoC Architecture                     |
+------------------------------------+------------------------------------+
|         APPLICATION DOMAIN         |         REAL-TIME DOMAIN           |
|         (High Performance)         |       (Functional Safety)          |
|                                    |                                    |
|   +----------------------------+   |   +------------+  +------------+   |
|   |  Cortex-A53 Quad-Core      |   |   | Cortex-R5  |  | Cortex-A7  |   |
|   |  (SMP Mode - Linux OS)     |   |   | (RTOS/Bare)|  | (Safety OS)|   |
|   |  - Cluster GUI / Qt / Wayland  |   | - Vehicle  |  | - SFM /    |   |
|   |  - Media, DLT Daemon       |   |     CAN I/O    |    Watchdog   |   |
|   |  - Camera V4L2 Pipeline    |   | - Fast Boot  |  | - Power Mgmt|   |
|   +--------------+-------------+   |   +-----+------+  +-----+------+   |
|                  |                 |         |               |          |
|                  +----------+      |      +--+               |          |
|                             |      |      |                  |          |
+-----------------------------v------v------v------------------v----------+
|  INTER-CONNECT: Hardware Mailbox / Shared SRAM / Semaphore / PMU        |
+-------------------------------------------------------------------------+
```

### So sánh chi tiết AMP và SMP

| Tiêu chí | SMP (Symmetric Multiprocessing) | AMP (Asymmetric Multiprocessing) |
|---|---|---|
| **Hệ điều hành** | Một instance OS duy nhất quản lý tất cả các core (ví dụ Linux SMP trên A53) | Mỗi core chạy một OS độc lập (Core 0: Linux, Core 1: FreeRTOS, Core 2: Bare-metal) |
| **Chia sẻ bộ nhớ** | Coherent Shared Memory, bộ nhớ chung, L2/L3 cache snoop | Shared SRAM / Mailbox, không chung bộ nhớ ảo |
| **Tính xác định (Determinism)** | Thấp hơn do context switch, interrupt routing phức tạp | Rất cao (Cortex-R5 đáp ứng hard real-time tính bằng microsecond) |
| **Safety (ISO 26262)** | Khó đạt ASIL D ở cấp độ OS lớn (Linux) | Đạt ASIL B/D trên core vi điều khiển riêng biệt |
| **Boot time** | Vài giây (Kernel boot + systemd) | < 50ms (Core R5/A7 khởi động tức thì để hiện camera lùi / đèn cảnh báo telltale) |

---

## 6.2 Inter-Core Communication (IPC/IDC)

Khi các core chạy độc lập, chúng cần trao đổi dữ liệu với nhau (ví dụ: Core R5 nhận vận tốc xe từ CAN bus gửi sang Core A53 để vẽ kim đồng hồ). Kỹ thuật IPC trên SoC bao gồm:

### 1. Kiến trúc Shared Memory Ring Buffer
- Vùng nhớ **SRAM không bị cache (Non-cacheable SRAM)** được ánh xạ vào không gian địa chỉ của cả hai core.
- Dùng cấu trúc Ring Buffer với header lưu `head` và `tail`.
- Core gửi (Sender) ghi dữ liệu vào payload và tăng `head`.
- Core gửi kích hoạt **Hardware Mailbox Interrupt** (hoặc IPI - Inter-Processor Interrupt) để đánh thức Core nhận.

```c
// Shared Memory IPC Data Packet Structure
#pragma pack(push, 1)
typedef struct {
    uint16_t msg_id;       // Định danh loại dữ liệu (0x101: Speed, 0x102: Gear, 0x201: Error)
    uint16_t data_len;     // Chiều dài payload
    uint32_t sequence_num; // Số thứ tự gói tin để phát hiện mất gói
    uint32_t timestamp;    // Thời điểm gửi (ms)
    uint8_t  payload[64];  // Dữ liệu truyền
    uint16_t checksum;     // CRC16 kiểm tra lỗi đường truyền
} IpcMessage_t;

typedef struct {
    volatile uint32_t head;
    volatile uint32_t tail;
    uint32_t buffer_size;
    IpcMessage_t messages[16];
} IpcRingBuffer_t;
#pragma pack(pop)
```

### 2. Hardware Mailbox & Mutex
- Mailbox là module phần cứng cung cấp các thanh ghi FIFO và cờ ngắt giữa các core.
- Khi Core R5 ghi vào thanh ghi `MBOX_SEND`, phần cứng sẽ tự động kích hoạt đường ngắt ngắt ngoài tương ứng trên Core A53.

---

## 6.3 System Failure Monitoring (SFM) Module

Trong dự án Digital Cluster (Nippon Seiki), **SFM (System Failure Monitoring)** là module quan trọng bậc nhất chịu trách nhiệm đảm bảo **Functional Safety (FuSa)**:
- Giám sát trạng thái "sống" (Heartbeat / Alive monitoring) của tất cả các tiến trình phần mềm và các core.
- Quản lý cảnh báo lỗi và kích hoạt quy trình hạ cấp an toàn (Graceful Degradation).
- Quản lý yêu cầu System Reset khi xảy ra lỗi không thể phục hồi (Fatal Error).

```
+--------------------------------------------------------------------------+
|                      SFM Fault Handling Flow                             |
+--------------------------------------------------------------------------+
|  [IPC Heartbeat Failure / Linux Freeze / Kernel Panic / Out-Of-Memory]   |
|                                     |                                    |
|                                     v                                    |
|                     [Core A7 / R5 SFM Monitor detects]                   |
|                                     |                                    |
|            +------------------------+------------------------+           |
|            |                                                 |           |
|            v                                                 v           |
|   [Lưu mã lỗi Fatal Code]                          [Kích hoạt Failsafe GUI]
|   - Mã lỗi ghi vào SRAM retention                  - Bật đèn Telltale cứng
|   - Ghi timestamp, callstack vào PMU / EEPROM      - Hiển thị Warning Icon
|            |                                                 |           |
|            +------------------------+------------------------+           |
|                                     |                                    |
|                                     v                                    |
|                       [Kích hoạt Hardware Watchdog]                      |
|                                     |                                    |
|                                     v                                    |
|                       [Hard Reset SoC Reboot]                            |
|                                     |                                    |
|                                     v                                    |
|             [Post-Reboot Extraction: A53 đọc SRAM/EEPROM]               |
|             [Đóng gói DLT Log gửi về trung tâm phân tích]                |
+--------------------------------------------------------------------------+
```

---

## 6.4 Multi-Core Watchdog & Fault Retention (SRAM / PMU / EEPROM)

Khi nhân xử lý chính (Cortex-A53 Linux) bị treo (do kernel deadlock, driver GPU lỗi, hoặc crash):
1. **Lưu tại SRAM (Retention RAM):** 
   - Vùng SRAM đặc biệt này vẫn được duy trì điện áp khi SoC warm reset.
   - Core A7/R5 ghi ngay các thông tin chẩn đoán: PC (Program Counter), LR (Link Register), Task ID đang chạy dở dang, mã lỗi Crash Code.
2. **Lưu tại PMU (Power Management Unit) Registers:**
   - Các thanh ghi Scratchpad của PMU có nguồn pin dự phòng (Battery Backed). Thích hợp lưu lý do reset: `RESET_REASON_WDOG_TIMEOUT`, `RESET_REASON_VOLTAGE_DROP`.
3. **Lưu tại EEPROM / NOR Flash:**
   - Đối với các lỗi critical lặp lại nhiều lần, ghi lại DTC (Diagnostic Trouble Code) và Counter lỗi vào EEPROM qua giao tiếp I2C/SPI để lưu trữ vĩnh viễn ngay cả khi rút acquy xe.
4. **Post-Reboot Error Extraction:**
   - Khi hệ thống khởi động lại, dịch vụ giám sát trên Linux A53 đọc các vùng SRAM/PMU nói trên, giải mã stack trace và đẩy thành thông điệp log DLT mức `FATAL` để kỹ sư phát triển phân tích nguyên nhân gốc (Root Cause Analysis).

---

# Chương 7: Automotive Software Development Process & Standards

## 7.1 Mô hình V-Model trong Automotive

Mô hình V-Model là tiêu chuẩn phát triển phần mềm bắt buộc trong ngành công nghiệp ô tô, đảm bảo tính liên kết hai chiều (Traceability) chặt chẽ giữa yêu cầu (Requirements) và kiểm thử (Verification).

```
Customer Requirements -------------------------------------> SQT / Acceptance Test
        \                                                         ^
     SWE.1: Software Requirements Analysis ----------------> SQT (SWE.6)
              \                                                 ^
           SWE.2: Software Architectural Design ----------> SIT (SWE.5)
                    \                                           ^
                 SWE.3: Software Detailed Design --------> SUT (SWE.4)
                          \                                   ^
                           \---> Coding & Unit Implementation /
```

---

## 7.2 Tiêu chuẩn A-SPICE (Automotive SPICE)

A-SPICE (Automotive Software Process Improvement and Capability Determination) định nghĩa năng lực quy trình phần mềm. Nhóm quy trình kỹ thuật phần mềm chính gồm từ **SWE.1 đến SWE.6**:

### 1. SWE.1: Software Requirements Analysis
- Phân tích và chuyển hóa yêu cầu của khách hàng (OEM / Tier 1 như Nippon Seiki) thành tài liệu **SRS (System / Software Requirement Specification)**.
- Phân loại yêu cầu chức năng (Functional Requirements) và phi chức năng (Non-functional: boot time, frame rate, CPU load < 70%).

### 2. SWE.2: Software Architectural Design
- Thiết kế kiến trúc tổng thể phần mềm, phân chia các Subsystem, Dynamic Behavior (State diagrams, Sequence diagrams trong Enterprise Architect).
- Tạo tài liệu **SAD (Software Architecture Design)**.

### 3. SWE.3: Software Detailed Design & Unit Construction
- Thiết kế chi tiết từng hàm, struct, data dictionary, thuật toán giải thuật trong tài liệu **SDD (Software Detailed Design)**.
- Triển khai mã nguồn (Coding C/C++) tuân thủ hướng dẫn coding MISRA C.

### 4. SWE.4: Software Unit Verification (SUT)
- Kiểm thử đơn vị (Unit Test) cho từng hàm/file C.
- Đảm bảo độ bao phủ mã (Code Coverage): Statement Coverage, Branch Coverage, MC/DC (Modified Condition/Decision Coverage) bắt buộc cho ASIL D.

### 5. SWE.5: Software Integration & Integration Test (SIT)
- Tích hợp các module lại với nhau (ví dụ ghép module driver FPDLink III với tầng Display HAL và V4L2).
- Kiểm thử các giao diện trao đổi dữ liệu (Interface Testing), IPC giữa các core.

### 6. SWE.6: Software Qualification Test (SQT)
- Kiểm thử toàn diện phần mềm trên môi trường Target Hardware thật để xác nhận toàn bộ yêu cầu phần mềm trong SRS đã được thỏa mãn đầy đủ.

---

## 7.3 Tiêu chuẩn An toàn Chức năng ISO 26262 (Functional Safety - FuSa)

ISO 26262 xác định các mức độ toàn vẹn an toàn ô tô **ASIL (Automotive Safety Integrity Level)** từ **ASIL A (thấp nhất)** đến **ASIL D (cao nhất)**.

$$ASIL = Severity 	imes Exposure 	imes Controllability$$

- **Severity (S0 - S3):** Mức độ nghiêm trọng của chấn thương nếu xảy ra tai nạn.
- **Exposure (E0 - E4):** Tần suất phương tiện rơi vào tình huống nguy hiểm.
- **Controllability (C0 - C3):** Khả năng người lái xe có thể kiểm soát được tình huống để tránh tai nạn.

### Ý nghĩa trong hệ thống Digital Cluster:
- Đồng hồ báo tốc độ xe và các đèn báo an toàn (Airbag, Phanh ABS, Check Engine): **ASIL B** hoặc **ASIL D**. Nếu kim tốc độ chỉ sai (xe đang chạy 100km/h mà hiển thị 0km/h), người lái có thể mất an toàn. Do đó, logic giám sát tốc độ và đèn Telltale thường do Core R5/A7 quản lý (Safety Domain).
- Màn hình hiển thị bản đồ định vị hoặc bài hát phát qua Bluetooth: **QM (Quality Management)** hoặc ASIL A (không gây tai nạn trực tiếp nếu crash).

---

## 7.4 Tiêu chuẩn Lập trình MISRA C

MISRA C là bộ quy tắc lập trình bằng ngôn ngữ C dành riêng cho hệ thống nhúng quan trọng (Safety-critical systems) nhằm ngăn chặn các lỗi tiềm ẩn của ngôn ngữ C:
1. **Rule 11.4 / 11.5:** Không ép kiểu con trỏ tự do giữa các kiểu dữ liệu khác nhau hoặc giữa `void*` và con trỏ đối tượng mà không có kiểm soát.
2. **Rule 14.4:** Điều kiện trong câu lệnh `if` hoặc `while` phải là biểu thức boolean rõ ràng (không viết `if (ptr)` mà phải viết `if (ptr != NULL)`).
3. **Rule 15.6:** Thân của câu lệnh `if`, `else`, `for`, `while` luôn phải được bao quanh bởi dấu ngoặc nhọn `{}` ngay cả khi chỉ có một dòng lệnh.
4. **Rule 17.7:** Giá trị trả về của mọi hàm không void phải được kiểm tra hoặc ép kiểu tường minh sang `(void)`.
5. **Rule 21.3:** Tuyệt đối không dùng các hàm cấp phát bộ nhớ động chuẩn như `malloc`, `calloc`, `free` trong runtime.

---

# Chương 8: Cơ Chế Cập Nhật Phần Mềm (A/B Partition Update & Bootloader)

## 8.1 Kiến trúc Phân vùng A/B Partition Scheme

Cơ chế A/B Partition đảm bảo tính an toàn tuyệt đối khi nâng cấp phần mềm qua USB hoặc OTA (Over-The-Air). Nếu quá trình nâng cấp bị mất nguồn giữa chừng hoặc bản firmware mới bị lỗi không boot được, hệ thống tự động quay về phiên bản cũ (Rollback).

```
+-------------------------------------------------------------------------+
|                           Flash Memory Layout                           |
+-------------------+--------------------+--------------------+-----------+
| Bootloader (U-Boot)|  Slot A (Active)   |  Slot B (Updating) | User Data |
|                   |  - Kernel A        |  - Kernel B        | / Persistent
|                   |  - DTB A           |  - DTB B           | Storage   |
|                   |  - Rootfs A (ext4) |  - Rootfs B (ext4) | (Config)  |
+-------------------+--------------------+--------------------+-----------+
```

---

## 8.2 Quy trình Cập nhật & Rollback qua Biến Môi trường Bootloader

U-Boot quản lý slot boot thông qua các biến môi trường lưu trong Flash/EEPROM:
- `boot_slot`: Slot hiện tại (`a` hoặc `b`).
- `upgrade_available`: `1` nếu vừa cập nhật phiên bản mới và đang thử nghiệm boot lần đầu; `0` nếu hệ thống đã ổn định.
- `boot_count`: Số lần thử boot vào slot mới.
- `boot_limit`: Số lần tối đa cho phép thử boot (thường là 3 lần).

```
[Người dùng cắm USB có bản Update]
               |
               v
[Linux Daemon kiểm tra mã băm SHA256 & Signature xác thực]
               |
               v
[Ghi đè hình ảnh Firmware mới vào Slot đối diện (Slot B)]
               |
               v
[Cập nhật biến môi trường U-Boot]:
  - setenv boot_slot b
  - setenv upgrade_available 1
  - setenv boot_count 0
  - saveenv
               |
               v
[Reboot hệ thống]
               |
               v
+-----------------------------+
| U-Boot đọc boot_count       |
+-----------------------------+
       |
       |---> Nếu boot_count > boot_limit:
       |        => Rollback về Slot A: setenv boot_slot a; saveenv
       |
       |---> Nếu boot_count <= boot_limit:
                => Tăng boot_count: setenv boot_count $(boot_count + 1)
                => Boot vào Kernel & Rootfs của Slot B
                           |
                           v
          [Hệ thống Linux khởi động Slot B thành công]
                           |
                           v
          [Self-Test Pass & SFM kiểm tra trạng thái ổn định]
                           |
                           v
          [Chạy lệnh fw_setenv upgrade_available 0]
          [Reset boot_count về 0 => CẬP NHẬT THÀNH CÔNG!]
```

---

## 8.3 Flash Bootloader trên Vi điều khiển (STM32)

Trên MCU bare-metal không có Linux:
- Flash được chia thành 2 vùng: **Bootloader (ví dụ 0x08000000)** và **Application (0x08008000)**.
- Quá trình nhảy từ Bootloader sang Application:
  1. Đọc địa chỉ đỉnh ngăn xếp (Main Stack Pointer - MSP) tại địa chỉ `0x08008000`.
  2. Đọc địa chỉ Reset Handler của ứng dụng tại `0x08008004`.
  3. Di chuyển bảng Vector ngắt (Vector Table Offset Register - `SCB->VTOR`).
  4. Nạp lại thanh ghi MSP (`__set_MSP()`).
  5. Ép kiểu địa chỉ Reset Handler thành con trỏ hàm và thực thi.

```c
typedef void (*AppResetHandler_t)(void);

#define APP_START_ADDRESS 0x08008000UL

void Jump_To_Application(void) {
    uint32_t app_stack = *(volatile uint32_t *)APP_START_ADDRESS;
    uint32_t app_entry = *(volatile uint32_t *)(APP_START_ADDRESS + 4);

    // Kiểm tra MSP có nằm trong dải RAM hợp lệ không
    if ((app_stack & 0x2FFE0000) == 0x20000000) {
        // 1. Tắt toàn bộ ngắt phần cứng trước khi nhảy
        __disable_irq();

        // 2. Định tuyến lại bảng Vector ngắt sang vùng nhớ ứng dụng
        SCB->VTOR = APP_START_ADDRESS;

        // 3. Khởi tạo lại Stack Pointer
        __set_MSP(app_stack);

        // 4. Nhảy sang Reset Handler của ứng dụng
        AppResetHandler_t app_reset = (AppResetHandler_t)app_entry;
        app_reset();
    }
}
```

---

# Chương 9: Testing, Profiling & Debugging Chuyên Sâu

## 9.1 Các Cấp độ Kiểm thử Phần mềm Ô tô

1. **Unit Test (SUT - Software Unit Testing):**
   - Kiểm thử độc lập từng hàm.
   - Công cụ phổ biến: Google Test, CppUTest, VectorCAST, Cantata.
   - Thường sử dụng kỹ thuật Mocking để cô lập phần cứng.
2. **Integration Test (SIT - Software Integration Testing):**
   - Kiểm tra tương tác giữa các module (ví dụ driver I2C giao tiếp với cảm biến nhiệt độ hoặc FPDLink III).
   - Kiểm tra các giao diện IPC, tính đồng bộ của Semaphore, Mutex.
3. **Qualification Test (SQT - Software Qualification Testing):**
   - Kiểm tra phần mềm hoàn chỉnh trên mạch thật (Target Hardware Evaluation Board).
   - Kiểm tra chu kỳ đáp ứng, thời gian khởi động (Cold Boot < 2s).

---

## 9.2 Công cụ Phân tích Tín hiệu PicoScope & Vector CANoe

### 1. Vector CANoe trong kiểm thử mạng truyền thông
- Mô phỏng mạng CAN/CAN FD/LIN (Simulation Nodes viết bằng ngôn ngữ CAPL).
- Ghi log bản tin truyền thông (`.blf`, `.asc`).
- Kiểm tra tính tuân thủ giao thức (Conformance Test), bơm lỗi (Fault Injection: Frame Error, Bit Error) để xem ECU có tự động phục hồi hay rơi vào trạng thái Bus-Off.

### 2. PicoScope (Digital Storage Oscilloscope)
- Đo đạc trực tiếp tín hiệu vật lý tại các chân vi sai CAN_H, CAN_L để kiểm tra:
  - Hiện tượng phản xạ sóng (Signal Reflection) do thiếu trở đầu cuối $120\ \Omega$.
  - Sụt áp hoặc nhiễu điện từ (EMI) trên đường bus.
  - Đo thời gian chuyển mạch Rise Time / Fall Time của đường truyền tốc độ cao FPDLink III LVDS.

---

## 9.3 Kỹ thuật Profiling & Tối ưu Hóa Hệ Thống

Để đảm bảo cụm đồng hồ chạy mượt mà ở tốc độ 60 FPS:
1. **CPU Load Measurement:**
   - Trên Linux: Dùng công cụ `top`, `htop`, `perf`, hoặc phân tích `/proc/stat`.
   - Trên RTOS/Bare-metal: Tạo một Idle Task đếm biến counter. Tỷ lệ thời gian CPU chạy Idle Task so với tổng thời gian chính là phần trăm CPU rảnh.
2. **Memory Stack Analysis (High-Water Mark):**
   - Trong FreeRTOS: Điền giá trị `0xA5` vào toàn bộ vùng nhớ stack của task khi khởi tạo.
   - Hàm `uxTaskGetStackHighWaterMark()` sẽ quét từ đáy stack lên để đếm số byte còn giữ nguyên giá trị `0xA5`, từ đó tính toán dung lượng stack tối đa mà task từng sử dụng để cấu hình kích thước stack tối ưu, tránh tràn ngăn xếp.
3. **Task Execution Time Measurement:**
   - Dùng thanh ghi DWT (Data Watchpoint and Trace) Cycle Counter trên ARM Cortex-M:
   ```c
   // Bật bộ đếm chu kỳ CPU chính xác đến từng xung nhịp clock
   CoreDebug->DEMCR |= CoreDebug_DEMCR_TRCENA_Msk;
   DWT->CTRL |= DWT_CTRL_CYCCNTENA_Msk;

   uint32_t start_cycles = DWT->CYCCNT;
   Execute_Image_Processing_Pipeline();
   uint32_t total_cycles = DWT->CYCCNT - start_cycles;
   ```

---

# Chương 10: Quy trình và Công Cụ Kỹ Sư Phát Triển Dự Án

## 10.1 Quản lý Phiên bản Mã Nguồn với Git & SVN

### 1. Mô hình Git Flow trong Dự án Ô tô
- `master` / `main`: Chứa mã nguồn các bản phát hành chính thức (Release Tags: ví dụ `v1.0.0_SOP`).
- `develop`: Nhánh tích hợp chính cho giai đoạn phát triển hiện tại.
- `feature/<ticket_id>`: Nhánh làm việc riêng của từng kỹ sư, tách từ `develop`.
- Quy tắc commit: Gắn mã Ticket Jira vào commit message:
  ```bash
  git commit -m "[CLUSTER-1042] Fix FPDLink III I2C serializer acknowledge timeout"
  ```

### 2. Subversion (SVN)
Nhiều khách hàng Nhật Bản (như Nippon Seiki) vẫn quản lý song song tài liệu thiết kế (Word, Excel, Enterprise Architect `.eapx`) và mã nguồn bằng SVN do khả năng khóa file (Lock file) chống conflict khi sửa tài liệu nhị phân:
```bash
svn checkout https://svn.repo.internal/trunk/digital_cluster
svn lock doc/Software_Detailed_Design_FPDLink.docx
svn commit -m "Update FPDLink register configuration table"
```

---

## 10.2 Build Automation với CMake

Trong dự án nhúng lớn kết hợp Linux và RTOS, CMake giúp tự động hóa quá trình Cross-compile độc lập môi trường.

```cmake
# Toolchain File: arm-linux-toolchain.cmake
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR arm)

set(tools /opt/toolchains/aarch64-linux-gnu/bin)
set(CMAKE_C_COMPILER   ${tools}/aarch64-linux-gnu-gcc)
set(CMAKE_CXX_COMPILER ${tools}/aarch64-linux-gnu-g++)

set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
```

---

## 10.3 Thiết kế Kiến trúc với Enterprise Architect (EA)

Trong quy trình A-SPICE (SWE.2 & SWE.3), Enterprise Architect được dùng để vẽ các sơ đồ UML chuẩn hóa:
1. **Class Diagram:** Thể hiện quan hệ kế thừa, đóng gói của các đối tượng Driver / Manager.
2. **Sequence Diagram:** Mô tả thứ tự truyền thông điệp giữa các module theo trục thời gian (ví dụ: Thứ tự gửi lệnh từ `WindowManager` -> `DisplayDriver` -> `FPDLinkSerializer`).
3. **State Machine Diagram:** Đặc tả các trạng thái chuyển giao của hệ thống, điều kiện kích hoạt sự kiện và hành động đi kèm.

---

# TỔNG KẾT & LỘ TRÌNH ÔN LUYỆN DÀNH CHO PHỎNG VẤN

1. **Vững gốc C & Vi điều khiển:** Luyện tập các bài toán Bitwise, Pointer, Struct alignment, và lập trình thanh ghi không dùng thư viện có sẵn.
2. **Nắm chắc giao thức:** Phân tích cặn kẽ I2C, SPI, UART, CAN/CAN FD từ tầng vật lý xung nhịp đến tầng gói tin logic.
3. **Thấu hiểu kiến trúc Multi-core:** Khắc sâu cách hệ thống AMP phân chia công việc giữa A53 (Linux/GUI) và R5/A7 (Safety/Realtime), cơ chế giao tiếp qua Shared Memory và Mailbox.
4. **Tự tin trả lời quy trình Automotive:** Luôn gắn câu trả lời kỹ thuật với các tiêu chuẩn thực tế: A-SPICE (SWE.1 đến SWE.6), V-Model, MISRA C, và ISO 26262 Functional Safety.

*Chúc bạn hoàn thành xuất sắc các buổi phỏng vấn Embedded Software Engineer!*
