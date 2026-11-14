# Embedded Linux & Automotive Interview Guide

*Prepared from real‑project experience*  
_Last updated: 2026‑11‑14_

---

## 1. Linux Kernel Architecture & Build (LO1, LO2)

### 1.1 Kernel Space vs. User Space
**Keywords:** kernel space, user space, privilege levels, system call, context switch, ring0, ring3, `svc` instruction, `sys_enter`, `sys_exit`

- **Kernel space** runs in **privileged mode (ring 0)**, has direct hardware access, and manages resources.
- **User space** runs in **unprivileged mode (ring 3)**, isolated from hardware; processes interact via **system calls**.

**System call flow (e.g., `read()`):**
```
User App → glibc wrapper → syscall instruction (syscall/sysenter) → CPU switches to kernel mode →
  1. Entry stub in `entry_64.S` saves registers, sets up stack frame
  2. Dispatcher (`sys_call_table`) selects `sys_read`
  3. `sys_read` validates arguments, interacts with VFS/File Ops
  4. Return value placed in `rax`, registers restored → CPU returns to user mode
```
> [!NOTE] On ARM, the transition uses `svc #0` and the `entry-arm64.S` entry path.

---

### 1.2 Cross‑compile Kernel for Target Board
**Keywords:** CROSS_COMPILE, ARCH, defconfig, `make menuconfig`, `make savedefconfig`, `make O=out`, `CONFIG_…`, automotive safety, AUTOSAR, ISO‑26262, `CONFIG_PREEMPT_RT`, `CONFIG_DEBUG_INFO`

| Step | Command | What you decide for automotive |
|------|---------|--------------------------------|
| 1. Set up toolchain | `export CROSS_COMPILE=arm-linux-gnueabihf-`<br>`export ARCH=arm` | Use a **verified Linaro** or vendor‑provided GCC version matching the board.
| 2. Choose base config | `make <board>_defconfig` | Start from the vendor’s BSP defconfig; it already enables required drivers.
| 3. Tune config | `make menuconfig` (or edit `defconfig` manually) | **Enable**: `CONFIG_PREEMPT_RT` (real‑time), `CONFIG_CAN` (CAN drivers), `CONFIG_SECURITYFS`, `CONFIG_DEBUG_FS`.<br>**Disable**: `CONFIG_DEBUG_KERNEL`, `CONFIG_KALLSYMS` (size), `CONFIG_EXPERT` (if not needed). |
| 4. Save minimal config | `make savedefconfig` → `defconfig` | Keeps only non‑default options → reproducible builds.
| 5. Build | `make -j$(nproc) O=out` | Output in `out/`; ensures source tree remains clean.
| 6. Package | `make modules_install INSTALL_MOD_PATH=out/modules && make install INSTALL_PATH=out/boot` | Generates `zImage`/`Image.gz`, `dtb`, and modules.

**Why certain flags:**
- `CONFIG_PREEMPT_RT` gives deterministic latency for ADAS.
- `CONFIG_CAN` + specific driver (`CONFIG_CAN_MCP251X`) is required for vehicle bus.
- Disabling `CONFIG_DEBUG_INFO` reduces image size; enable only for debug builds.

---

### 1.3 Kernel Boots but Fails on Board – First Checks
**Keywords:** bootloader env, `bootargs`, Device Tree (`.dtb`), mismatched `CONFIG_` vs. hardware, console UART, `panic`, `earlyprintk`, `bootloader` logs, `dmesg`

1. **Verify bootloader parameters** – `bootargs` contains correct `root=` and `console=`.
2. **Check Device Tree** – ensure CPU cores, memory, peripheral nodes match the board.
3. **Serial console** – enable `earlyprintk` (`earlycon=uart,mmio,0x...`) to capture early kernel output.
4. **Kernel panic messages** – read via `dmesg` after watchdog reset or via serial.
5. **Module compatibility** – if modules built against a different kernel version, they will crash.
6. **Hardware watchdog** – ensure it isn’t resetting before log flush.

---

## 2. Boot Process & System Debugging (LO3)

### 2.1 Boot Sequence Overview
**Keywords:** ROM, SPL, U‑Boot, Device Tree, `initramfs`, `systemd`, `init`, `rcS`, `rc.local`

```mermaid
flowchart TD
    A[ROM – Reset/Boot ROM] --> B[First‑Stage Bootloader (SPL)]
    B --> C[Second‑Stage Bootloader (U‑Boot)]
    C --> D[Load Kernel Image & Device Tree]
    D --> E[Kernel Decompression & Init]
    E --> F[Init Process (PID 1)]
    F --> G[User‑Space Services (systemd, init scripts)]
```
- **ROM**: jumps to internal SRAM code.
- **SPL**: minimal code to set up DRAM, load full U‑Boot from flash.
- **U‑Boot**: provides console, environment, loads `zImage`/`dtb` from storage/network.
- **Kernel**: early boot, mounts rootfs, spawns `init`.
- **Init**: traditionally `/sbin/init`; modern systems use `systemd`.

---

