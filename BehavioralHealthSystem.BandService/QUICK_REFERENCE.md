# Microsoft Band Service - Quick Reference

## 🚀 Quick Start

```powershell
# Start Band Service
cd BehavioralHealthSystem.BandService
.\start-service.ps1

# Or manually
dotnet run
```

Service runs on: **http://localhost:8765**

## 🔧 Configuration

### Web App (.env.local)
```env
VITE_ENABLE_SMART_BAND=true
VITE_BAND_SERVICE_URL=http://localhost:8765
```

### Band Service (appsettings.json)
```json
{
  "BandService": {
    "Port": 8765,
    "AllowedOrigins": ["http://localhost:5173"]
  }
}
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/band/health` | Health check |
| GET | `/api/band/status` | Device connection status |
| POST | `/api/band/collect` | Collect sensor data |
| GET | `/api/band/device-info` | Device information |

## 🧪 Test Commands

```powershell
# Health check
curl http://localhost:8765/api/band/health

# Device status
curl http://localhost:8765/api/band/status

# Collect data
curl -X POST http://localhost:8765/api/band/collect `
  -H "Content-Type: application/json" `
  -d '{"userId": "test-123"}'
```

## 📊 Swagger UI

Interactive API documentation:
**http://localhost:8765/swagger**

## 🏃 Running All Services

```powershell
# Terminal 1: Band Service
cd BehavioralHealthSystem.BandService
dotnet run

# Terminal 2: Azure Functions
cd BehavioralHealthSystem.Functions
func start

# Terminal 3: Web App
cd BehavioralHealthSystem.Web
npm run dev
```

## 🔍 Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 8765 in use | `netstat -ano \| findstr :8765` then kill process |
| No device found | Power on Band, check Bluetooth pairing |
| CORS errors | Add origin to `appsettings.json` AllowedOrigins |
| Service won't start | Check Event Viewer for errors |

## 📦 Install as Windows Service

```powershell
# Publish
dotnet publish -c Release -o C:\Services\BandService

# Install
New-Service -Name "BehavioralHealthBandService" `
  -BinaryPathName "C:\Services\BandService\BehavioralHealthSystem.BandService.exe" `
  -StartupType Automatic

# Start
Start-Service -Name "BehavioralHealthBandService"
```

## 📝 Sensors Collected

1. ⚡ **Accelerometer** - X/Y/Z acceleration (m/s²)
2. 🔄 **Gyroscope** - X/Y/Z angular velocity (°/s)
3. 🏃 **Motion** - Distance, speed, pace
4. ❤️ **Heart Rate** - BPM, quality
5. 👟 **Pedometer** - Total steps
6. 🌡️ **Skin Temperature** - Celsius
7. ☀️ **UV Exposure** - Exposure level, index
8. 📱 **Device Contact** - Is worn
9. 🔥 **Calories** - Total burned

## 🔗 Important Links

- **Installation Guide**: `BehavioralHealthSystem.BandService/README.md`
- **Implementation Details**: `BAND_SERVICE_IMPLEMENTATION.md`
- **Integration Docs**: `SMART_BAND_INTEGRATION.md`
- **Microsoft Band SDK**: https://github.com/mattleibow/Microsoft-Band-SDK-Bindings

## ⚠️ Before Using with Real Band

1. Install Microsoft Band SDK
2. Update `.csproj` package reference
3. Delete `BandSdkStub.cs`
4. Rebuild project

## 💡 Pro Tips

- Use `dotnet watch run` for auto-restart during development
- Check Swagger UI for interactive API testing
- Monitor Windows Event Log for service errors
- Ensure Band Sync app is not running (can block SDK access)
- Heart rate sensor requires user consent on first use

---

**Service Status Check**
```powershell
# Check if running
Get-Process | Where-Object {$_.ProcessName -like "*BehavioralHealth*"}

# Check port
Test-NetConnection -ComputerName localhost -Port 8765
```
