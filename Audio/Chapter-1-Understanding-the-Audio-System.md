# Chương 1: Hiểu Về Hệ Thống Âm Thanh (Understanding the Audio System)

> **Tài liệu khóa học:** DevLinux - Embedded Linux Audio Architecture  
> **Phạm vi:** Bài 01, Bài 02, Bài 03  
> **Trọng tâm:** Kiến trúc phần cứng âm thanh nhúng, Chuyển đổi tín hiệu tương tự sang số (ADC/DAC, PCM), Các giao diện truyền thông âm thanh số (I2S, TDM, PDM, I2C/SPI).

---

## BÀI 01: Inside a Modern Embedded Audio System (Bên Trong Hệ Thống Âm Thanh Nhúng Hiện Đại)

### 1.1. Sơ đồ Khối Tổng Quan của Một Thiết Bị Audio Nhúng
Trong một thiết bị nhúng có tính năng âm thanh (như Loa thông minh, Hệ thống giải trí trên ô tô IVI, Camera an ninh có đàm thoại 2 chiều, Tai nghe TWS, Thiết bị hội nghị), phần cứng âm thanh bao gồm 2 đường dẫn cơ bản:
- **Đường dẫn Thu âm (Capture Path / Audio In):** Từ sóng âm môi trường $\to$ Điện áp $\to$ Dữ liệu số trong RAM.
- **Đường dẫn Phát âm (Playback Path / Audio Out):** Từ dữ liệu số trong RAM $\to$ Điện áp $\to$ Sóng âm tới tai người nghe.

```
+================================================================================================+
|                                    SƠ ĐỒ KHỐI PHẦN CỨNG AUDIO                                  |
+================================================================================================+

1. ĐƯỜNG DẪN THU ÂM (CAPTURE PATH):
  [Sóng âm thanh]
        |
        v
  [Microphone (Analog / MEMS)] 
        | (Tín hiệu điện áp siêu nhỏ ~ vài mV)
        v
  [Pre-Amplifier / PGA] (Tiền khuếch đại có thể lập trình gain)
        |
        v
  [ADC - Analog-to-Digital Converter] (Bộ chuyển đổi tương tự sang số)
        |
        +-----> [DSP - Digital Signal Processor] (Khử ồn, lọc tiếng vang AEC, Beamforming)
                     |
                     v (Chuẩn giao tiếp âm thanh số: I2S / TDM / PDM)
        +----------------------------------------+
        |  SoC (System-on-Chip: CPU & I2S Ctrl)  |
        |  - Nhận dữ liệu qua DMA                |
        |  - Linux ALSA Kernel Driver            |
        |  - Ứng dụng Userspace (Ghi âm, AI...)   |
        +----------------------------------------+

2. ĐƯỜNG DẪN PHÁT ÂM (PLAYBACK PATH):
        +----------------------------------------+
        |  SoC (CPU & I2S Controller)            |
        |  - Đọc file MP3/WAV từ RAM/Flash       |
        |  - Đẩy dữ liệu ra I2S qua DMA          |
        +----------------------------------------+
                     | (Chuẩn I2S / PCM)
                     v
  [DAC - Digital-to-Analog Converter] (Bộ chuyển đổi số sang tương tự)
        | (Tín hiệu Line-level ~ 1V RMS)
        v
  [Audio Mixer & Volume Control] (Điều chỉnh âm lượng analog/digital)
        |
        v
  [Power Amplifier - Khuếch đại công suất] (Ampli Class-D / Class-AB)
        |
        +-------------------+-------------------+
        |                                       |
        v                                       v
   [Loa ngoài (Speaker: 4Ω / 8Ω)]     [Jack Tai nghe 3.5mm (Headphone: 16Ω / 32Ω)]
```