### 2.2 "Starting kernel..." Stalls – Debug Steps
**Keywords:** `bootdelay`, `silent`, `console=ttyS0,115200n8`, `earlyprintk`, `bp` (breakpoint), `U‑Boot` `bootargs`, `mmc rescan`, `dtb mismatch`

1. **Check UART wiring & baud rate** – mis‑wired serial leads to silent boot.
2. **Add `earlyprintk`** in kernel `cmdline` to see pre‑init messages.
3. **Increase `bootdelay`** in U‑Boot (`setenv bootdelay 5`) – gives time to modify env.
4. **Verify DTB** – run `fdt get` in U‑Boot; mismatched memory size will stop after “Starting kernel …”.
5. **Enable Kernel debug**: `CONFIG_DEBUG_LL` and `CONFIG_EARLY_PRINTK`.
6. **Use U‑Boot `mmc rescan` / `fatload`** – ensure the kernel image loads correctly (checksum).
7. **Watch for watchdog resets** – disable temporarily (`setenv watchdog off`).

---

### 2.3 Using Serial Console + U‑Boot for Debug
**Workflow:**
1. Connect to board UART (115200 8N1). 
2. Interrupt U‑Boot (`Ctrl‑C`).
3. `printenv` → verify `bootargs`, `console`, `root`. 
4. `run bootcmd` manually, watching each step.
5. If stuck, drop to `bootm` with a known‑good `Image` and `*.dtb`.
6. When kernel starts, `Ctrl‑Alt‑Del` (if watchdog) triggers a reset – capture last `dmesg` via serial.

---

## 3. Yocto Project / Buildroot (LO4–LO7)

### 3.1 Layers, Recipes, BitBake – Build Flow
**Keywords:** `meta-layer`, `recipes`, `bbappend`, `bitbake`, `DEPENDS`, `RDEPENDS`, `OE-Core`, `MACHINE`, `DISTRO`

```mermaid
flowchart LR
    L[Layer Directory (meta‑* )] --> R[Recipe (.bb)]
    R --> B[BitBake parses .bb & .bbappend]
    B --> C[Task graph (do_fetch → do_compile → do_install → do_image)]
    C --> D[Generated rootfs / image]
```
- **Layer** groups related recipes & configuration.
- **Recipe** describes how to fetch, compile, package a piece of software.
- **BitBake** resolves dependencies, executes tasks in order, and produces the final image.

---

### 3.2 Minimal Recipe Example
```bitbake
# myapp_1.0.bb
DESCRIPTION = "Simple hello world"
LICENSE = "MIT"
SRC_URI = "file://myapp.c"
S = "${WORKDIR}"

inherit autotools

do_compile() {
    ${CC} ${CFLAGS} -o myapp myapp.c
}

do_install() {
    install -d ${D}${bindir}
    install -m 0755 myapp ${D}${bindir}
}
```
To add to an image, edit `core-image.bb` or create a custom image recipe and add `IMAGE_INSTALL:append = " myapp"`.

---

### 3.3 Adding a New BSP Layer in Yocto
1. Clone the BSP: `git clone https://example.com/meta-myboard.git`.
2. Edit `conf/bblayers.conf` → add `${TOPDIR}/../meta-myboard`.
3. Set `MACHINE = "myboard"` in `conf/local.conf`.
4. If the BSP provides `machine.conf`, ensure it is included (`require conf/machine/include/myboard.conf`).
5. Run `bitbake core-image-minimal`.

---

### 3.4 When to Prefer Buildroot over Yocto
- **Resource‑constrained** (<< 200 MB RAM, limited storage).
- Simpler build, **single Makefile** approach.
- Faster iteration for **single‑board prototypes**.
- **Steps for minimal rootfs**:
  1. `make defconfig` (select `BR2_TARGET_ROOTFS_*`).
  2. Enable `BR2_PACKAGE_BUSYBOX` and minimal utilities.
  3. Add needed kernel config via `BR2_LINUX_KERNEL_CUSTOM_CONFIG_FILE`.
  4. Run `make` → `output/target` contains rootfs.

---

## 4. Device Driver Development (LO8–LO10)

### 4.1 Character vs. Block vs. Network Drivers
| Type | Typical Use | I/O Model | Kernel Interface |
|------|-------------|-----------|-------------------|
| **Character** | Serial ports, GPIO, misc devices | `read()/write()` byte‑stream | `struct file_operations` (open, read, write, ioctl) |
| **Block** | Storage (eMMC, SSD) | Block I/O, request queue | `struct block_device_operations`, `make_request_fn` |
| **Network** | Ethernet, CAN, Wi‑Fi | Packet sockets, NAPI | `net_device_ops`, `ndo_start_xmit`, `ndo_open` |

Communication mechanisms: `ioctl`, `sysfs`, `debugfs`, `mmap`, netlink sockets.

---

