# Chương 4: Tích Hợp Phần Cứng & Audio Bring-Up (Hardware Integration & Audio Bring-up)

> **Tài liệu khóa học:** DevLinux - Embedded Linux Audio Architecture  
> **Phạm vi:** Bài 13, Bài 14, Bài 15, Bài 16, Bài 17, Bài 18  
> **Trọng tâm:** Đấu nối phần cứng Raspberry Pi 4 với WM8960 Audio Codec, Kiểm tra giao tiếp I2C (`i2cdetect`, `i2cget`), Nạp Driver & Device Tree, Xác nhận Sound Card trong Linux (`/proc/asound/`, `aplay`, `arecord`), Cấu hình Mixer (`alsamixer`, `amixer`), Kiểm thử Playback & Capture, Xây dựng hệ thống Full-Duplex thời gian thực.

---

## BÀI 13: Preparing the Embedded Audio Platform (Chuẩn Bị Nền Tảng Phần Cứng m Thanh)

### 13.1. Sơ Đồ Chân Ghép Nối Raspberry Pi 4 và Audio Codec WM8960

Để hệ thống âm thanh hoạt động, chúng ta cần kết nối chính xác 2 nhóm chân tín hiệu giữa header 40-pin của Raspberry Pi 4 và bo mạch Audio Codec WM8960:

```
+========================================================================================+
|                    BẢNG ĐẤU NỐI CHÂN TÍN HIỆU RASPBERRY PI 4 VỚI WM8960                |
+========================================================================================+
| Tên Tín Hiệu | Chân trên RPi 4 | Chức Năng Phần Cứng        | Chân trên Module WM8960 |
|:-------------|:---------------:|:---------------------------|:------------------------|
| **3.3V**     | Pin 1           | Nguồn số Digital VDD       | 3V3                     |
| **5.0V**     | Pin 2 hoặc 4    | Nguồn công suất Loa / Amp  | 5V                      |
| **GND**      | Pin 6, 9, 14... | Nối đất (Ground) dùng chung| GND                     |
| **I2C SDA**  | Pin 3 (GPIO 2)  | Đường dữ liệu điều khiển   | SDA                     |
| **I2C SCL**  | Pin 5 (GPIO 3)  | Xung nhịp điều khiển       | SCL                     |
| **I2S BCLK** | Pin 12 (GPIO 18)| Xung nhịp bit âm thanh     | BCLK                    |
| **I2S LRCLK**| Pin 35 (GPIO 19)| Xung phân kênh Trái/Phải   | LRCLK / DACLRC / ADCLRC |
| **I2S DOUT** | Pin 40 (GPIO 21)| Dữ liệu phát từ RPi ra DAC | DACDAT / SDIN           |
| **I2S DIN**  | Pin 38 (GPIO 20)| Dữ liệu thu từ ADC vào RPi | ADCDAT / SDOUT          |
+========================================================================================+
```

```
     Raspberry Pi 4 (40-Pin GPIO)                    Module WM8960 Audio Codec
   +------------------------------+                 +--------------------------+
   | (Pin 1)  3.3V Power ---------+-----------------> 3V3                      |
   | (Pin 2)  5.0V Power ---------+-----------------> 5V (Dành cho Speaker Amp)|
   | (Pin 6)  GND ----------------+-----------------> GND                      |
   | (Pin 3)  GPIO 2 (I2C1_SDA) --+-----------------> SDA (Control Register)   |
   | (Pin 5)  GPIO 3 (I2C1_SCL) --+-----------------> SCL (Control Clock)      |
   | (Pin 12) GPIO 18 (PCM_CLK) --+-----------------> BCLK (Bit Clock)         |
   | (Pin 35) GPIO 19 (PCM_FS) ---+-----------------> LRCLK (Frame Sync)       |
   | (Pin 40) GPIO 21 (PCM_DOUT) -+-----------------> DACDAT (Audio Out to Loa)|
   | (Pin 38) GPIO 20 (PCM_DIN) --+-----------------> ADCDAT (Audio In từ Mic) |
   +------------------------------+                 +--------------------------+
```

---

## BÀI 14: First Contact with the Audio Codec (Kiểm Tra Giao Tiếp Cơ Sở với Codec)

Trước khi can thiệp vào kernel driver âm thanh, bước đầu tiên của kỹ sư Bring-up là **xác nhận phần cứng có phản hồi điện trên bus điều khiển I2C**.

### 14.1. Quét Thiết Bị trên Bus I2C bằng `i2cdetect`
Cài đặt công cụ `i2c-tools` và quét bus I2C số 1 trên Raspberry Pi:

```bash
sudo apt update && sudo apt install -y i2c-tools
sudo i2cdetect -y 1
```

**Kết quả mong đợi:**
```
     0  1  2  3  4  5  6  7  8  9  a  b  c  d  e  f
00:                         -- -- -- -- -- -- -- -- 
10: -- -- -- -- -- -- -- -- -- -- 1a -- -- -- -- -- 
20: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
...
```
- Số **`1a`** xuất hiện: Chip WM8960 phản hồi tốt tại địa chỉ `0x1a`!
- Ký tự **`UU`** xuất hiện tại ô `1a`: Nghĩa là chip đã được Kernel Driver nhận diện và đang quản lý độc quyền.
- **Nếu toàn bộ hiển thị `--`:**
  - Kiểm tra xem đã bật I2C trong `raspi-config` chưa (`dtparam=i2c_arm=on`).
  - Kiểm tra dây SDA và SCL có bị đảo ngược không.
  - Kiểm tra nguồn cấp 3.3V và chân GND chung.

### 14.2. Đọc Thử Thanh Ghi Nhận Dạng (Chip ID Register)
Sử dụng `i2cget` để đọc thử thanh ghi Reset/ID của WM8960:
```bash
# Đọc thanh ghi địa chỉ 0x00 của chip tại địa chỉ 0x1a
sudo i2cget -y 1 0x1a 0x00
```

---

## BÀI 15: Integrating the Audio Hardware into Linux (Tích Hợp Phần Cứng vào Nhân Linux)

### 15.1. Nạp Device Tree Overlay và Cấu Hình Boot
1. Thêm dòng khai báo nạp overlay vào file cấu hình `/boot/firmware/config.txt` (hoặc `/boot/config.txt` trên các bản OS cũ):
```ini
# Bật bus I2C và I2S
dtparam=i2c_arm=on
dtparam=i2s=on

# Nạp Audio Overlay tương ứng
dtoverlay=wm8960-soundcard
```
2. Khởi động lại hệ thống:
```bash
sudo reboot
```

### 15.2. Kiểm Tra Log Khởi Động của Kernel (`dmesg`)
Sau khi boot, kiểm tra thông điệp driver trong dmesg:
```bash
dmesg | grep -iE 'wm8960|sound|asoc'
```
**Log chuẩn thành công:**
```
[    3.412345] wm8960 1-001a: WM8960 Audio Codec detected, revision 2
[    3.456789] asoc-simple-card sound: wm8960-hifi <-> fe203000.i2s mapping ok
[    3.460112] asoc-simple-card sound: ASoC: registered pcm #0 (WM8960 HiFi)
```

---

## BÀI 16: Bringing Up the Linux Sound Card (Đưa Sound Card Vào Hoạt Động & Cấu Hình ALSA Mixer)

### 16.1. Xác Nhận Sound Card Được ALSA Nhận Diện
Kiểm tra xem Linux đã tạo Sound Card chưa:
```bash
# Xem danh sách card âm thanh trong procfs
cat /proc/asound/cards

# Liệt kê thiết bị phát (Playback Devices)
aplay -l

# Liệt kê thiết bị thu (Capture Devices)
arecord -l
```

**Ví dụ output chuẩn:**
```
**** List of PLAYBACK Hardware Devices ****
card 0: wm8960soundcard [wm8960-soundcard], device 0: bcm2835-i2s-wm8960-hifi wm8960-hifi-0 [bcm2835-i2s-wm8960-hifi wm8960-hifi-0]
  Subdevices: 1/1
  Subdevice #0: subdevice #0
```

---

### 16.2. Cấu Hình Khởi Tạo Mixer (Bắt Buộc Phải Làm!)
> [!WARNING]
> Mặc định sau khi khởi động, chip WM8960 tắt toàn bộ đường dẫn âm thanh (DAC/ADC bị mute, âm lượng = 0, loa bị tắt nguồn) để chống tiêu hao điện năng. Nếu không cấu hình mixer, bạn sẽ **không nghe thấy gì và không thu được gì** mặc dù driver đã nhận diện thành công!

