# Behavioral Health System - SignalR Hub

Real-time communication hub providing bidirectional messaging capabilities for the behavioral health system, enabling live agent interactions, notifications, and session management.

## 🚀 Overview

This project implements a sophisticated SignalR-based communication hub that facilitates real-time interactions between users, AI agents, and the broader behavioral health system. It provides the foundation for live messaging, agent handoffs, and real-time notifications.

### Key Features

- ✅ **Real-Time Messaging** - Bidirectional communication between clients and agents
- ✅ **Agent Handoff Notifications** - Live updates during agent transitions
- ✅ **Typing Indicators** - Visual feedback for agent processing states
- ✅ **Session Management** - Persistent connection and session tracking
- ✅ **Crisis Alerts** - Immediate notifications for emergency situations
- ✅ **Cross-Platform Support** - Web, mobile, and desktop client compatibility

## 📁 Project Structure

```text
BehavioralHealthSystem.SignalRHub/
├── 📁 Hubs/                        # SignalR hub implementations
│   ├── AgentCommunicationHub.cs   # Main agent communication hub
│   ├── SessionManagementHub.cs    # Session lifecycle management
│   └── NotificationHub.cs         # System-wide notifications
├── 📁 Models/                      # Communication data models
│   ├── AgentHandoffInfo.cs        # Agent handoff notifications
│   ├── SessionInfo.cs             # Session state information
│   └── NotificationMessage.cs     # Notification structures
├── 📁 Services/                    # Support services
│   ├── ConnectionManager.cs       # Client connection management
│   ├── SessionService.cs          # Session state management
│   └── NotificationService.cs     # Notification broadcasting
├── 📄 appsettings.Development.json # Development configuration
├── 📄 Program.cs                  # Application entry point
└── 📄 README.md                   # This documentation
```

## 🛠️ Technology Stack

### Core Technologies

- **🔢 ASP.NET Core 8** - Modern web framework with performance optimizations
- **📡 SignalR** - Real-time bidirectional communication framework
- **🔌 WebSocket** - Low-latency persistent connections
- **💉 Dependency Injection** - Built-in service container and lifecycle management

### Communication Protocols

- **🌐 WebSocket** - Primary transport for real-time communication
- **📡 Server-Sent Events** - Fallback for one-way communication
- **🔄 Long Polling** - Final fallback for limited environments
- **🔒 HTTPS/WSS** - Secure transport layer encryption

## 🏗️ Hub Architecture

### AgentCommunicationHub

Main hub responsible for agent-user communication:

```csharp
public class AgentCommunicationHub : Hub
{
    private readonly ISessionService _sessionService;
    private readonly IConnectionManager _connectionManager;
    private readonly ILogger<AgentCommunicationHub> _logger;

    public async Task JoinSession(string sessionId, string userId)
    {
        // Add user to session group
        await Groups.AddToGroupAsync(Context.ConnectionId, sessionId);
        
        // Track connection
        await _connectionManager.AddConnectionAsync(Context.ConnectionId, sessionId, userId);
        
        // Notify session participants
        await Clients.Group(sessionId).SendAsync("UserJoined", new
        {
            UserId = userId,
            SessionId = sessionId,
            Timestamp = DateTime.UtcNow
        });
    }

    public async Task SendUserMessage(string sessionId, string message)
    {
        var userId = await _connectionManager.GetUserIdAsync(Context.ConnectionId);
        
        // Broadcast to all session participants
        await Clients.Group(sessionId).SendAsync("ReceiveMessage", new
        {
            SessionId = sessionId,
            UserId = userId,
            Message = message,
            Timestamp = DateTime.UtcNow,
            MessageType = "User"
        });
    }

    public async Task SendAgentMessage(string sessionId, string agentName, string message)
    {
        // Broadcast agent response
        await Clients.Group(sessionId).SendAsync("ReceiveMessage", new
        {
            SessionId = sessionId,
            AgentName = agentName,
            Message = message,
            Timestamp = DateTime.UtcNow,
            MessageType = "Agent"
        });
    }

    public async Task NotifyAgentHandoff(string sessionId, AgentHandoffInfo handoffInfo)
    {
        // Notify all session participants of agent change
        await Clients.Group(sessionId).SendAsync("AgentHandoff", handoffInfo);
    }

    public async Task SendTypingIndicator(string sessionId, string agentName, bool isTyping)
    {
        // Send typing indicator to session participants
        await Clients.Group(sessionId).SendAsync("TypingIndicator", new
        {
            SessionId = sessionId,
            AgentName = agentName,
            IsTyping = isTyping,
            Timestamp = DateTime.UtcNow
        });
    }

    public override async Task OnDisconnectedAsync(Exception exception)
    {
        // Clean up connection tracking
        await _connectionManager.RemoveConnectionAsync(Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
```

