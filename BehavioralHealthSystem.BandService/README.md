# Microsoft Band Service - Installation & Usage Guide

## Overview

The Microsoft Band Service is a Windows Service that runs locally on your machine and provides a REST API for collecting sensor data from Microsoft Band devices. The web application communicates with this service via HTTP requests.

## Architecture

```
Web Browser (localhost:5173)
    ↓ HTTP Requests
Local Band Service (localhost:8765)
    ↓ Microsoft Band SDK
Microsoft Band Device (Bluetooth)
```

## Prerequisites

1. **Windows 10/11** - Required for Microsoft Band SDK compatibility
2. **.NET 8 SDK** - Download from https://dotnet.microsoft.com/download
3. **Microsoft Band Device** - Paired with your PC via Bluetooth
4. **Microsoft Band SDK** - See installation instructions below

## Installation

### Step 1: Install Microsoft Band SDK

The Microsoft Band SDK is required for the service to communicate with Band devices.

1. Download from: https://github.com/mattleibow/Microsoft-Band-SDK-Bindings
2. Follow the installation instructions in the repository
3. Note the installation path for the DLLs

### Step 2: Update Project References

1. Open `BehavioralHealthSystem.BandService.csproj`
2. Uncomment the Microsoft.Band package reference:

```xml
<!-- Remove comment tags around this: -->
<PackageReference Include="Microsoft.Band" Version="1.3.20" />
```

OR add a direct assembly reference:

```xml
<Reference Include="Microsoft.Band">
  <HintPath>C:\Path\To\Microsoft.Band.dll</HintPath>
</Reference>
```

3. **Delete** the `BandSdkStub.cs` file (it was only for compilation without SDK)

### Step 3: Build the Service

```powershell
cd BehavioralHealthSystem.BandService
dotnet build -c Release
```

### Step 4: Test the Service

Run the service in development mode:

```powershell
dotnet run
```

The service should start on `http://localhost:8765`

You should see output like:

```
Microsoft Band Service starting on http://localhost:8765
API endpoints:
  GET  /api/band/health - Health check
  GET  /api/band/status - Device connection status
  POST /api/band/collect - Collect sensor data
  GET  /api/band/device-info - Device information
```

## Testing the API

### Health Check

```powershell
curl http://localhost:8765/api/band/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "Microsoft Band Service",
  "timestamp": "2025-10-24T..."
}
```

### Device Status

```powershell
curl http://localhost:8765/api/band/status
```

Expected response (when Band is connected):
```json
{
  "isConnected": true,
  "deviceInfo": {
    "deviceName": "Microsoft Band 2",
    "firmwareVersion": "2.0.5030.0",
    "hardwareVersion": "1.0.0.0"
  },
  "message": "Microsoft Band connected successfully"
}
```

### Collect Sensor Data

```powershell
curl -X POST http://localhost:8765/api/band/collect `
  -H "Content-Type: application/json" `
  -d '{"userId": "test-user-123"}'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "userId": "test-user-123",
    "snapshotId": "guid...",
    "collectedAt": "2025-10-24T...",
    "deviceInfo": { ... },
    "sensorData": {
      "accelerometer": { "x": 0.12, "y": -9.81, "z": 0.05, ... },
      "heartRate": { "bpm": 72, "quality": "Locked", ... },
      ...
    }
  }
}
```

## Installing as Windows Service

### Option 1: Using sc.exe (Built-in)

```powershell
# Build in Release mode first
dotnet publish -c Release -o C:\Services\BandService

# Create the service
sc.exe create "BehavioralHealthBandService" `
  binPath= "C:\Services\BandService\BehavioralHealthSystem.BandService.exe" `
  start= auto `
  DisplayName= "Behavioral Health Band Service"

# Start the service
sc.exe start BehavioralHealthBandService

# Check status
sc.exe query BehavioralHealthBandService
```

### Option 2: Using PowerShell

```powershell
# Build and publish
dotnet publish -c Release -o C:\Services\BandService

# Create service
New-Service -Name "BehavioralHealthBandService" `
  -BinaryPathName "C:\Services\BandService\BehavioralHealthSystem.BandService.exe" `
  -DisplayName "Behavioral Health Band Service" `
  -Description "REST API for Microsoft Band sensor data collection" `
  -StartupType Automatic

# Start service
Start-Service -Name "BehavioralHealthBandService"

# Check status
Get-Service -Name "BehavioralHealthBandService"
```

### Uninstall Service

```powershell
# Stop the service
Stop-Service -Name "BehavioralHealthBandService"

# Remove the service
sc.exe delete "BehavioralHealthBandService"
```

## Configuration

### Service Configuration (appsettings.json)

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "BehavioralHealthSystem.BandService": "Information"
    }
  },
  "BandService": {
    "Port": 8765,
    "EnableSwagger": true,
    "AllowedOrigins": [
      "http://localhost:5173",
      "http://localhost:5174"
    ]
  }
}
```

