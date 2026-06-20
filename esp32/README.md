# ExEye ESP32 camera

Use the Arduino **CameraWebServer** example sketch folder, then replace its main `.ino` with `exeye_cam.ino` (keep **`app_httpd.cpp`** and **`camera_index.h`** from the example).

1. **Board:** XIAO ESP32S3 Sense · **PSRAM: OPI PSRAM**
2. Edit `ssid` / `password` at the top of `exeye_cam.ino`
3. Upload — serial shows `http://<ip>/capture` for ExEye
4. **D10** (GPIO9) — button — GND · hold **2 s** to sleep / wake
5. **User LED** (GPIO21) — **on** = awake, **off** = sleeping