### SessionManagementHub

Specialized hub for session lifecycle management:

```csharp
public class SessionManagementHub : Hub
{
    public async Task CreateSession(string userId, SessionConfiguration config)
    {
        var sessionId = await _sessionService.CreateSessionAsync(userId, config);
        
        // Join the new session
        await Groups.AddToGroupAsync(Context.ConnectionId, sessionId);
        
        // Notify client of session creation
        await Clients.Caller.SendAsync("SessionCreated", new
        {
            SessionId = sessionId,
            UserId = userId,
            Configuration = config,
            CreatedAt = DateTime.UtcNow
        });
    }

    public async Task EndSession(string sessionId)
    {
        var session = await _sessionService.GetSessionAsync(sessionId);
        
        if (session != null)
        {
            // Notify all participants
            await Clients.Group(sessionId).SendAsync("SessionEnded", new
            {
                SessionId = sessionId,
                EndedAt = DateTime.UtcNow,
                Duration = DateTime.UtcNow - session.CreatedAt
            });
            
            // Clean up session
            await _sessionService.EndSessionAsync(sessionId);
        }
    }
}
```

### NotificationHub

System-wide notification broadcasting:

```csharp
public class NotificationHub : Hub
{
    public async Task SendCrisisAlert(string sessionId, CrisisAlert alert)
    {
        // Send immediate crisis notification
        await Clients.All.SendAsync("CrisisAlert", alert);
        
        // Log crisis event
        _logger.LogCritical("Crisis alert triggered for session {SessionId}: {AlertType}", 
            sessionId, alert.AlertType);
    }

    public async Task SendSystemNotification(SystemNotification notification)
    {
        // Broadcast system-wide notification
        await Clients.All.SendAsync("SystemNotification", notification);
    }

    public async Task SendUserNotification(string userId, UserNotification notification)
    {
        // Send targeted user notification
        await Clients.User(userId).SendAsync("UserNotification", notification);
    }
}
```

## 📊 Data Models

### Communication Models

#### AgentHandoffInfo

```csharp
public class AgentHandoffInfo
{
    public string SessionId { get; set; }
    public string FromAgent { get; set; }
    public string ToAgent { get; set; }
    public string Reason { get; set; }
    public Dictionary<string, object> Context { get; set; }
    public DateTime HandoffTime { get; set; }
    public HandoffStatus Status { get; set; }
}

public enum HandoffStatus
{
    Initiated,
    InProgress,
    Completed,
    Failed
}
```

#### SessionInfo

```csharp
public class SessionInfo
{
    public string SessionId { get; set; }
    public string UserId { get; set; }
    public string CurrentAgent { get; set; }
    public SessionStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime LastActivity { get; set; }
    public Dictionary<string, object> Metadata { get; set; }
}

public enum SessionStatus
{
    Active,
    Paused,
    Ended,
    Crisis
}
```

#### NotificationMessage