### 4.2 Example GPIO Kernel Module (Skeleton)
```c
#include <linux/module.h>
#include <linux/gpio.h>
#include <linux/fs.h>
#include <linux/uaccess.h>

#define GPIO_PIN 23
static int major;
static int gpio_state = 0;

static ssize_t gpio_write(struct file *file, const char __user *buf, size_t count, loff_t *ppos)
{
    char kbuf[2];
    if (copy_from_user(kbuf, buf, 1)) return -EFAULT;
    if (kbuf[0] == '1') gpio_state = 1; else gpio_state = 0;
    gpio_set_value(GPIO_PIN, gpio_state);
    return count;
}

static const struct file_operations fops = {
    .owner = THIS_MODULE,
    .write = gpio_write,
};

static int __init gpio_mod_init(void)
{
    int ret = gpio_request_one(GPIO_PIN, GPIOF_OUT_INIT_LOW, "mygpio");
    if (ret) return ret;
    major = register_chrdev(0, "mygpio", &fops);
    return 0;
}

static void __exit gpio_mod_exit(void)
{
    unregister_chrdev(major, "mygpio");
    gpio_free(GPIO_PIN);
}
MODULE_LICENSE("GPL");
module_init(gpio_mod_init);
module_exit(gpio_mod_exit);
```
- `init` registers a **char device** and reserves the GPIO.
- `exit` cleans up.

---

### 4.3 Debugging Load Failures / Kernel Panics
1. **`dmesg`** – first line of the panic, module name, error code.
2. **`printk`** – insert at key points (`pr_info`, `pr_err`). Ensure `CONFIG_PRINTK` is enabled.
3. **`ftrace`** – enable function tracer: `echo function > /sys/kernel/debug/tracing/current_tracer` and look for the failing function.
4. **`coredump`** – enable `CONFIG_KEXEC` to reboot into a crash dump kernel for deeper analysis.
5. **`kprobes`** – probe the entry of the suspect function to capture arguments.

---

## 5. Automotive Protocols – CAN Bus (LO11, LO12)

### 5.1 CAN Frame Structure & Arbitration
**Keywords:** `CAN ID` (11‑bit standard, 29‑bit extended), `RTR`, `DLC`, `CRC`, `ACK`, **bit‑wise arbitration**, **error frames** (error active/passive, bus‑off).
- Arbitration is **non‑destructive**: lower ID wins because dominant bits (0) override recessive (1).
- Errors increase **error counters**; after 127 errors a node becomes error‑passive, after 255 → bus‑off.

---

### 5.2 Configuring SocketCAN & Using `can-utils`
```bash
# Load driver (e.g., mcp251x)
modprobe can
modprobe can_raw
modprobe mcp251x

# Set up interface
ip link set can0 up type can bitrate 500000

# Send a frame (standard ID 0x123, 8 bytes)
cansend can0 123#1122334455667788

# Receive
candump can0
```
- `ifconfig` vs `ip` – `ip` is preferred.
- `cansend`, `candump`, `cangen` for testing.

---

### 5.3 Bus Contention & Error‑heavy Scenarios
1. **Simultaneous transmission** – arbitration resolves to lower ID; higher‑ID node sees loss and retries.
2. **Excessive errors** – monitor `ifconfig can0` for `RX error`/`TX error` counters.
3. **Mitigation** – assign IDs by priority (e.g., braking = low ID). Use **error passive** mode for diagnostic nodes to avoid bringing bus down.
4. **Recovery** – after bus‑off, re‑initialize the driver or reset the transceiver hardware.

---

## 6. V4L2 / GStreamer (LO13–LO15)

### 6.1 Inspecting Camera Devices & Formats
```bash
# List video nodes
ls /dev/video*

# Query capabilities
v4l2-ctl --device=/dev/video0 --all

# List supported pixel formats
v4l2-ctl --device=/dev/video0 --list-formats
```
V4L2 workflow: **open → ioctl(VIDIOC_QUERYCAP) → set format (VIDIOC_S_FMT) → request buffers (VIDIOC_REQBUFS) → stream on/off (VIDIOC_STREAMON/OFF).**

---

### 6.2 GStreamer Capture Pipeline Example
```bash
gst-launch-1.0 \
  v4l2src device=/dev/video0 ! \
  video/x-raw,format=YUY2,width=1280,height=720,framerate=30/1 ! \
  videoconvert ! \
  x264enc bitrate=2000 speed-preset=ultrafast ! \
  rtph264pay config-interval=1 pt=96 ! \
  udpsink host=192.168.1.10 port=5000
```
- **`v4l2src`** pulls frames from V4L2.
- **`videoconvert`** handles pixel‑format conversion.
- **`x264enc`** encodes to H.264.
- **`rtph264pay`** packages for RTP streaming.

---

### 6.3 Automotive‑grade Camera Integration (360°/Rear‑view)
1. **Multiple V4L2 sources** → `videomixer` or `compositor` to stitch.
2. **Low latency** – use `queue leaky=downstream` and `videorate` to drop late frames.
3. **Error handling** – monitor `GST_MESSAGE_ERROR`; on loss, switch to a backup camera using `input-selector`.
4. **Sync** – enable hardware timestamp (`v4l2src do-timestamp=true`) and `gst-plugins-bad` `dvrsink` for deterministic display.
5. **Performance tip** – allocate buffers in **DMA‑coherent memory** (use `v4l2-ctl --set-ctrl=memory=1`).

---

**End of guide**
