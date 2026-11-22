# Chương 2: Hiểu Về Kiến Trúc Linux Audio (Understanding Linux Audio Architecture)

> **Tài liệu khóa học:** DevLinux - Embedded Linux Audio Architecture  
> **Phạm vi:** Bài 04, Bài 05, Bài 06, Bài 07  
> **Trọng tâm:** Kiến trúc phân tầng Linux Audio, ALSA Core, Các file node `/dev/snd/`, PCM Ring Buffer, DMA Audio Pipeline, Hiện tượng XRUN, ASoC 3 thành phần (Codec, Platform, Machine), DAPM (Dynamic Audio Power Management), Audio Routing và Kcontrols.

---

## BÀI 04: How Linux Manages an Audio System (Cách Linux Quản Lý Hệ Thống Âm Thanh)

### 4.1. Kiến Trúc Phân Tầng của Linux Audio Subsystem
Để đưa âm thanh từ ứng dụng (Media Player, Game, AI Assistant) xuống phần cứng loa/tai nghe, Linux xây dựng một mô hình kiến trúc phân tầng chặt chẽ:

```
+================================================================================================+
|                                    USER SPACE (Không gian Người dùng)                           |
+================================================================================================+
|  [Ứng dụng Cấp Cao]: Spotify, YouTube, GStreamer, VLC, AI Voice Assistant, Web Browser          |
+------------------------------------------------------------------------------------------------+
|  [Audio Server / Sound Server]:                                                                |
|  - PulseAudio / PipeWire (Desktop, Automotive IVI - trộn nhiều luồng âm thanh, quản lý thiết bị) |
|  - JACK Audio Connection Kit (Xử lý âm thanh chuyên nghiệp độ trễ siêu thấp - Low Latency)     |
+------------------------------------------------------------------------------------------------+
|  [ALSA Library - libasound.so & Tiện ích alsa-utils]:                                          |
|  - API chuẩn C: snd_pcm_open(), snd_pcm_writei(), snd_pcm_readi()                              |
|  - Lệnh CLI: aplay (phát), arecord (thu), amixer / alsamixer (chỉnh âm lượng)                  |
+================================================================================================+
|                                    SYSTEM CALL INTERFACE (ioctl, read, write, mmap)            |
+================================================================================================+
|                                    KERNEL SPACE (Không gian Nhân)                              |
+================================================================================================+
|  [ALSA CORE SUBSYSTEM]:                                                                        |
|  - Quản lý cấu trúc Card, PCM, Mixer, Timer, Sequencer, Controls                               |
|  - Cung cấp các Character Device Nodes tại /dev/snd/                                           |
+------------------------------------------------------------------------------------------------+
|  [ASoC FRAMEWORK (ALSA System on Chip)]:                                                       |
|  +------------------------+  +--------------------------+  +--------------------------------+  |
|  |     MACHINE DRIVER     |  |      PLATFORM DRIVER     |  |          CODEC DRIVER          |  |
|  |  (Kết nối phần cứng,   |  |  (CPU I2S Controller &   |  |   (Điều khiển chip Codec       |  |
|  |   DAI links, Routing)  |  |   DMA Engine Subsystem)  |  |    DAC/ADC/Mixer qua I2C/SPI)  |  |
|  +------------------------+  +--------------------------+  +--------------------------------+  |
|  - DAPM (Dynamic Audio Power Management - Tự động bật/tắt nguồn các khối analog tiết kiệm pin) |
+------------------------------------------------------------------------------------------------+
|  [Hardware Drivers]: Bus Driver (i2c-bcm2835, spi-bcm2835), DMA Driver (bcm2835-dma)          |
+================================================================================================+
|                                    HARDWARE (Phần cứng thực tế)                                |
|  SoC I2S Pins <====== I2S Bus ======> Audio Codec WM8960 <====== Analog ======> Loa / Micro   |
+================================================================================================+
```

---

### 4.2. Các File Thiết Bị trong Thư Mục `/dev/snd/`
Khi Sound Card được Linux Kernel nhận diện thành công, ALSA Core sẽ tạo ra các file thiết bị dạng ký tự (Character Device Nodes) trong thư mục `/dev/snd/`:

