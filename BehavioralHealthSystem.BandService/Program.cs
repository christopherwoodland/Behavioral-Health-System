using BehavioralHealthSystem.BandService.Services;

var builder = WebApplication.CreateBuilder(args);

// Configure as Windows Service
builder.Host.UseWindowsService();

// Add services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Add Band sensor service as singleton (maintains connection)
builder.Services.AddSingleton<IBandSensorService, BandSensorService>();

// Configure CORS for local development
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowLocalhost", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:5174", "http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Configure Kestrel to listen on specific port
builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenLocalhost(8765); // Default port for Band service
});

var app = builder.Build();

// Configure middleware
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowLocalhost");
app.UseAuthorization();
app.MapControllers();

app.Logger.LogInformation("Microsoft Band Service starting on http://localhost:8765");
app.Logger.LogInformation("API endpoints:");
app.Logger.LogInformation("  GET  /api/band/health - Health check");
app.Logger.LogInformation("  GET  /api/band/status - Device connection status");
app.Logger.LogInformation("  POST /api/band/collect - Collect sensor data");
app.Logger.LogInformation("  GET  /api/band/device-info - Device information");

app.Run();