### Web App Configuration (.env.local)

Add these environment variables to your `.env.local` file:

```env
# Enable Smart Band feature
VITE_ENABLE_SMART_BAND=true

# Local Band Service URL (default: http://localhost:8765)
VITE_BAND_SERVICE_URL=http://localhost:8765
```

## Usage in Web Application

Once the Band Service is running and configured:

1. **Automatic Collection**: Jekyll agent will automatically collect Band data at the start of health assessment conversations (silently, without user notification)

2. **Manual Testing**: You can test the service directly in browser console:

```javascript
// Check if device is connected
const response = await fetch('http://localhost:8765/api/band/status');
const status = await response.json();
console.log(status);

// Collect sensor data
const collectResponse = await fetch('http://localhost:8765/api/band/collect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'test-123' })
});
const data = await collectResponse.json();
console.log(data);
```

## Troubleshooting

### Service won't start

**Issue**: Service fails to start or exits immediately

**Solutions**:
- Check Event Viewer (Windows Logs → Application) for error messages
- Verify .NET 8 Runtime is installed
- Check that port 8765 is not already in use: `netstat -ano | findstr :8765`
- Run `dotnet run` manually to see detailed error messages

### No device found

**Issue**: `/api/band/status` returns `"isConnected": false`

**Solutions**:
- Ensure Microsoft Band is powered on
- Verify Band is paired in Windows Bluetooth settings
- Check Band Sync app is not blocking access
- Restart the Band device
- Re-pair the device if necessary

### CORS errors in browser

**Issue**: Browser console shows CORS errors when calling the service

**Solutions**:
- Verify your web app origin is in `AllowedOrigins` in appsettings.json
- Restart the Band Service after configuration changes
- Check browser console for the exact origin being blocked

### Permission denied errors

**Issue**: Service can't access Band SDK or sensors

**Solutions**:
- Run Visual Studio or PowerShell as Administrator when testing
- When installed as service, ensure the service account has proper permissions
- Check Windows Privacy settings allow app access to sensors

## Development Tips

### Running in Development Mode

For active development, you can run both services side-by-side:

```powershell
# Terminal 1: Run Band Service
cd BehavioralHealthSystem.BandService
dotnet watch run

# Terminal 2: Run Web App
cd BehavioralHealthSystem.Web
npm run dev
```

The `dotnet watch run` command will automatically rebuild and restart the service when you make code changes.

### Viewing Swagger Documentation

When running in development mode, Swagger UI is available at:

```
http://localhost:8765/swagger
```

This provides interactive API documentation and testing interface.

### Checking Service Logs

When installed as a Windows Service, logs go to the Windows Event Log:

```powershell
# View logs in PowerShell
Get-EventLog -LogName Application -Source "BehavioralHealthBandService" -Newest 50
```

Or use Event Viewer:
1. Press Win+R, type `eventvwr`
2. Navigate to Windows Logs → Application
3. Filter by source: "BehavioralHealthBandService"

## API Reference

### GET /api/band/health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "Microsoft Band Service",
  "timestamp": "2025-10-24T12:34:56Z"
}
```

### GET /api/band/status

Check device connection status.

**Response:**
```json
{
  "isConnected": true,
  "deviceInfo": {
    "deviceName": "Microsoft Band 2",
    "firmwareVersion": "2.0.5030.0",
    "hardwareVersion": "1.0.0.0"
  },
  "message": "Microsoft Band connected successfully"
}
```

### POST /api/band/collect

Collect sensor data snapshot.

**Request:**
```json
{
  "userId": "user-123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user-123",
    "snapshotId": "guid...",
    "collectedAt": "2025-10-24T12:34:56Z",
    "sensorData": { ... },
    "deviceInfo": { ... }
  }
}
```

### GET /api/band/device-info

Get detailed device information.

**Response:**
```json
{
  "deviceName": "Microsoft Band 2",
  "firmwareVersion": "2.0.5030.0",
  "hardwareVersion": "1.0.0.0"
}
```

## Security Considerations

1. **Local Only**: The service is designed to run on localhost only. Do not expose it to the network.

2. **No Authentication**: The service has no authentication as it's meant for local development. If exposing to network, add authentication.

3. **CORS**: Only allow specific origins in `appsettings.json` to prevent unauthorized access.

4. **HTTPS**: For production, consider adding HTTPS support (requires certificate configuration).

## Support

For issues related to:
- **Band Service Code**: Check BehavioralHealthSystem.BandService project
- **Microsoft Band SDK**: https://github.com/mattleibow/Microsoft-Band-SDK-Bindings/issues
- **Device Pairing**: Microsoft Band Sync app or Windows Bluetooth settings