```csharp
public class NotificationMessage
{
    public string Id { get; set; }
    public NotificationType Type { get; set; }
    public string Title { get; set; }
    public string Message { get; set; }
    public NotificationPriority Priority { get; set; }
    public DateTime Timestamp { get; set; }
    public Dictionary<string, object> Data { get; set; }
}

public enum NotificationType
{
    System,
    Agent,
    Assessment,
    Crisis,
    Handoff
}

public enum NotificationPriority
{
    Low,
    Normal,
    High,
    Critical
}
```

## 🔧 Configuration & Setup

### Service Registration

```csharp
public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        // Add SignalR services
        builder.Services.AddSignalR(options =>
        {
            options.EnableDetailedErrors = builder.Environment.IsDevelopment();
            options.KeepAliveInterval = TimeSpan.FromSeconds(15);
            options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
            options.HandshakeTimeout = TimeSpan.FromSeconds(15);
        });

        // Add CORS for cross-origin requests
        builder.Services.AddCors(options =>
        {
            options.AddPolicy("AllowWebApp", policy =>
            {
                policy.WithOrigins("http://localhost:5173", "https://localhost:5174")
                      .AllowAnyHeader()
                      .AllowAnyMethod()
                      .AllowCredentials();
            });
        });

        // Register custom services
        builder.Services.AddScoped<ISessionService, SessionService>();
        builder.Services.AddSingleton<IConnectionManager, ConnectionManager>();
        builder.Services.AddScoped<INotificationService, NotificationService>();

        var app = builder.Build();

        // Configure middleware pipeline
        app.UseCors("AllowWebApp");
        app.UseRouting();

        // Map SignalR hubs
        app.MapHub<AgentCommunicationHub>("/agentCommunicationHub");
        app.MapHub<SessionManagementHub>("/sessionManagementHub");
        app.MapHub<NotificationHub>("/notificationHub");

        app.Run();
    }
}
```

### Client Configuration

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore.SignalR": "Debug",
      "Microsoft.AspNetCore.Http.Connections": "Debug"
    }
  },
  "SignalRSettings": {
    "KeepAliveInterval": "00:00:15",
    "ClientTimeoutInterval": "00:00:30",
    "HandshakeTimeout": "00:00:15",
    "EnableDetailedErrors": true,
    "MaximumReceiveMessageSize": 32768
  },
  "AllowedHosts": "*"
}
```

## 🌐 Client Integration

### JavaScript Client

```javascript
// Connection setup
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/agentCommunicationHub", {
        transport: signalR.HttpTransportType.WebSockets
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Information)
    .build();

// Event handlers
connection.on("ReceiveMessage", (messageData) => {
    displayMessage(messageData);
});

connection.on("AgentHandoff", (handoffInfo) => {
    showAgentTransition(handoffInfo);
});

connection.on("TypingIndicator", (typingData) => {
    updateTypingIndicator(typingData);
});

connection.on("CrisisAlert", (alert) => {
    showCrisisNotification(alert);
});

// Connection management
async function startConnection() {
    try {
        await connection.start();
        console.log("SignalR Connected");
        
        // Join session
        await connection.invoke("JoinSession", sessionId, userId);
    } catch (err) {
        console.error("SignalR Connection Error: ", err);
        setTimeout(startConnection, 5000);
    }
}

// Send user message
async function sendMessage(message) {
    try {
        await connection.invoke("SendUserMessage", sessionId, message);
    } catch (err) {
        console.error("Send Message Error: ", err);
    }
}

// Start connection
startConnection();
```

### React Client Integration

```jsx
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

export class SignalRService {
    constructor() {
        this.connection = null;
        this.callbacks = new Map();
    }

    async connect(sessionId, userId) {
        this.connection = new HubConnectionBuilder()
            .withUrl('/agentCommunicationHub')
            .withAutomaticReconnect()
            .configureLogging(LogLevel.Information)
            .build();

        // Register event handlers
        this.connection.on('ReceiveMessage', (data) => {
            this.callbacks.get('message')?.(data);
        });

        this.connection.on('AgentHandoff', (data) => {
            this.callbacks.get('handoff')?.(data);
        });

        this.connection.on('TypingIndicator', (data) => {
            this.callbacks.get('typing')?.(data);
        });

        await this.connection.start();
        await this.connection.invoke('JoinSession', sessionId, userId);
    }