### 1.2. Các Khối Chức Năng Cốt Lõi
1. **Microphone Transducer:** Biến đổi dao động áp suất không khí thành tín hiệu điện áp tương tự (Analog voltage).
2. **PGA (Programmable Gain Amplifier):** Bộ khuếch đại có thể lập trình được độ lợi (gain) bằng phần mềm, giúp tăng biên độ tín hiệu micro nhỏ mà không làm vỡ tiếng (clipping).
3. **Audio Codec (Coder-Decoder):** Thường là một chip tích hợp đơn lẻ (như **Wolfson WM8960**, NXP SGTL5000, Realtek ALC5651) chứa cả **ADC, DAC, PGA, Headphone Amp, Speaker Amp, Mixer, Clock PLL**.
4. **DSP (Digital Signal Processor):** Thực hiện các thuật toán xử lý âm thanh phức tạp trong thời gian thực như AEC (Acoustic Echo Cancellation - Khử tiếng vọng), NS (Noise Suppression - Khử ồn), EQ (Equalizer - Cân bằng dải tần).
5. **SoC I2S / Audio Controller:** Khối ngoại vi tích hợp sẵn trong vi xử lý trung tâm (BCM2711 trên Raspberry Pi, i.MX8 trên NXP, STM32MP1 trên ST), có nhiệm vụ đóng vai trò cầu nối giữa phần mềm Linux và chip Codec bên ngoài.

---

## BÀI 02: The Journey of Sound: From Microphone to Digital Audio (Hành Trình của Âm Thanh: Từ Microphone đến Dữ Liệu Số)

### 2.1. Bản Chất của Sóng Âm (Nature of Sound)
- Sóng âm là sóng cơ học lan truyền trong không khí dưới dạng các dao động biến thiên liên tục của áp suất khí quyển.
- Hai đặc tính quan trọng nhất:
  - **Tần số (Frequency - đo bằng Hz):** Quyết định cao độ (Pitch) của âm thanh. Con người nghe được dải tần từ **20 Hz đến 20.000 Hz (20 kHz)**. Tiếng nói con người tập trung chủ yếu ở dải **300 Hz - 3.4 kHz**.
  - **Biên độ (Amplitude - đo bằng dB/Volt):** Quyết định độ to (Loudness) của âm thanh.

---

### 2.2. Kỹ Thuật PCM (Pulse Code Modulation - Điều Chế Mã Xung)
PCM là phương pháp tiêu chuẩn để chuyển đổi tín hiệu tương tự liên tục theo thời gian sang tín hiệu số rời rạc. Quá trình gồm 3 bước:

```
[Tín hiệu Analog liên tục]
           |
           v (1. SAMPLING - Lấy mẫu theo chu kỳ Ts = 1/Fs)
[Các xung rời rạc theo thời gian]
           |
           v (2. QUANTIZATION - Lượng tử hóa biên độ theo các mức rời rạc)
[Các mức điện áp làm tròn]
           |
           v (3. ENCODING - Mã hóa nhị phân mỗi mức thành từ mã N-bit)
[Chuỗi nhị phân 0 & 1 (Dữ liệu số PCM thô)]
```

#### 1. Tần số lấy mẫu (Sampling Rate - $F_s$):
- Số lần đo biên độ điện áp trong 1 giây.
- **Định lý lấy mẫu Nyquist-Shannon:** Để tái tạo hoàn hảo một tín hiệu âm thanh có tần số cao nhất là $F_{max}$, tần số lấy mẫu tối thiểu phải gấp đôi:
  $$F_s \ge 2 \times F_{max}$$
- Tai người nghe tối đa đến 20 kHz $\to$ Cần $F_s \ge 40\text{ kHz}$. Do đó chuẩn Audio CD chọn **44.1 kHz**, chuẩn Studio và Linux Audio chuyên nghiệp chọn **48 kHz** (hoặc 96 kHz, 192 kHz).
- **Hiện tượng Aliasing (Chồng phổ / Méo tần số):** Nếu tần số tín hiệu đầu vào vượt quá tần số Nyquist ($F_s/2$), các tần số cao sẽ bị "gập" ngược lại dải tần thấp tạo ra tiếng rít và méo tiếng khó chịu. Vì vậy, trước khối ADC luôn bắt buộc phải có mạch lọc thông thấp **Anti-Aliasing Filter (LPF)**.