#### Lệnh cấu hình mở luồng Playback và Capture bằng `amixer`:
```bash
# 1. Bật nguồn và âm lượng cho Headphone (Tai nghe)
amixer -c 0 sset 'Headphone' 120 unmute
amixer -c 0 sset 'Playback' 240 unmute

# 2. Bật nguồn Loa ngoài (Speaker Class-D)
amixer -c 0 sset 'Speaker' 120 unmute
amixer -c 0 sset 'Speaker AC' 5
amixer -c 0 sset 'Speaker DC' 5

# 3. Kết nối DAC vào Headphone Mixer và Speaker Mixer
amixer -c 0 sset 'Left Output Mixer PCM' on
amixer -c 0 sset 'Right Output Mixer PCM' on

# 4. Cấu hình luồng Micro Capture (Thu âm từ Onboard MEMS Microphones)
amixer -c 0 sset 'Capture' 50 unmute
amixer -c 0 sset 'Left Input Mixer Boost' on
amixer -c 0 sset 'Right Input Mixer Boost' on
amixer -c 0 sset 'ADC PCM' 220 unmute

# 5. Lưu lại toàn bộ cấu hình mixer này để tự động nạp lại khi reboot
sudo alsactl store
```

Bạn cũng có thể mở giao diện đồ họa trực quan trong terminal bằng lệnh:
```bash
alsamixer -c 0
```

---

## BÀI 17: Bringing Up Audio Playback and Capture (Kiểm Chứng Phát và Thu m Thanh)

### 17.1. Kiểm Thử Phát m Thanh (Playback Verification)

#### 1. Phát file âm thanh WAV chuẩn (48kHz, 16-bit, Stereo):
```bash
aplay -D plughw:0,0 /usr/share/sounds/alsa/Front_Center.wav
```
- `-D plughw:0,0`: Sử dụng plugin ALSA chuyển đổi tự động định dạng cho Card 0, Device 0.

#### 2. Sinh âm thanh kiểm tra (Tone Sine Wave 1000 Hz):
```bash
speaker-test -D plughw:0,0 -c 2 -r 48000 -F S16_LE -t sine -f 1000
```
- Lắng nghe âm thanh "tít... tít..." rõ ràng phát ra từ tai nghe hoặc loa ngoài.

---

### 17.2. Kiểm Thử Thu m Thanh (Capture Verification)

#### 1. Thu âm 5 giây từ Micro vào file `test_mic.wav`:
```bash
arecord -D plughw:0,0 -f S16_LE -r 48000 -c 2 -d 5 test_mic.wav
```
- Giải thích tham số:
  - `-f S16_LE`: Định dạng Signed 16-bit Little Endian.
  - `-r 48000`: Tần số lấy mẫu 48000 Hz.
  - `-c 2`: 2 kênh (Stereo).
  - `-d 5`: Thu âm đúng trong thời lượng 5 giây rồi tự thoát.

#### 2. Phát lại file vừa thu để đánh giá chất lượng:
```bash
aplay -D plughw:0,0 test_mic.wav
```
Đánh giá: Tiếng nói có rõ ràng không? Có bị rè, méo hoặc bị lọt tiếng ù nền (humming noise) không?

---

## BÀI 18: Building a Full-Duplex Audio System (Xây Dựng Hệ Thống Âm Thanh Song Công Toàn Phần)

### 18.1. Thách Thức của Full-Duplex trong Giao Diện I2S
Full-Duplex là chế độ mà hệ thống **vừa thu âm vừa phát âm thanh cùng một lúc** (cần thiết cho các ứng dụng như Walkie-Talkie, đàm thoại điện thoại, hệ thống trợ lý ảo nghe giọng khi đang phát nhạc).

#### Vấn đề chia sẻ Clock:
- Hầu hết các chip Codec như WM8960 chỉ có **một cặp chân BCLK và LRCLK dùng chung** cho cả chiều DAC (Playback) và chiều ADC (Capture).
- Do đó: **Tần số lấy mẫu (Sample Rate) và Định dạng Bit của luồng Playback và Capture BẮT BUỘC PHẢI GIỐNG NHAU** (Ví dụ: Cả 2 luồng đều phải là 48kHz, 16-bit)! Nếu bên phát chạy 44.1kHz mà bên thu chạy 48kHz, xung nhịp sẽ bị xung đột và một trong hai bên sẽ bị méo tiếng trầm trọng.

### 18.2. Thiết Lập Đường Dẫn Audio Loopback Thời Gian Thực
Chạy lệnh đường ống (Pipe) nối thẳng đầu ra của `arecord` vào đầu vào của `aplay`:

```bash
arecord -D plughw:0,0 -f S16_LE -r 48000 -c 2 --buffer-size=2048 | aplay -D plughw:0,0 -f S16_LE -r 48000 -c 2 --buffer-size=2048
```
- Khi bạn nói vào Micro, âm thanh sẽ phát ra tai nghe ngay lập tức với độ trễ tối thiểu (khoảng vài chục mili-giây).
- Thử nghiệm tinh chỉnh `--buffer-size` nhỏ hơn (ví dụ 512) để giảm độ trễ, đồng thời theo dõi xem có xuất hiện lỗi `underrun!!!` trên màn hình hay không.