    on(event, callback) {
        this.callbacks.set(event, callback);
    }

    async sendMessage(sessionId, message) {
        if (this.connection) {
            await this.connection.invoke('SendUserMessage', sessionId, message);
        }
    }

    async disconnect() {
        if (this.connection) {
            await this.connection.stop();
        }
    }
}
```

## 🔒 Security & Authentication

### Connection Authentication

```csharp
public class AuthenticatedHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        // Validate user authentication
        var userId = Context.User?.Identity?.Name;
        if (string.IsNullOrEmpty(userId))
        {
            Context.Abort();
            return;
        }

        // Additional authorization checks
        var hasAccess = await _authorizationService.AuthorizeAsync(
            Context.User, "BehavioralHealthAccess");
        
        if (!hasAccess.Succeeded)
        {
            Context.Abort();
            return;
        }

        await base.OnConnectedAsync();
    }
}
```

### Message Validation

```csharp
public class SecureAgentCommunicationHub : AgentCommunicationHub
{
    public override async Task SendUserMessage(string sessionId, string message)
    {
        // Validate session ownership
        var userId = Context.User.Identity.Name;
        var session = await _sessionService.GetSessionAsync(sessionId);
        
        if (session?.UserId != userId)
        {
            throw new UnauthorizedAccessException("Invalid session access");
        }

        // Sanitize message content
        var sanitizedMessage = _messageValidator.Sanitize(message);
        
        // Check for crisis indicators
        var crisisLevel = await _crisisDetector.AnalyzeAsync(sanitizedMessage);
        if (crisisLevel == CrisisLevel.Immediate)
        {
            await NotifyCrisisTeam(sessionId, sanitizedMessage);
        }

        await base.SendUserMessage(sessionId, sanitizedMessage);
    }
}
```

## 📊 Monitoring & Performance

### Connection Metrics

```csharp
public class ConnectionMetricsService
{
    private readonly IMetricsLogger _metrics;

    public async Task TrackConnection(string connectionId, string userId)
    {
        _metrics.Increment("signalr.connections.active");
        _metrics.Gauge("signalr.connections.total", await GetTotalConnections());
    }

    public async Task TrackMessage(string sessionId, MessageType type, int messageSize)
    {
        _metrics.Increment($"signalr.messages.{type.ToString().ToLower()}");
        _metrics.Histogram("signalr.message.size", messageSize);
    }

    public async Task TrackLatency(string connectionId, TimeSpan latency)
    {
        _metrics.Histogram("signalr.message.latency", latency.TotalMilliseconds);
    }
}
```

### Health Checks

```csharp
public class SignalRHealthCheck : IHealthCheck
{
    private readonly IConnectionManager _connectionManager;

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var activeConnections = await _connectionManager.GetActiveConnectionCountAsync();
            var data = new Dictionary<string, object>
            {
                ["active_connections"] = activeConnections,
                ["max_connections"] = 10000,
                ["status"] = "healthy"
            };

            return activeConnections < 10000 
                ? HealthCheckResult.Healthy("SignalR is healthy", data)
                : HealthCheckResult.Degraded("High connection count", data);
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("SignalR health check failed", ex);
        }
    }
}
```

## 🚀 Deployment & Scaling

### Azure SignalR Service Integration

```csharp
public static class SignalRServiceCollectionExtensions
{
    public static IServiceCollection AddAzureSignalR(
        this IServiceCollection services, 
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("AzureSignalR");
        
        if (!string.IsNullOrEmpty(connectionString))
        {
            services.AddSignalR()
                    .AddAzureSignalR(connectionString);
        }
        else
        {
            services.AddSignalR();
        }

        return services;
    }
}
```

### Load Balancing Configuration

```json
{
  "AzureSignalR": {
    "ConnectionString": "Endpoint=https://your-signalr.service.signalr.net;AccessKey=your-key;Version=1.0;",
    "ServerStickyMode": "Required",
    "ConnectionCount": 5,
    "ServiceTransportType": "Persistent"
  }
}
```

## 🧪 Testing Strategies

### Hub Unit Testing

```csharp
[TestClass]
public class AgentCommunicationHubTests
{
    private Mock<ISessionService> _mockSessionService;
    private Mock<IConnectionManager> _mockConnectionManager;
    private AgentCommunicationHub _hub;

