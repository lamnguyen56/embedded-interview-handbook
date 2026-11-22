# Chương 3: Kỹ Thuật Lập Trình Linux Audio Driver (Linux Audio Driver Engineering)

> **Tài liệu khóa học:** DevLinux - Embedded Linux Audio Architecture  
> **Phạm vi:** Bài 08, Bài 09, Bài 10, Bài 11, Bài 12  
> **Trọng tâm:** Mô hình Thiết bị & Driver trong Linux (Bus, Device, Driver), Phân tích Datasheet chip Codec WM8960 & Mã nguồn Driver, Kiến trúc bộ điều khiển SoC I2S Controller, Truyền nhận dữ liệu qua DMA Engine (`dmaengine_pcm`), Mô tả cấu hình phần cứng âm thanh bằng Device Tree Source & Overlay (DTS/DTBO).

---

## BÀI 08: Understanding Linux Device and Driver Integration (Cơ Chế Tích Hợp Thiết Bị và Driver trong Linux)

### 8.1. Mô Hình Linux Driver Model: Bus - Device - Driver
Linux Kernel sử dụng một mô hình hướng đối tượng để quản lý toàn bộ thiết bị phần cứng, dựa trên 3 cấu trúc chính:

```
                      +-------------------+
                      |   BUS TYPE (Cầu)  | (i2c_bus_type, platform_bus_type)
                      +-------------------+
                         |             |
        +----------------+             +----------------+
        |                                               |
        v                                               v
+-------------------+                           +-------------------+
|   DEVICE (Node)   | <======= MATCHING ======> |   DRIVER (Code)   |
| (Khai báo phần    |     (Kiểm tra tên hoặc    | (Chứa mã điều     |
|  cứng từ DTS)     |      compatible string)   |  khiển, probe())  |
+-------------------+                           +-------------------+
```

1. **Bus (`struct bus_type`):** Cầu nối phần cứng hoặc ảo (I2C, SPI, PCI, USB, Platform Bus).
2. **Device (`struct device`):** Đại diện cho một linh kiện phần cứng cụ thể, mô tả các thông số như địa chỉ bus, chân ngắt IRQ, xung nhịp (thường được trích xuất tự động từ Device Tree).
3. **Driver (`struct device_driver`):** Đoạn mã chứa các hàm xử lý logic để điều khiển thiết bị (hàm khởi tạo `probe()`, hàm hủy `remove()`, hàm quản lý nguồn `suspend()`/`resume()`).

---

### 8.2. Quá Trình Kết Nối (Matching & Probing) Hoạt Động Như Thế Nào?
Khi hệ điều hành khởi động:
1. Kernel phân tích cây thiết bị (Device Tree) và tạo ra các `struct platform_device` hoặc `struct i2c_client`.
2. Khi driver được nạp vào kernel (qua `insmod` hoặc build-in), Driver tự đăng ký với Bus qua hàm như `i2c_add_driver()` hoặc `platform_driver_register()`.
3. Bus thực hiện hàm so khớp (`bus->match()`):
   - So sánh chuỗi **`compatible`** trong Device Tree với danh sách **`of_device_id`** mà Driver hỗ trợ.
4. **Kích hoạt hàm `probe()`:** Nếu khớp chuỗi, Bus sẽ lập tức gọi hàm `probe()` của Driver và truyền con trỏ thiết bị vào:
   - Cấp phát bộ nhớ nội cho Driver (`devm_kzalloc`).
   - Yêu cầu cấp phát chân GPIO, xung nhịp Clock, cấp nguồn Regulator.
   - Đăng ký cấu trúc Component / DAI với hệ thống ASoC Core (`devm_snd_soc_register_component`).

---

## BÀI 09: Inside an Audio Codec: From Datasheet to Linux Driver (Mổ Xẻ Audio Codec: Từ Datasheet đến Driver Kernel)

### 9.1. Phân Tích Datasheet Chip Codec Wolfson WM8960
WM8960 là một chip Audio Codec stereo công suất thấp cực kỳ phổ biến trong các thiết bị nhúng và IoT:

```
               SƠ ĐỒ KHỐI BÊN TRONG CHIP AUDIO CODEC WM8960
               
       +-------------------------------------------------------------+
       |                         CHIP WM8960                         |
       |                                                             |
       |  [Analog In]                                                |
       |  LINPUT1/2/3 ---> [PGA/Boost] ---> [Left ADC]  --\          |
       |  RINPUT1/2/3 ---> [PGA/Boost] ---> [Right ADC] ---\ (PCM)   |
       |                                                    v        |
       |                                              [Digital Audio | === I2S (DIN/DOUT)
       |                                               Interface]    | === I2S (BCLK/LRCLK)
       |                                                    ^        |
       |  [Analog Out]                                      | (PCM)  |
       |  HP_L / HP_R <--- [HP Mixer]  <--- [Left DAC]   ---/        |
       |  SPK_LP/LN   <--- [Class-D]   <--- [Right DAC]  --/         |
       |                                                             |
       |  [Thanh ghi điều khiển Register Map: R0 -> R55]             |
       |  Quản lý cấu hình qua giao diện I2C (Địa chỉ 0x1A)          | === I2C (SDA/SCL)
       |                                                             |
       |  [Bộ tạo xung nhịp Clock PLL & Dividers]                   | === MCLK (Xung ngoài)
       +-------------------------------------------------------------+
```