```bash
$ ls -l /dev/snd/
crw-rw----+ 1 root audio 116,  0 Mar 10 10:00 controlC0
crw-rw----+ 1 root audio 116, 16 Mar 10 10:00 pcmC0D0p
crw-rw----+ 1 root audio 116, 24 Mar 10 10:00 pcmC0D0c
crw-rw----+ 1 root audio 116, 33 Mar 10 10:00 timer
```

**Quy tắc đặt tên của ALSA:**
- `controlC<X>`: Thiết bị điều khiển Sound Card số `<X>` (dùng cho mixer, volume, mute, audio routing).
- `pcmC<X>D<Y>p`: Thiết bị phát âm thanh (**p = Playback**) của Card `<X>`, Device `<Y>`.
- `pcmC<X>D<Y>c`: Thiết bị thu âm thanh (**c = Capture**) của Card `<X>`, Device `<Y>`.
- `timer`: Bộ định thời phần cứng dùng để đồng bộ luồng âm thanh.

---

## BÀI 05: Exploring the Linux Audio Pipeline (Khám Phá Đường Dẫn Dữ Liệu m Thanh)

### 5.1. Vòng Đệm PCM Ring Buffer và Cơ Chế DMA
Dữ liệu âm thanh phát ra không được truyền từng mẫu đơn lẻ mà được gom thành từng khối và đặt vào một **Vòng đệm tròn (Ring Buffer)** trên RAM.

```
       +---------------------------------------------------------------+
       |                   PCM RING BUFFER TRÊN RAM                    |
       +---------------------------------------------------------------+
       |   Period 0   |   Period 1   |   Period 2   |   Period 3   |
       +--------------+--------------+--------------+--------------+
              ^                                            ^
              |                                            |
      [Con trỏ DMA đọc]                            [Ứng dụng User ghi]
      (Hardware Pointer - hw_ptr)                  (Application Pointer - appl_ptr)
```

#### Ba thông số cốt lõi của ALSA Ring Buffer:
1. **Frame:** Đơn vị đo kích thước mẫu âm thanh đa kênh tại một thời điểm:
   $$\text{1 Frame} = \text{Kích thước 1 Sample} \times \text{Số Kênh}$$
   - Ví dụ: Âm thanh 16-bit Stereo (2 kênh) $\to$ 1 Sample = 2 bytes $\to 1\text{ Frame} = 2 \times 2 = 4\text{ bytes}$.
2. **Period Size (hay Fragment Size):** Số lượng Frames được truyền trước khi phần cứng DMA kích hoạt **một ngắt (Interrupt - IRQ)** báo cho CPU biết là đã phát/thu xong khối dữ liệu này.
3. **Buffer Size:** Tổng dung lượng của cả Ring Buffer (đo bằng Frames).
   $$\text{Buffer Size} = \text{Period Size} \times \text{Số lượng Periods (thường là 2 đến 4)}$$

#### Vai trò của DMA (Direct Memory Access):
- DMA Controller chạy ngầm tự động đọc từng byte từ Ring Buffer trên RAM đẩy vào thanh ghi FIFO của bộ điều khiển I2S mà **không tốn chu kỳ xử lý của CPU**.
- Khi DMA đọc hết 1 Period, nó phát một ngắt phần cứng (`snd_pcm_period_elapsed()`) để đánh thức tiến trình ứng dụng ở Userspace dậy và ghi tiếp Period tiếp theo vào RAM.

---

### 5.2. Hiện Tượng XRUN (Buffer Underrun & Buffer Overrun)
XRUN là thuật ngữ chung chỉ sự mất đồng bộ tốc độ giữa phần mềm (CPU) và phần cứng (DMA/I2S):

