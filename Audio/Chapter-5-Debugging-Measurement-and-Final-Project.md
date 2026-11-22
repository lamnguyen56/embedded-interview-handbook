# Chương 5: Đo Kiểm, Debug & Đồ Án Cuối Khóa (Debugging, Measurement & Final Project)

> **Tài liệu khóa học:** DevLinux - Embedded Linux Audio Architecture  
> **Phạm vi:** Bài 19, Bài 20  
> **Trọng tâm:** Các kỹ thuật chẩn đoán lỗi phần cứng & phần mềm Linux Audio, Đo xung I2S bằng Logic Analyzer / Oscilloscope, Xử lý lỗi XRUN, méo tiếng, Clock Jitter, Đồ án cuối khóa thiết kế và triển khai thiết bị âm thanh thông minh hoàn chỉnh trên Linux Nhúng.

---

## BÀI 19: Debugging and Validating an Embedded Audio System (Chẩn Đoán và Kiểm Chuẩn Hệ Thống m Thanh Nhúng)

Khi phát triển một hệ thống âm thanh nhúng thực tế, kỹ sư thường xuyên phải đối mặt với các lỗi: **Không có âm thanh**, **Âm thanh bị giật/ngắt quãng**, **Tiếng bị méo/chua/thay đổi cao độ**, hoặc **Âm thanh có tiếng ù/rè/tiếng nổ lách tách (Popping)**.

### 19.1. Các Công Cụ Debug Phần Mềm trong Linux Kernel Audio

#### 1. Đọc Trạng Thái PCM Thời Gian Thực trong `/proc/asound/`:
Khi một ứng dụng đang phát hoặc thu âm, ALSA Core ghi nhận trạng thái hoạt động tức thời trong procfs:

```bash
# Xem thông số phần cứng đang chạy thực tế (Hardware parameters)
cat /proc/asound/card0/pcm0p/sub0/hw_params

# Kết quả mẫu:
# access: RW_INTERLEAVED
# format: S16_LE
# subformat: STD
# channels: 2
# rate: 48000 (48000/1)
# period_size: 1024
# buffer_size: 4096

# Xem con trỏ vị trí bộ đệm và lỗi XRUN
cat /proc/asound/card0/pcm0p/sub0/status

# Kết quả mẫu:
# state: RUNNING
# hw_ptr: 450560
# appl_ptr: 454656
# Nếu state hiển thị: XRUN -> Xác nhận đang bị Buffer Underrun hoặc Overrun!
```

#### 2. Kích Hoạt Linux Dynamic Debug cho ALSA / ASoC:
Nếu Kernel được biên dịch với `CONFIG_DYNAMIC_DEBUG=y`, ta có thể bật log chi tiết của từng hàm trong subsystem âm thanh mà không cần build lại kernel:
```bash
# Bật toàn bộ log debug của thư mục sound/soc/
echo "file sound/soc/* +p" | sudo tee /sys/kernel/debug/dynamic_debug/control

# Bật log riêng cho driver wm8960
echo "file wm8960.c +p" | sudo tee /sys/kernel/debug/dynamic_debug/control
```

---

### 19.2. Đo Kiểm Tín Hiệu Vật Lý Bằng Thiết Bị Đo (Oscilloscope & Logic Analyzer)

Khi phần mềm không chạy đúng, phương pháp tin cậy nhất là dùng **Logic Analyzer** (ví dụ Saleae Logic) hoặc **Máy hiện sóng (Oscilloscope)** kẹp trực tiếp vào 4 chân I2S:

```
[Chân RPi GPIO 18] ------> Kênh 0: BCLK (Bit Clock)
[Chân RPi GPIO 19] ------> Kênh 1: LRCLK (Left/Right Frame Sync)
[Chân RPi GPIO 21] ------> Kênh 2: DOUT (Dữ liệu phát ra)
[Chân RPi GPIO 20] ------> Kênh 3: DIN (Dữ liệu thu về)
```

```
               DẠNG SÓNG I2S CHUẨN TRÊN LOGIC ANALYZER
               
LRCLK (48 kHz)  ~~~~~~~~~~~~~~~~~~~~|____________________|~~~~~~~~~~~~~~~~~~~~
                <-- Kênh Trái (L) --><-- Kênh Phải (R) --><-- Kênh Trái (L) --
BCLK (1.536MHz) _|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|_|
                
DOUT            x| MSB | D14 | ... | LSB | x | MSB | D14 | ... | LSB | x | ...
```