#### Các thông số phần cứng cốt lõi trong Datasheet WM8960:
- **Địa chỉ giao tiếp I2C:** Mặc định là `0x1A` (7-bit address).
- **Cấu trúc thanh ghi:** 7-bit địa chỉ thanh ghi (Address: 0 đến 55) và 9-bit giá trị dữ liệu (Data: 9-bit word).
- **Bộ tạo xung nhịp PLL nội (Phase-Locked Loop):** Có khả năng nhận xung MCLK bất kỳ (ví dụ 12 MHz, 24 MHz từ Raspberry Pi) và nhân/chia tần số để sinh ra chính xác xung nhịp âm thanh $256 \times 44.1\text{ kHz} = 11.2896\text{ MHz}$ hoặc $256 \times 48\text{ kHz} = 12.288\text{ MHz}$.

---

### 9.2. Cấu Trúc Mã Nguồn Codec Driver (`sound/soc/codecs/wm8960.c`)

Một Codec Driver ASoC chuẩn bao gồm 4 khối thành phần chính:

#### 1. Giao tiếp Thanh ghi với Regmap API:
Thay vì tự viết hàm đọc/ghi I2C thủ công, kernel cung cấp thư viện `regmap` giúp tự động quản lý cache thanh ghi:
```c
static const struct regmap_config wm8960_regmap = {
    .reg_bits = 7,         // 7 bit địa chỉ thanh ghi
    .val_bits = 9,         // 9 bit giá trị dữ liệu
    .max_register = WM8960_PLL4,
    .reg_defaults = wm8960_reg_defaults, // Giá trị mặc định khi reset
    .cache_type = REGCACHE_RBTREE,
};
```

#### 2. Định nghĩa Codec DAI (`struct snd_soc_dai_driver`):
Mô tả năng lực của cổng âm thanh số (hỗ trợ những tần số lấy mẫu nào, độ sâu bao nhiêu bit):
```c
static struct snd_soc_dai_driver wm8960_dai = {
    .name = "wm8960-hifi",
    .playback = {
        .stream_name = "Playback",
        .channels_min = 1,
        .channels_max = 2,
        .rates = WM8960_RATES,               // 8kHz đến 48kHz
        .formats = WM8960_FORMATS,           // 16-bit, 20-bit, 24-bit, 32-bit
    },
    .capture = {
        .stream_name = "Capture",
        .channels_min = 1,
        .channels_max = 2,
        .rates = WM8960_RATES,
        .formats = WM8960_FORMATS,
    },
    .ops = &wm8960_dai_ops,                  // Con trỏ tới các hàm cấu hình clock, format
};
```

#### 3. Các hàm vận hành DAI (`struct snd_soc_dai_ops`):
- `hw_params()`: Được kernel gọi khi người dùng mở thiết bị và thiết lập tần số mẫu (ví dụ 48kHz), tính toán tỉ lệ chia xung PLL.
- `set_fmt()`: Thiết lập định dạng bus I2S (I2S standard / DSP mode) và Master/Slave role.
- `set_sysclk()`: Cấu hình tần số MCLK cấp vào chip.

#### 4. Đăng ký Component Driver (`struct snd_soc_component_driver`):
Khai báo toàn bộ danh sách DAPM Widgets, DAPM Routes và Kcontrols để xuất ra hệ thống ALSA Mixer.

---

## BÀI 10: Understanding the SoC Audio Interface and Controller (Bộ Điều Khiển m Thanh trên SoC)

### 10.1. Kiến Trúc I2S Controller trên SoC BCM2711 (Raspberry Pi 4)
Khối ngoại vi I2S (còn gọi là PCM Controller) trên SoC đảm nhận việc:
- Chuyển đổi dữ liệu song song (Parallel 32-bit trong bus nội bộ CPU) thành dữ liệu nối tiếp (Serial bit-stream trên chân GPIO).
- Chứa 2 hàng đợi đệm phần cứng FIFO độc lập:
  - **TX FIFO:** Chứa các sample chuẩn bị phát ra loa.
  - **RX FIFO:** Chứa các sample vừa thu được từ micro.
- Kết nối với bộ điều khiển DMA thông qua các đường tín hiệu DREQ (DMA Request). Khi TX FIFO sắp hết dữ liệu, I2S Controller tự động kích hoạt DREQ để yêu cầu DMA chuyển thêm dữ liệu từ RAM xuống.

---

## BÀI 11: Audio Data Transfer: From Hardware to Memory (Cơ Chế Truyền Dữ Liệu m Thanh qua DMA)