#### 2. Độ sâu bit (Bit Depth - Resolution):
- Số bit nhị phân dùng để mã hóa mỗi mẫu (sample).
- Quyết định dải động (Dynamic Range) và tỉ số tín hiệu trên nhiễu (SNR):
  $$\text{Dynamic Range (dB)} \approx \text{Bit Depth} \times 6.02\text{ dB}$$
  - **16-bit:** Dải động $\approx 96\text{ dB}$ (Chuẩn CD, đáp ứng 95% nhu cầu nghe thông thường).
  - **24-bit:** Dải động $\approx 144\text{ dB}$ (Chuẩn phòng thu chuyên nghiệp, giảm đáng kể nhiễu nền lượng tử hóa).
  - **32-bit (float):** Dùng trong xử lý thuật toán DSP nội bộ để tránh tràn số (overflow).

#### 3. Băng thông dữ liệu âm thanh số (Bitrate):
$$\text{Bitrate (bps)} = \text{Sampling Rate} \times \text{Bit Depth} \times \text{Số Kênh (Channels)}$$
- Ví dụ với âm thanh Stereo chuẩn CD (44.1 kHz, 16-bit, 2 kênh):
  $$\text{Bitrate} = 44100 \times 16 \times 2 = 1.411.200\text{ bps} \approx 1.411\text{ Mbps} \approx 176.4\text{ KB/s}$$

---

## BÀI 03: Understanding Digital Audio Interfaces and Hardware Architecture (Giao Diện Phần Cứng Âm Thanh Số)

Trong một hệ thống nhúng, giao tiếp giữa SoC và chip Codec luôn chia thành **2 đường bus vật lý độc lập**:
1. **Control Bus (Bus điều khiển):** Thường là **I2C** hoặc **SPI**, dùng để cấu hình các thanh ghi nội bộ của Codec (chọn nguồn ngõ vào, bật/tắt DAC/ADC, chỉnh âm lượng, cấu hình clock).
2. **Data Bus (Bus dữ liệu âm thanh tốc độ cao):** Thường là **I2S**, **TDM**, hoặc **PDM**, truyền chuỗi bit PCM liên tục theo thời gian thực.

```
       +--------------------+                         +--------------------+
       |                    | --- I2C (SDA, SCL) ---> |                    | (Cấu hình thanh ghi)
       |      SoC           |                         |    Audio Codec     |
       |  (Raspberry Pi 4)  | <== I2S (BCLK, LRCLK) = |      (WM8960)      | (Đồng bộ xung nhịp)
       |                    | <== I2S (DIN, DOUT) === |                    | (Dữ liệu âm thanh)
       +--------------------+                         +--------------------+
```

### 3.1. Giao Thức I2S (Inter-IC Sound) Chi Tiết
Được Philips (nay là NXP) chuẩn hóa chuyên dụng cho âm thanh số stereo:

```
LRCLK (Left/Right)  +-------------------+                   +-------------------+
(1 chu kỳ = 1 sample) |      Left (0)     |     Right (1)     |      Left (0)     |
                    +-------------------+-------------------+-------------------+
BCLK (Bit Clock)    |_|~|_|~|_|~|_|~|_|~|_|~|_|~|_|~|_|~|_|~|_|~|_|~|_|~|_|~|_|~|_|~|
                    
SDATA (I2S Standard)  x | MSB | ... | LSB | x | MSB | ... | LSB | x | MSB | ...
                        \_______________/     \_______________/
                         Kênh Trái (Left)      Kênh Phải (Right)
                     (Dữ liệu bắt đầu trễ 1 chu kỳ BCLK sau khi LRCLK đổi mức)
```