    [TestInitialize]
    public void Setup()
    {
        _mockSessionService = new Mock<ISessionService>();
        _mockConnectionManager = new Mock<IConnectionManager>();
        _hub = new AgentCommunicationHub(_mockSessionService.Object, _mockConnectionManager.Object);
    }

    [TestMethod]
    public async Task JoinSession_ValidSession_ShouldAddToGroup()
    {
        // Arrange
        var sessionId = "test-session";
        var userId = "test-user";
        var mockContext = new Mock<HubCallerContext>();
        var mockGroups = new Mock<IGroupManager>();
        
        _hub.Context = mockContext.Object;
        _hub.Groups = mockGroups.Object;

        // Act
        await _hub.JoinSession(sessionId, userId);

        // Assert
        mockGroups.Verify(g => g.AddToGroupAsync(
            It.IsAny<string>(), 
            sessionId, 
            default), Times.Once);
    }
}
```

### Integration Testing

```csharp
[TestClass]
public class SignalRIntegrationTests
{
    private WebApplication _app;
    private HubConnection _connection;

    [TestInitialize]
    public async Task Setup()
    {
        _app = CreateTestApplication();
        await _app.StartAsync();

        _connection = new HubConnectionBuilder()
            .WithUrl("http://localhost/agentCommunicationHub")
            .Build();
        
        await _connection.StartAsync();
    }

    [TestMethod]
    public async Task SendMessage_ShouldReceiveMessage()
    {
        // Arrange
        var messageReceived = false;
        var receivedMessage = string.Empty;

        _connection.On<object>("ReceiveMessage", (message) =>
        {
            messageReceived = true;
            receivedMessage = message.ToString();
        });

        // Act
        await _connection.InvokeAsync("SendUserMessage", "test-session", "Hello World");

        // Assert
        await Task.Delay(1000); // Wait for message processing
        Assert.IsTrue(messageReceived);
        Assert.IsTrue(receivedMessage.Contains("Hello World"));
    }

    [TestCleanup]
    public async Task Cleanup()
    {
        await _connection.DisposeAsync();
        await _app.StopAsync();
        await _app.DisposeAsync();
    }
}
```

## 🤝 Contributing

### Adding New Hubs

1. **Create Hub Class** - Inherit from `Hub` or `Hub<T>`
2. **Implement Methods** - Add public async methods for client calls
3. **Register Hub** - Add to `Program.cs` with `MapHub<T>()`
4. **Add Client Interface** - Define strongly-typed client interface
5. **Create Tests** - Add comprehensive unit and integration tests
6. **Update Documentation** - Document new hub capabilities

### Development Guidelines

- **Authentication** - Always validate user identity and authorization
- **Input Validation** - Sanitize and validate all client inputs
- **Error Handling** - Implement graceful error handling and logging
- **Performance** - Consider connection limits and message throughput
- **Security** - Follow secure coding practices and audit regularly

## 📚 Dependencies

- **Microsoft.AspNetCore.SignalR** - Core SignalR functionality
- **Microsoft.AspNetCore.Authentication** - Authentication middleware
- **Microsoft.Extensions.Logging** - Logging infrastructure
- **Microsoft.Extensions.HealthChecks** - Health monitoring
- **Microsoft.AspNetCore.Cors** - Cross-origin resource sharing

---

This SignalR hub provides robust real-time communication capabilities for the behavioral health system, enabling seamless agent interactions and immediate crisis response coordination.