#### Các lỗi phần cứng phát hiện được qua máy đo:
1. **Sai tần số Clock:**
   - Cấu hình 48 kHz nhưng đo LRCLK ra 44.1 kHz $\to$ Do driver tính sai tỉ lệ chia xung PLL/Divider của Codec. Âm thanh nghe sẽ bị chậm và trầm hơn bình thường.
2. **Hiện tượng Clock Jitter (Xung nhịp bị rung):**
   - Khoảng cách giữa các sườn xung BCLK không đều nhau $\to$ Do xung clock lấy từ bộ chia đa dụng của SoC không sạch. Hậu quả: Âm thanh bị rè xì (Hissing noise) ở dải tần số cao.
3. **Lệch pha (Phase Mismatch):**
   - Theo chuẩn I2S tiêu chuẩn, bit MSB của dữ liệu phải xuất hiện trễ **đúng 1 chu kỳ BCLK** sau khi LRCLK đổi mức. Nếu bit MSB xuất hiện ngay lập tức (Left-Justified mode) trong khi bên nhận đang cấu hình I2S standard $\to$ Toàn bộ dữ liệu bị dịch 1 bit, âm thanh bị vỡ tiếng và phát ra tiếng ồn trắng (White noise) đinh tai!

---

### 19.3. Bảng Tra Cứu Sự Cố và Phương Pháp Khắc Phục (Troubleshooting Matrix)

| Triệu Chứng Sự Cố | Nguyên Nhân Cốt Lõi | Cách Khắc Phục Thực Chiến |
|:---|:---|:---|
| `i2cdetect` không thấy địa chỉ `0x1a` | Lỏng dây, ngược SDA/SCL, mất nguồn 3.3V, chưa bật I2C | Đổi dây jumper, kiểm tra điện áp 3.3V, thêm `dtparam=i2c_arm=on` vào `config.txt` |
| `aplay` báo lỗi `No such device` | Sound Card chưa được đăng ký trong kernel | Kiểm tra `dmesg`, kiểm tra file `.dtbo` đã khai báo đúng DAI link và nạp vào bootloader chưa |
| `aplay` chạy bình thường nhưng loa im lặng | Mixer đang bị Mute hoặc âm lượng bằng 0 | Dùng `alsamixer`, un-mute Headphone/Speaker, bật "Output Mixer PCM" |
| Âm thanh phát ra bị giật cục, xuất hiện lỗi `underrun!` | Kích thước Period size quá nhỏ, CPU bị tải nặng | Tăng `--buffer-size=4096 --period-size=1024` khi gọi `aplay` |
| Âm thanh nghe giống "tiếng người máy / sóc chuột chipmunk" | Tần số mẫu (Sample rate) bị lệch giữa file và phần cứng | Kiểm tra clock PLL trong driver, dùng plugin `plughw:0,0` để ALSA tự động resample |
| Có tiếng nổ "bụp" (Pop noise) khi bắt đầu hoặc dừng phát nhạc | Khối Analog Amp bật/tắt nguồn quá đột ngột | Cấu hình DAPM trong driver Codec để kích hoạt cơ chế Soft-mute và Ramp-up volume từ từ |

---

## BÀI 20: Final Project: Building a Linux Audio Device (Đồ Án Cuối Khóa: Xây Dựng Thiết Bị m Thanh Nhúng Hoàn Chỉnh)

### 20.1. Đề Bài và Yêu Cầu Kỹ Thuật của Đồ Án
Xây dựng một hệ thống âm thanh nhúng độc lập hoàn chỉnh trên Raspberry Pi 4 kết hợp WM8960 Codec:
1. **Khởi động tự động (Auto Bring-up):** Khi cắm nguồn, hệ thống tự động nhận diện Sound Card, tự động khôi phục cấu hình mixer âm lượng chuẩn đã lưu (`alsactl restore`).
2. **Ứng dụng điều khiển viết bằng C (ALSA Library API):**
   - Phát âm thanh chào mừng (WAV playback).
   - Thu âm giọng nói người dùng thông qua 2 micro onboard có xử lý độ lợi tự động (AGC / PGA Gain).
   - Tự động phát lại file ghi âm hoặc truyền phát qua mạng Socket IPC.
3. **Độ ổn định và Đóng gói:** Chạy dưới dạng một Linux Daemon (`systemd service`), không bị rò rỉ bộ nhớ (0% memory leak kiểm tra bằng Valgrind), không sinh lỗi XRUN trong 24 giờ thử nghiệm liên tục.

---

### 20.2. Mã Nguồn C Mẫu: Ghi m và Phát m Thanh Trực Tiếp Bằng `alsa-lib` API

Dưới đây là khung chương trình C (`audio_engine.c`) sử dụng thư viện chuẩn `libasound` tương tác trực tiếp với ALSA:

```c
#include <stdio.h>
#include <stdlib.h>
#include <alsa/asoundlib.h>

#define PCM_DEVICE "default"
#define SAMPLE_RATE 48000
#define CHANNELS 2
#define PERIOD_SIZE 1024

int configure_pcm(snd_pcm_t *handle, snd_pcm_stream_t stream) {
    snd_pcm_hw_params_t *params;
    snd_pcm_hw_params_alloca(&params);

    // 1. Khởi tạo cấu trúc thông số phần cứng
    snd_pcm_hw_params_any(handle, params);

    // 2. Thiết lập chế độ truy cập (Interleaved: L R L R ...)
    snd_pcm_hw_params_set_access(handle, params, SND_PCM_ACCESS_RW_INTERLEAVED);

    // 3. Thiết lập định dạng mẫu (Signed 16-bit Little Endian)
    snd_pcm_hw_params_set_format(handle, params, SND_PCM_FORMAT_S16_LE);

    // 4. Thiết lập số kênh (2 kênh Stereo)
    snd_pcm_hw_params_set_channels(handle, params, CHANNELS);

    // 5. Thiết lập tần số lấy mẫu (48000 Hz)
    unsigned int rate = SAMPLE_RATE;
    snd_pcm_hw_params_set_rate_near(handle, params, &rate, 0);

    // 6. Áp dụng thông số xuống ALSA Driver
    if (snd_pcm_hw_params(handle, params) < 0) {
        fprintf(stderr, "Lỗi thiết lập HW params!\n");
        return -1;
    }
    return 0;
}

int main() {
    snd_pcm_t *capture_handle, *playback_handle;
    char buffer[PERIOD_SIZE * 4]; // 1024 frames * 2 channels * 2 bytes = 4096 bytes

    printf("=== KHỞI CHẠY HỆ THỐNG AUDIO LINUX FULL-DUPLEX ===\n");

    // Mở thiết bị thu âm
    if (snd_pcm_open(&capture_handle, PCM_DEVICE, SND_PCM_STREAM_CAPTURE, 0) < 0) {
        perror("Lỗi mở Capture device");
        return 1;
    }
    configure_pcm(capture_handle, SND_PCM_STREAM_CAPTURE);

    // Mở thiết bị phát âm
    if (snd_pcm_open(&playback_handle, PCM_DEVICE, SND_PCM_STREAM_PLAYBACK, 0) < 0) {
        perror("Lỗi mở Playback device");
        snd_pcm_close(capture_handle);
        return 1;
    }
    configure_pcm(playback_handle, SND_PCM_STREAM_PLAYBACK);

    printf("Bắt đầu vòng lặp thu - phát thời gian thực trong 10 giây...\n");
    int loops = (SAMPLE_RATE / PERIOD_SIZE) * 10; // Chạy trong 10s

    while (loops > 0) {
        // Thu 1 period từ micro
        int err = snd_pcm_readi(capture_handle, buffer, PERIOD_SIZE);
        if (err == -EPIPE) {
            fprintf(stderr, "Buffer Overrun!\n");
            snd_pcm_prepare(capture_handle);
            continue;
        }

        // Phát ngay lập tức ra loa/tai nghe (Loopback)
        err = snd_pcm_writei(playback_handle, buffer, PERIOD_SIZE);
        if (err == -EPIPE) {
            fprintf(stderr, "Buffer Underrun!\n");
            snd_pcm_prepare(playback_handle);
            continue;
        }

        loops--;
    }

    // Đóng thiết bị an toàn
    snd_pcm_drain(playback_handle);
    snd_pcm_close(capture_handle);
    snd_pcm_close(playback_handle);

    printf("Hoàn thành chương trình Audio Device!\n");
    return 0;
}
```

#### Biên dịch chương trình:
```bash
gcc audio_engine.c -o audio_engine -lasound
./audio_engine
```

---

### 20.3. Đóng Gói Thành Dịch Vụ Tự Động Khởi Chạy với Systemd
Tạo file dịch vụ `/etc/systemd/system/linux-audio.service`:

```ini
[Unit]
Description=Embedded Linux Audio Service
After=sound.target

[Service]
Type=simple
ExecStart=/usr/local/bin/audio_engine
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
```

Kích hoạt dịch vụ:
```bash
sudo systemctl daemon-reload
sudo systemctl enable linux-audio.service
sudo systemctl start linux-audio.service
```

Sau khi hoàn thành, thiết bị Raspberry Pi 4 đã trở thành một **Linux Audio Embedded Appliance** hoàn chỉnh, sẵn sàng cho việc thương mại hóa hoặc trình diễn sản phẩm chuyên nghiệp!