#### 4 đường tín hiệu chính trong chuẩn I2S:
1. **BCLK (Bit Clock / Serial Clock - SCLK):** Xung nhịp cho từng bit dữ liệu.
   $$F_{BCLK} = F_s \times \text{Bit Depth} \times \text{Channels}$$
   - Ví dụ: 48 kHz, 16-bit, 2 kênh $\to F_{BCLK} = 48000 \times 16 \times 2 = 1.536\text{ MHz}$.
   - Nếu mỗi slot là 32-bit (chứa mẫu 16-bit hoặc 24-bit): $F_{BCLK} = 48000 \times 32 \times 2 = 3.072\text{ MHz}$.
2. **LRCLK (Left/Right Clock / Word Clock - WCLK / Frame Sync):** Xác định kênh đang truyền.
   - $F_{LRCLK} = F_s$ (Tần số của LRCLK chính bằng đúng tần số lấy mẫu, ví dụ 48 kHz).
   - Quy ước I2S tiêu chuẩn: Mức thấp (`0`) = Kênh Trái (Left Channel), Mức cao (`1`) = Kênh Phải (Right Channel).
3. **SDIN (Serial Data In):** Dữ liệu âm thanh thu từ Codec gửi về SoC (Capture).
4. **SDOUT (Serial Data Out):** Dữ liệu âm thanh từ SoC phát sang Codec (Playback).
5. **MCLK (Master Clock / System Clock):** Xung nhịp hệ thống tốc độ cao cung cấp cho mạch biến đổi delta-sigma và bộ lọc nội của Codec (thường bằng $256 \times F_s$ hoặc $384 \times F_s$, ví dụ: $256 \times 48\text{ kHz} = 12.288\text{ MHz}$).

---

### 3.2. Chế Độ Master Mode vs. Slave Mode trong I2S
Xung nhịp BCLK và LRCLK bắt buộc phải do một bên tạo ra:
- **SoC Master / Codec Slave:** SoC tạo BCLK và LRCLK cấp cho Codec.
- **Codec Master / SoC Slave:** Codec tự dùng bộ dao động (Crystal/PLL) của mình để tạo BCLK và LRCLK rồi đưa ngược lại cho SoC.

> [!TIP]
> Trong các thiết kế âm thanh chất lượng cao (Hi-Fi), người ta thường chọn **Codec làm Master** (hoặc dùng thạch anh chuyên dụng tần số Audio riêng như 24.576 MHz / 22.5792 MHz) để giảm hiện tượng **Jitter (rung pha xung nhịp)**, vì xung nhịp sinh ra từ PLL đa dụng của SoC máy tính thường có độ nhiễu jitter lớn hơn.

---

### 3.3. So Sánh I2S với Các Chuẩn Khác: TDM, PDM, S/PDIF

| Chuẩn Giao Tiếp | Số Dây Dữ Liệu | Số Kênh Tối Đa | Cơ Chế Truyền | Ứng Dụng Điển Hình |
|:---|:---:|:---:|:---|:---|
| **I2S** | 1 dây Data (DIN/DOUT) | 2 kênh (Stereo) | Chia kênh theo mức logic của LRCLK | Codec Stereo, Loa, Tai nghe |
| **TDM (Time Division Multiplexing)** | 1 dây Data | 4 - 32 kênh | Chia thành nhiều khe thời gian (time slots) trong 1 frame | Mảng micro ô tô, Hệ thống loa vòm đa kênh 5.1/7.1 |
| **PDM (Pulse Density Modulation)** | 1 dây Data + 1 Clock | 2 micro / 1 cặp dây | Mã hóa 1-bit mật độ xung, tần số rất cao (~3 MHz) | Micro MEMS kỹ thuật số trong điện thoại, tai nghe |
| **S/PDIF** | 1 dây đơn (Cáp quang/Coaxial) | 2 kênh PCM / nén | Tự nhúng xung nhịp vào dòng dữ liệu số | Dàn âm thanh gia đình, TV ra Loa Soundbar |