```
1. BUFFER UNDERRUN (Xảy ra khi PLAYBACK):
   Tốc độ DMA đọc từ RAM ra loa NHANH HƠN tốc độ CPU kịp ghi dữ liệu mới vào RAM.
   -> Ring Buffer bị cạn kiệt (Empty) dữ liệu -> Loa bị hụt âm, phát ra tiếng "click", "pop" hoặc giật cục!

2. BUFFER OVERRUN (Xảy ra khi CAPTURE):
   Tốc độ Micro ghi dữ liệu vào RAM NHANH HƠN tốc độ ứng dụng kịp đọc dữ liệu ra xử lý.
   -> Ring Buffer bị tràn (Full) -> Các mẫu âm thanh mới bị ghi đè làm mất dữ liệu, tiếng bị đứt đoạn!
```

> [!IMPORTANT]
> **Đánh đổi giữa Độ trễ (Latency) và Độ ổn định (Robustness):**  
> - Period size nhỏ (ví dụ 64 frames $\approx 1.3\text{ ms}$ ở 48kHz): Độ trễ siêu thấp (rất tốt cho game, live stream), nhưng CPU bị đánh thức ngắt liên tục $\to$ Nguy cơ cao bị **XRUN** nếu CPU bận xử lý việc khác.  
> - Period size lớn (ví dụ 1024 frames $\approx 21.3\text{ ms}$): Chống XRUN cực tốt, tiết kiệm pin, nhưng độ trễ lớn (không phù hợp cho các ứng dụng tương tác thời gian thực).

---

## BÀI 06: Inside the Linux Audio Driver Architecture (Kiến Trúc ASoC - ALSA System on Chip)

### 6.1. Tại sao ALSA Truyền Thống Cần Đến ASoC?
Trước khi có ASoC, driver card âm thanh trên Linux viết gộp chung toàn bộ phần cứng vào một file driver khổng lồ. 
Điều này tạo ra các vấn đề nghiêm trọng trên hệ thống nhúng:
- Chip Codec WM8960 có thể dùng chung trên board NXP i.MX, Raspberry Pi hoặc Rockchip, nhưng mỗi board lại có CPU I2S Controller và mạch nối dây khác nhau.
- Nếu viết theo kiểu cũ, kỹ sư phải sửa lại toàn bộ driver mỗi khi chuyển board $\to$ Không thể tái sử dụng mã nguồn.

**Giải pháp của ASoC:** Tách driver của một hệ thống âm thanh thành **3 module độc lập hoàn toàn**:

```
+----------------------------------------------------------------------------------------+
|                                  KIẾN TRÚC ASoC 3 THÀNH PHẦN                            |
+----------------------------------------------------------------------------------------+

  1. CODEC DRIVER (sound/soc/codecs/wm8960.c)
     - Độc lập 100% với vi xử lý SoC đang dùng.
     - Chịu trách nhiệm cấu hình các thanh ghi nội của chip Codec: DAC, ADC, Mixer,
       PGA, Volume, Power states thông qua giao thức I2C/SPI Regmap.

  2. PLATFORM DRIVER (sound/soc/bcm/bcm2835-i2s.c & bcm2835-dma)
     - Độc lập 100% với chip Codec đang gắn ngoài.
     - Chịu trách nhiệm điều khiển khối ngoại vi bên trong SoC: I2S Controller (CPU DAI)
       và bộ DMA Engine chuyển dữ liệu vào/ra RAM.

  3. MACHINE DRIVER (sound/soc/bcm/rpi-wm8960.c hoặc simple-audio-card)
     - "Chất kết dính" (Glue Layer) gắn kết Platform Driver và Codec Driver lại với nhau.
     - Định nghĩa đường truyền DAI Link: Codec nào nối với I2S controller nào.
     - Xác định ai là Master, ai là Slave, cấu hình xung nhịp Clock, Audio Routing trên board.
```

---

### 6.2. Cấu Trúc Khối Giao Tiếp m Thanh Số: DAI (Digital Audio Interface)
DAI là khái niệm trừu tượng của ASoC đại diện cho cổng giao tiếp âm thanh số (I2S, PCM, TDM):
- **CPU DAI (`snd_soc_dai_driver`):** Cổng I2S ở phía SoC.
- **Codec DAI (`snd_soc_dai_driver`):** Cổng I2S ở phía chip Codec.
- **DAI Link (`struct snd_soc_dai_link`):** Cấu trúc trong Machine Driver kết nối cặp CPU DAI và Codec DAI thành một kênh truyền:

```c
static struct snd_soc_dai_link rpi_wm8960_dai[] = {
    {
        .name = "WM8960",
        .stream_name = "WM8960 HiFi",
        .cpu_dai_name = "bcm2835-i2s.0",     // Nối với Platform I2S Controller
        .codec_dai_name = "wm8960-hifi",     // Nối với Codec WM8960
        .platform_name = "bcm2835-i2s.0",    // Quản lý DMA
        .codec_name = "wm8960.1-001a",       // Địa chỉ chip Codec I2C 0x1a
        .dai_fmt = SND_SOC_DAIFMT_I2S |      // Chuẩn giao diện I2S
                   SND_SOC_DAIFMT_NB_NF |    // Normal BCLK, Normal Frame
                   SND_SOC_DAIFMT_CBM_CFM,   // Codec là Master (tạo BCLK & LRCLK)
    },
};
```

---

## BÀI 07: Connecting Hardware Components into a Linux Audio System (Ghép Nối Phần Cứng & Quản Lý Nguồn Thông Minh)

### 7.1. Cơ Chế Quản Lý Nguồn Động DAPM (Dynamic Audio Power Management)
Trong các thiết bị nhúng chạy pin (IoT, điện thoại, máy trợ thính), việc bật nguồn toàn bộ chip Codec khi chỉ dùng 1 tính năng sẽ làm hao pin rất nhanh. 

ASoC tích hợp hệ thống **DAPM** tự động thông minh:
- DAPM chia toàn bộ chip Codec thành một đồ thị các khối chức năng nhỏ gọi là **DAPM Widgets**:
  - `SND_SOC_DAPM_MIC`: Khối micro.
  - `SND_SOC_DAPM_PGA`: Khối tiền khuếch đại micro.
  - `SND_SOC_DAPM_ADC`: Khối chuyển đổi tương tự sang số.
  - `SND_SOC_DAPM_DAC`: Khối chuyển đổi số sang tương tự.
  - `SND_SOC_DAPM_HP`: Khối khuếch đại tai nghe.
  - `SND_SOC_DAPM_SPK`: Khối khuếch đại loa Class-D.
- **Cơ chế tự động cấp nguồn (Audio Path Walking):**
  - Khi ứng dụng gọi `arecord`, DAPM tự động dò tìm đường dẫn (Audio Path) từ Widget Micro $\to$ PGA $\to$ ADC. Chỉ có 3 khối này được Kernel cấp nguồn điện hoạt động!
  - Khối DAC và Speaker Amp hoàn toàn bị ngắt điện (`Power Down`) để tiết kiệm năng lượng.
  - Khi ứng dụng dừng `arecord`, DAPM lập tức tắt nguồn toàn bộ chuỗi widget trên theo một thứ tự chuẩn để tránh tạo ra tiếng bụp ("pop & click") ở đầu ra!

```
                    DAPM AUDIO ROUTING TRONG CODEC WM8960
                    
 [LINPUT1 / Micro Trái] ---> [Left Input PGA] ---> [Left ADC] ---> [I2S DIN]
                                                                        |
                                                                        v (Thu âm)
                                                                    [Linux Kernel]
                                                                        |
                                                                        v (Phát âm)
 [LOUT1 / Tai nghe Trái] <-- [Left Out Mixer] <--- [Left DAC] <--- [I2S DOUT]
```

### 7.2. Các Bộ Điều Khiển Mixer (ALSA Kcontrols)
Kcontrols là giao diện giúp người dùng điều khiển các thanh ghi âm thanh thông qua Userspace:
- Bật/tắt đường dẫn âm thanh (Audio Switch): ví dụ "Left Input Mixer Boost Switch".
- Tăng giảm âm lượng (Volume Slider): ví dụ "Headphone Playback Volume", "Capture Volume".
- Các mixer này có thể điều khiển trực tiếp bằng lệnh `amixer` hoặc giao diện trực quan `alsamixer`.