```
[RAM: PCM Ring Buffer] 
          |
          | (DMA Engine đọc dữ liệu không cần CPU can thiệp)
          v
[SoC I2S TX FIFO] (Ví dụ: 64 words buffer)
          |
          | (Bộ chuyển dịch song song sang nối tiếp Serial Shift Register)
          v
[Chân GPIO DOUT] === (Từng xung BCLK đẩy 1 bit ra) ===> [Chip Codec DAC]
```

### 11.1. DMA Subsystem trong Linux Audio (`dmaengine_pcm`)
ASoC cung cấp một tầng trừu tượng hóa chuẩn là `soc-generic-dmaengine-pcm.c`:
- **Đăng ký DMA với ASoC:**
  ```c
  devm_snd_dmaengine_pcm_register(&pdev->dev, NULL, 0);
  ```
- **Bộ nhớ DMA nhất quán (Coherent DMA Memory):**
  Dữ liệu âm thanh được cấp phát qua `dma_alloc_coherent()` để đảm bảo CPU và phần cứng DMA luôn nhìn thấy cùng một giá trị dữ liệu mới nhất, không bị hiện tượng xung đột dữ liệu trên bộ nhớ đệm CPU Cache (Cache Incoherency).

---

## BÀI 12: Describing an Audio System with Device Tree (Mô Tả Hệ Thống Âm Thanh Bằng Device Tree)

Device Tree là file cấu hình mô tả toàn bộ kiến trúc phần cứng thực tế cho Linux Kernel mà không cần biên dịch lại mã nguồn C.

### 12.1. Cấu Trúc Device Tree Overlay cho WM8960 trên Raspberry Pi 4
File overlay `.dts` thực hiện 3 nhiệm vụ chính:
1. Bật bộ điều khiển I2S của SoC (`i2s_arm`).
2. Khai báo Node Codec WM8960 gắn trên bus I2C số 1 tại địa chỉ `0x1a`.
3. Khai báo Sound Card và kết nối DAI link giữa SoC và Codec.

#### Mã nguồn mẫu Device Tree Overlay (`wm8960-soundcard-overlay.dts`):
```dts
/dts-v1/;
/plugin/;

/ {
    compatible = "brcm,bcm2835", "brcm,bcm2711";

    // 1. Kích hoạt I2S Controller trên Raspberry Pi
    fragment@0 {
        target = <&i2s>;
        __overlay__ {
            status = "okay";
        };
    };

    // 2. Khai báo chip Audio Codec WM8960 trên bus I2C-1
    fragment@1 {
        target = <&i2c1>;
        __overlay__ {
            #address-cells = <1>;
            #size-cells = <0>;
            status = "okay";

            wm8960: wm8960@1a {
                compatible = "wlf,wm8960";
                reg = <0x1a>;                      // Địa chỉ I2C 0x1A
                #sound-dai-cells = <0>;
                wlf,shared-lrclk;                  // Dùng chung LRCLK cho Playback và Capture
                wlf,hp-cfg = <3 2 1>;              // Cấu hình jack tai nghe
                wlf,gpio-cfg = <1 3>;              // Cấu hình GPIO Codec
                status = "okay";
            };
        };
    };

    // 3. Khai báo Simple Audio Card kết nối SoC I2S và Codec WM8960
    fragment@2 {
        target-path = "/";
        __overlay__ {
            sound {
                compatible = "simple-audio-card";
                simple-audio-card,name = "wm8960-soundcard";
                simple-audio-card,format = "i2s";
                
                // Codec đóng vai trò Master sinh xung nhịp (CBM_CFM)
                simple-audio-card,bitclock-master = <&sound_codec>;
                simple-audio-card,frame-master = <&sound_codec>;

                // Đường dẫn âm thanh Audio Routing
                simple-audio-card,routing =
                    "Headphone Playback", "HP_L",
                    "Headphone Playback", "HP_R",
                    "Speaker Playback", "SPK_LP",
                    "Speaker Playback", "SPK_LN",
                    "LINPUT1", "Mic Bias",
                    "MICB", "Onboard Mic";

                // Đầu CPU DAI
                sound_cpu: simple-audio-card,cpu {
                    sound-dai = <&i2s>;
                };

                // Đầu Codec DAI
                sound_codec: simple-audio-card,codec {
                    sound-dai = <&wm8960>;
                    clocks = <&wm8960_mclk>;
                    clock-names = "mclk";
                };
            };
        };
    };
};
```

### 12.2. Biên Dịch và Nạp Device Tree Overlay
```bash
# 1. Biên dịch file .dts thành .dtbo bằng trình biên dịch dtc (Device Tree Compiler)
dtc -@ -I dts -O dtb -o wm8960-soundcard.dtbo wm8960-soundcard-overlay.dts

# 2. Copy file .dtbo vào thư mục overlays của bootloader
sudo cp wm8960-soundcard.dtbo /boot/overlays/

# 3. Kích hoạt overlay trong file cấu hình boot của Raspberry Pi (/boot/firmware/config.txt)
# Thêm dòng: dtoverlay=wm8960-soundcard

# 4. Khởi động lại bo mạch để nạp cấu hình mới
sudo reboot
```
