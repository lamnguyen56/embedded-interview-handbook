# 🚗 Embedded Software Engineering - Interview Preparation & Handbook

Tài liệu ôn luyện phỏng vấn và sổ tay kiến thức chuyên sâu dành cho **Embedded Software Engineer**, đặc biệt tập trung vào lĩnh vực **Automotive Digital Cluster / Cockpit Platform** và **Multi-Core SoCs**.

---

## 📚 Nội dung chính

Repository bao gồm 2 tài liệu cốt lõi:

### 1. [Embedded_Interview_Questions.md](./Embedded_Interview_Questions.md)
* **Phần 1: Ngân hàng câu hỏi phỏng vấn lý thuyết chuyên sâu (>100 câu hỏi)**
  * C/C++ Embedded (Memory Layout, Pointer, Struct alignment, Volatile, MISRA C)
  * RTOS & Bare-metal (Scheduling, Mutex/Semaphore, Priority Inversion, ISR)
  * Communication Protocols (I2C, SPI, UART, CAN / CAN FD, LIN, FPDLink III)
  * Embedded Linux (U-Boot, Device Tree, Kernel Modules, Character Driver, Yocto, V4L2, DLT)
  * Automotive Standards (V-Model, A-SPICE SWE.1→SWE.6, ISO 26262 ASIL A-D, AUTOSAR)
  * Hardware & Debugging (Multi-core A53/A7/R5, GDB, GHS Probe, Vector CANoe, PicoScope)
  * Software Engineering (Git, CMake, Unit Testing SUT/SIT/SQT)
* **Phần 2: 20 Bài Live Coding kinh điển trong Embedded C**
  * Ring Buffer, Memory Pool Allocator, Bit manipulation, FSM, State Machine, Watchdog supervisor, Debounce, CRC-16, UART/I2C bit-banging, Cooperative Scheduler,... Đầy đủ code C chuẩn, giải thuật và độ phức tạp.

### 2. [Embedded_Handbook.md](./Embedded_Handbook.md)
* **Sổ tay kiến thức toàn diện 10 chương:**
  * **Chương 1:** Ngôn ngữ C cho Embedded Systems & MISRA C
  * **Chương 2:** Kiến trúc Vi điều khiển & Multi-core SoC (TCC8030 Dolphin+)
  * **Chương 3:** Peripherals & Communication Protocols (GPIO, Timer, UART, I2C, SPI, CAN/CAN FD, LIN, FPDLink III)
  * **Chương 4:** RTOS Concepts & Synchronization
  * **Chương 5:** Embedded Linux (Bootloader, Kernel Modules, Yocto, V4L2, DLT Daemon)
  * **Chương 6:** Multi-Core Programming & System Failure Monitoring (SFM, Mailbox, Shared SRAM, Retention RAM)
  * **Chương 7:** Quy trình phát triển phần mềm ô tô (V-Model, A-SPICE, ISO 26262 FuSa)
  * **Chương 8:** Cập nhật phần mềm (A/B Partition scheme, U-Boot rollback logic, STM32 Bootloader)
  * **Chương 9:** Testing, Profiling & Debugging (Vector CANoe, PicoScope, Memory Stack High-Water Mark)
  * **Chương 10:** Công cụ kỹ sư (Git, SVN, CMake, Jira, Enterprise Architect UML)

---

## 🛠️ Công nghệ & Nền tảng
- **SoC/MCU:** Telechips Dolphin+ TCC8030 (A53 + A7 + R5), STM32F4, Raspberry Pi
- **OS:** Embedded Linux, FreeRTOS, Bare-metal
- **Protocols:** CAN / CAN FD, LIN, I2C, SPI, UART, FPDLink III (ds90ub947-q1 / ds90ub948-q1)
- **Standards:** A-SPICE, ISO 26262, MISRA C
- **Tools:** Vector CANoe, PicoScope, GDB, Yocto Project, CMake, Enterprise Architect

---
*Biên soạn bởi Nguyễn Thừa Lâm - Embedded Software Engineer*
