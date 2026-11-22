# Khóa Học: Embedded Linux Audio Architecture (DevLinux)
### Cẩm Nang Tổng Quan Kiến Trúc và Thực Hành Linux Audio Subsystem

> **Nguồn khóa học:** [DevLinux Academy - Embedded Linux Audio Architecture](https://devlinux.vn/khoa-hoc/embedded-linux-audio-architecture)  
> **Nền tảng phần cứng thực hành:** Raspberry Pi 4 (SoC BCM2711) + Audio Codec WM8960 (I2C/I2S)  
> **Mục tiêu:** Xây dựng thiết bị Linux Audio hoàn chỉnh từ nguyên lý âm thanh, kiến trúc ALSA / ASoC, lập trình Driver, cấu hình Device Tree, đến kiểm thử và bring-up trên phần cứng thật.

---

## 1. Giới Thiệu Khóa Học & Mục Tiêu Đào Tạo

Khóa học **Embedded Linux Audio Architecture** tại DevLinux là chương trình đào tạo chuyên sâu dành cho kỹ sư Linux Nhúng (Embedded Linux / BSP / Driver Engineer) muốn làm chủ hệ thống âm thanh trên Linux.

### Bạn sẽ học và làm chủ được gì?
1. **Nguyên lý Hệ Thống Âm Thanh Nhúng:** Hiểu rõ đường đi của sóng âm từ Microphone $\to$ Tín hiệu Analog $\to$ ADC $\to$ PCM/I2S $\to$ SoC $\to$ DAC $\to$ Ampli $\to$ Loa.
2. **Kiến trúc ALSA & ASoC (ALSA System on Chip):** Nắm vững mô hình 3 thành phần (Codec Driver, Platform/CPU Driver, Machine Driver), cơ chế DAPM (quản lý nguồn động) và Audio Routing.
3. **Kỹ thuật Lập trình Audio Driver:** Đọc hiểu Datasheet Audio Codec (WM8960), thanh ghi điều khiển, cấu hình Clock (MCLK, BCLK, LRCLK), Regmap I2C và luồng truyền nhận DMA Audio.
4. **Cấu hình Device Tree cho Audio:** Tự tay viết và chỉnh sửa Device Tree Overlay (`.dts`/`.dtbo`) để ghép nối chip âm thanh vào Linux Kernel.
5. **Kỹ năng Audio Bring-up Thực Chiến:** Sử dụng các công cụ đo kiểm (`i2cdetect`, `aplay`, `arecord`, `alsamixer`), máy hiện sóng Oscilloscope / Logic Analyzer để chẩn đoán lỗi phần cứng, xử lý tiếng rè, méo tiếng, Underrun/Overrun (XRUN).
6. **Đồ án Cuối Khóa:** Hoàn thiện một thiết bị âm thanh hoàn chỉnh Full-Duplex trên phần cứng Raspberry Pi 4.

---

## 2. Thông Tin Khóa Học & Lộ Trình 5 Chương

- **Thời lượng:** ~40 giờ học
- **Quy mô:** 5 Chương - 20 Bài học thực chiến - 15 Bài Quiz đánh giá
- **Thiết bị thực hành:** 
  - Máy tính nhúng: **Raspberry Pi 4 Model B** (hoặc board nhúng tương đương)
  - Module Audio: **WM8960 Audio Codec Board / HAT** (hỗ trợ Dual MEMS Mics, Headphone Jack 3.5mm, Speaker Header Class-D)
  - Công cụ đo kiểm: Logic Analyzer / Oscilloscope, dây cáp nối I2C & I2S

```
                                LỘ TRÌNH 5 CHƯƠNG KHÓA HỌC
                                            |
    +---------------------------------------+---------------------------------------+
    |                                       |                                       |
[CHƯƠNG 1]                              [CHƯƠNG 2]                              [CHƯƠNG 3]
Nguyên lý Hệ thống Âm thanh             Kiến trúc Linux Audio                   Lập trình Linux Audio Driver
(Bài 01 -> Bài 03)                      (Bài 04 -> Bài 07)                      (Bài 08 -> Bài 12)
- Sóng âm, Analog vs Digital            - ALSA Core & ASoC Framework            - Device Model, Binding & Probe
- PCM, Sampling, Bit Depth              - Data Pipeline, DMA Ring-Buffer        - Mổ xẻ Codec WM8960 Datasheet
- Giao diện I2S, TDM, PDM, I2C          - Codec, Platform & Machine Driver      - I2S Controller, DMA Engine & DT
    |                                       |                                       |
    +---------------------------------------+---------------------------------------+
                                            |
                    +-----------------------+-----------------------+
                    |                                               |
                [CHƯƠNG 4]                                      [CHƯƠNG 5]
        Tích hợp Phần cứng & Bring-up                   Đo kiểm, Debug & Đồ án Cuối khóa
        (Bài 13 -> Bài 18)                              (Bài 19 -> Bài 20)
        - Chuẩn bị phần cứng RPi4 + WM8960              - Debug XRUN, méo tiếng, Clock Jitter
        - Test I2C (`i2cdetect`), nạp DTBO              - Đo xung I2S bằng Logic Analyzer
        - Bring-up Sound Card & ALSA controls           - Xây dựng Linux Audio Device hoàn chỉnh
        - Test Playback, Capture & Full-Duplex
```

---

## 3. Tổng Quan Chi Tiết Từng Bài Học (Từ Bài 01 đến Bài 20)

### Chương 1. Hiểu Về Hệ Thống Âm Thanh (Understanding the Audio System)

| Bài | Tên Bài Học | Mục tiêu & Nội dung cốt lõi |
|:---:|:---|:---|
| **01** | **Inside a Modern Embedded Audio System** | - **Mục tiêu:** Hiểu kiến trúc tổng thể và vai trò của các thành phần trong một hệ thống Audio thực tế.<br>- **Nội dung:** Sơ đồ khối hệ thống Audio nhúng: Micro $\to$ Pre-Amp $\to$ ADC $\to$ DSP $\to$ SoC $\to$ DAC $\to$ Power Amp $\to$ Loa. Vai trò của từng khối và các ứng dụng thực tế (Smart Speaker, Camera giám sát có mic, IVI Ô tô). |
| **02** | **The Journey of Sound: From Microphone to Digital Audio** | - **Mục tiêu:** Hiểu quá trình thu nhận và chuyển đổi sóng âm thanh tự nhiên thành dữ liệu số.<br>- **Nội dung:** Khái niệm sóng âm, tần số (Frequency), biên độ (Amplitude). Kỹ thuật điều chế mã xung **PCM (Pulse Code Modulation)**: Quá trình Lấy mẫu (Sampling), Lượng tử hóa (Quantization) và Mã hóa (Encoding). Định lý Nyquist-Shannon, hiện tượng méo tần số (Aliasing), độ sâu bit (16/24/32-bit), tần số mẫu chuẩn (44.1kHz, 48kHz). |
| **03** | **Understanding Digital Audio Interfaces and Hardware Architecture** | - **Mục tiêu:** Hiểu cách các thành phần phần cứng giao tiếp, truyền tải và xử lý dữ liệu Audio số.<br>- **Nội dung:** Phân biệt Control Bus (I2C/SPI để cấu hình thanh ghi) và Data Bus (I2S, TDM, PDM, S/PDIF). Phân tích cấu trúc giao diện **I2S (Inter-IC Sound)**: Đường BCLK (Bit Clock), WCLK/LRCLK (Word/Left-Right Clock), SDIN (Serial Data In), SDOUT (Serial Data Out), MCLK (Master Clock). Phân biệt Master mode và Slave mode. |

---

### Chương 2. Hiểu Về Kiến Trúc Linux Audio (Understanding Linux Audio Architecture)

| Bài | Tên Bài Học | Mục tiêu & Nội dung cốt lõi |
|:---:|:---|:---|
| **04** | **How Linux Manages an Audio System** | - **Mục tiêu:** Nắm vững kiến trúc Linux Audio Subsystem và vai trò của ALSA, ASoC.<br>- **Nội dung:** Lịch sử phát triển từ OSS sang ALSA. Tầng Kernel ALSA Core, Sound Card representation, các file thiết bị trong `/dev/snd/` (`pcmC0D0p`, `pcmC0D0c`, `controlC0`). Tầng Userspace: thư viện `alsa-lib` (`libasound.so`), bộ tiện ích `alsa-utils` (`aplay`, `arecord`, `amixer`). Các Audio Server cấp cao (PulseAudio, PipeWire). |
| **05** | **Exploring the Linux Audio Pipeline** | - **Mục tiêu:** Hiểu cách dữ liệu Audio được quản lý và vận chuyển trong Linux Kernel.<br>- **Nội dung:** Cơ chế bộ đệm vòng **PCM Ring Buffer**: Buffer size, Period size, Periods per buffer. Cơ chế DMA chuyển dữ liệu tự động giữa RAM và bộ nhớ đệm phần cứng (FIFO). Xử lý ngắt định kỳ và giải thích bản chất lỗi **XRUN (Buffer Underrun và Buffer Overrun)**. |
| **06** | **Inside the Linux Audio Driver Architecture** | - **Mục tiêu:** Hiểu cách các thành phần Driver phối hợp trong kiến trúc ASoC (ALSA System on Chip).<br>- **Nội dung:** Hạn chế của ALSA truyền thống trên thiết bị nhúng và lý do ASoC ra đời. Phân tách 3 thành phần độc lập trong ASoC: **Codec Driver** (chip âm thanh độc lập), **Platform Driver** (Audio DMA & I2S controller trong SoC), **Machine Driver** (Chất kết dính cấu hình board thực tế). Khái niệm DAI (Digital Audio Interface) và DAI Link (`snd_soc_dai_link`). |
| **07** | **Connecting Hardware Components into a Linux Audio System** | - **Mục tiêu:** Hiểu cách xây dựng một hệ thống Audio hoàn chỉnh từ các thành phần phần cứng và phần mềm.<br>- **Nội dung:** Cơ chế quản lý nguồn thông minh **DAPM (Dynamic Audio Power Management)**: Tự động kích hoạt hoặc tắt nguồn các khối analog (DAC, ADC, Amp, Mixer) theo đường đi của âm thanh. Khái niệm Audio Routing, Audio Path và các Mixer Controls (Kcontrols) điều chỉnh âm lượng. |

---

### Chương 3. Kỹ Thuật Lập Trình Linux Audio Driver (Linux Audio Driver Engineering)

| Bài | Tên Bài Học | Mục tiêu & Nội dung cốt lõi |
|:---:|:---|:---|
| **08** | **Understanding Linux Device and Driver Integration** | - **Mục tiêu:** Hiểu cơ chế Linux nhận diện, quản lý và kết nối thiết bị với Driver.<br>- **Nội dung:** Linux Driver Model: Bus, Device, Driver. Cơ chế hoạt động của `platform_bus_type`, `platform_device`, `platform_driver`. Quá trình kết nối (Matching & Binding) dựa vào `of_match_table` (Device Tree) và thực thi hàm `probe()`, `remove()`. |
| **09** | **Inside an Audio Codec: From Datasheet to Linux Driver** | - **Mục tiêu:** Đọc hiểu tài liệu kỹ thuật (Datasheet) của chip Audio Codec và phân tích Driver mã nguồn mở.<br>- **Nội dung:** Mổ xẻ chi tiết Datasheet chip **Wolfson/Cirrus WM8960**: Bản đồ thanh ghi (Register Map), cấu hình khối PLL, Clock divider, các đường vào analog, ADC/DAC, bộ khuếch đại tai nghe & loa Class-D. Phân tích cấu trúc mã nguồn `sound/soc/codecs/wm8960.c`: `snd_soc_component_driver`, `snd_soc_dai_driver`, cơ chế I2C Regmap API (`regmap_read`, `regmap_write`). |
| **10** | **Understanding the SoC Audio Interface and Controller** | - **Mục tiêu:** Hiểu kiến trúc giao tiếp Audio giữa SoC và Codec qua I2S Controller.<br>- **Nội dung:** Tìm hiểu bộ điều khiển I2S bên trong SoC BCM2711/BCM2835 trên Raspberry Pi. Cấu hình định dạng dữ liệu truyền tải (I2S standard, Left-justified, Right-justified, DSP mode), cực tính Clock, Master/Slave role. Cấu trúc `snd_soc_dai_ops` (`hw_params`, `set_fmt`, `set_sysclk`). |
| **11** | **Audio Data Transfer: From Hardware to Memory** | - **Mục tiêu:** Hiểu cơ chế vận chuyển dữ liệu Audio tốc độ cao giữa phần cứng và bộ nhớ hệ thống.<br>- **Nội dung:** Cơ chế hoạt động của DMA Engine trong Linux Audio. Cấu hình kênh DMA cho Audio Playback & Capture (`dmaengine_pcm`). Cấp phát vùng nhớ DMA nhất quán (`dma_alloc_coherent`) tránh vấn đề cache coherency. |
| **12** | **Describing an Audio System with Device Tree** | - **Mục tiêu:** Có khả năng xây dựng cấu hình phần cứng Audio và tích hợp với Linux Kernel qua Device Tree.<br>- **Nội dung:** Cú pháp Device Tree Source (DTS) và Overlay (DTBO). Khai báo I2C Node cho Codec WM8960 (địa chỉ I2C `0x1a`, clocks, nguồn cấp). Khai báo Sound Card Node (`compatible = "simple-audio-card"` hoặc custom machine driver), định nghĩa DAI links, Audio Clocks và Audio Routing trên cây thiết bị. Biên dịch sang file nhị phân `.dtbo` bằng `dtc`. |

---

### Chương 4. Tích Hợp Phần Cứng & Audio Bring-Up (Hardware Integration & Audio Bring-up)

| Bài | Tên Bài Học | Mục tiêu & Nội dung cốt lõi |
|:---:|:---|:---|
| **13** | **Preparing the Embedded Audio Platform** | - **Mục tiêu:** Chuẩn bị và thiết lập môi trường phần cứng thực hành chuẩn xác.<br>- **Nội dung:** Sơ đồ chân Raspberry Pi 4 GPIO (40 pins). Kết nối bo mạch mở rộng Audio Codec WM8960: Bus điều khiển I2C (SDA/SCL) và Bus dữ liệu I2S (BCLK, LRCLK, DIN, DOUT), cấp nguồn 3.3V/5V/GND. Cài đặt môi trường build Linux Kernel và các công cụ phát triển cần thiết. |
| **14** | **First Contact with the Audio Codec** | - **Mục tiêu:** Kiểm tra và xác nhận giao tiếp cơ sở giữa Linux Platform và Audio Codec.<br>- **Nội dung:** Sử dụng công cụ `i2cdetect -y 1` để quét địa chỉ chip Codec trên bus I2C (xác nhận thiết bị phản hồi tại địa chỉ `0x1a`). Sử dụng `i2cget` đọc thử thanh ghi nhận dạng phần cứng (Chip ID register). Phương pháp xử lý lỗi phần cứng (hàn thiếu chân, lỏng bus, thiếu điện trở pull-up). |
| **15** | **Integrating the Audio Hardware into Linux** | - **Mục tiêu:** Tích hợp phần cứng Audio và hoàn thiện kết nối Driver trong Kernel.<br>- **Nội dung:** Cấu hình Kernel Kconfig để kích hoạt driver WM8960 và I2S controller. Nạp Device Tree Overlay vào hệ thống qua cấu hình `/boot/firmware/config.txt`. Phân tích thông điệp nạp driver trong kernel log: `dmesg \| grep -iE 'sound\|wm8960\|asoc'`. |
| **16** | **Bringing Up the Linux Sound Card** | - **Mục tiêu:** Đưa Audio Hardware vào hoạt động và được Linux nhận diện hoàn chỉnh.<br>- **Nội dung:** Xác nhận Sound Card đã đăng ký thành công qua `/proc/asound/cards` và `aplay -l`, `arecord -l`. Khởi tạo cấu hình Mixer ban đầu bằng `amixer` và `alsamixer`: Mở nguồn DAC, ADC, PGA gain, Headphone Volume, Speaker Volume. Lưu cấu hình mixer vĩnh viễn bằng `alsactl store`. |
| **17** | **Bringing Up Audio Playback and Capture** | - **Mục tiêu:** Hoàn thiện và kiểm chứng chức năng phát (Playback) và thu (Capture) âm thanh trên phần cứng thật.<br>- **Nội dung:** Kiểm tra luồng Playback: Phát file WAV chuẩn qua `aplay -D hw:X,Y audio.wav`, phát tín hiệu sin mẫu bằng `speaker-test`. Kiểm tra luồng Capture: Thu âm từ 2 Micro MEMS trên bo mạch bằng `arecord -D hw:X,Y -f S16_LE -r 48000 -c 2 test.wav`. Kiểm tra chất lượng âm thanh thu được. |
| **18** | **Building a Full-Duplex Audio System** | - **Mục tiêu:** Tích hợp và vận hành đồng thời hai luồng Capture và Playback.<br>- **Nội dung:** Thách thức khi vận hành đồng thời (Full-Duplex): Chia sẻ xung nhịp BCLK và LRCLK giữa đường truyền đi và đường nhận về. Thiết lập đường dẫn Audio Loopback thời gian thực: `arecord \| aplay`. Đo lường độ trễ (Audio Latency) và tinh chỉnh buffer size để đảm bảo không bị méo tiếng hay giật cục. |

---

### Chương 5. Đo Kiểm, Debug & Đồ Án Cuối Khóa (Debugging, Measurement & Final Project)

| Bài | Tên Bài Học | Mục tiêu & Nội dung cốt lõi |
|:---:|:---|:---|
| **19** | **Debugging and Validating an Embedded Audio System** | - **Mục tiêu:** Nắm vững phương pháp phân tích, chẩn đoán và khắc phục lỗi trong hệ thống Linux Audio.<br>- **Nội dung:** Kỹ thuật debug phần mềm: Đọc thông số thời gian thực từ `/proc/asound/cardX/pcm0p/sub0/status`, `hw_params`, `sw_params`. Kích hoạt Linux Dynamic Debug (`dynamic_debug/control`). Đo kiểm tín hiệu vật lý: Dùng Logic Analyzer / Oscilloscope để bắt xung clock I2S (BCLK, LRCLK) và kiểm tra tính toán tỉ lệ xung clock chính xác. Xử lý các lỗi kinh điển: Tiếng rè (Jitter), méo tiếng (Sample Rate Mismatch), nghẽn bộ đệm (XRUN). |
| **20** | **Final Project: Building a Linux Audio Device** | - **Mục tiêu:** Hoàn thiện, kiểm thử và trình diễn một thiết bị âm thanh hoàn chỉnh trên nền Linux Nhúng.<br>- **Nội dung:** Xây dựng ứng dụng nhúng giao tiếp qua thư viện `alsa-lib` (C API) thực hiện thu âm, xử lý và phát lại thông minh. Thiết lập hệ thống tự động khởi động (Systemd service) khi bật nguồn. Tối ưu hóa thời gian khởi động, kiểm tra rò rỉ tài nguyên và đóng gói sản phẩm hoàn thiện. |

---

## 4. Tài Liệu Chi Tiết Đi Kèm trong Thư Mục `Audio/`

Để hỗ trợ học tập, tra cứu và ôn luyện phỏng vấn một cách sâu sắc nhất, thư mục [Audio](file:///d:/ITV/Audio) được phân chia thành các tài liệu chuyên đề chi tiết tương ứng với từng chương:

1. 📄 **[README.md](file:///d:/ITV/Audio/README.md):** Bản tổng quan toàn diện về khóa học, lộ trình 5 chương và 20 bài học (File này).
2. 📄 **[Chapter-1-Understanding-the-Audio-System.md](file:///d:/ITV/Audio/Chapter-1-Understanding-the-Audio-System.md):** Chi tiết Bài 01 $\to$ Bài 03 (Nguyên lý âm thanh số, PCM, Giao diện phần cứng I2S/TDM/PDM/I2C).
3. 📄 **[Chapter-2-Understanding-Linux-Audio-Architecture.md](file:///d:/ITV/Audio/Chapter-2-Understanding-Linux-Audio-Architecture.md):** Chi tiết Bài 04 $\to$ Bài 07 (Kiến trúc ALSA, ASoC 3 thành phần, PCM Ring Buffer, DMA, DAPM & Audio Routing).
4. 📄 **[Chapter-3-Linux-Audio-Driver-Engineering.md](file:///d:/ITV/Audio/Chapter-3-Linux-Audio-Driver-Engineering.md):** Chi tiết Bài 08 $\to$ Bài 12 (Device Model, mổ xẻ WM8960 Driver & Datasheet, I2S Controller, DMA Engine, Device Tree Overlay).
5. 📄 **[Chapter-4-Hardware-Integration-and-Audio-Bring-up.md](file:///d:/ITV/Audio/Chapter-4-Hardware-Integration-and-Audio-Bring-up.md):** Chi tiết Bài 13 $\to$ Bài 18 (Quy trình đấu nối phần cứng RPi4 + WM8960, i2cdetect, Bring-up Sound Card, Test Playback/Capture, Full-Duplex).
6. 📄 **[Chapter-5-Debugging-Measurement-and-Final-Project.md](file:///d:/ITV/Audio/Chapter-5-Debugging-Measurement-and-Final-Project.md):** Chi tiết Bài 19 $\to$ Bài 20 (Kỹ thuật debug XRUN, đo xung Logic Analyzer, Đồ án cuối khóa thiết bị Linux Audio hoàn chỉnh).
